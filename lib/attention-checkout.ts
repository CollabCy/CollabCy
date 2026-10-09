import { safeWebsite, validateBid } from "@/app/attention/model";
import { validateAttentionListing } from "@/app/attention/validation";
import {
  amountCentsFromIncrement,
  checkoutMetadata,
  checkoutReturnPath,
  listingCheckoutReturnPath,
  parseCheckoutBody,
  parseListingCheckoutBody,
  rankingProductsFromRows,
  type RankingProductRow,
} from "@/lib/attention-payments";
import { attentionBidProductId, getDodoClient } from "@/lib/dodo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Bid } from "@/app/attention/model";

export class AttentionCheckoutError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AttentionCheckoutError";
  }
}

const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
const CHECKOUT_MAX = 10;
const checkoutAttempts = new Map<string, number[]>();

function jsonSafeError(error: unknown) {
  return error instanceof AttentionCheckoutError ? error.message : "Could not start checkout.";
}

function checkoutOrigin(request: Request) {
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      if (new URL(originHeader).origin === url.origin) return url.origin;
    } catch {
      // Ignore unparseable Origin and stay on the request origin.
    }
  }
  return url.origin;
}

function checkoutClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
  return ip.slice(0, 64);
}

function tooManyCheckouts(key: string) {
  const now = Date.now();
  const recent = (checkoutAttempts.get(key) || []).filter((time) => now - time < CHECKOUT_WINDOW_MS);
  if (recent.length >= CHECKOUT_MAX) {
    checkoutAttempts.set(key, recent);
    return true;
  }
  recent.push(now);
  checkoutAttempts.set(key, recent);
  return false;
}

async function loadRankingProducts(): Promise<{ products: ReturnType<typeof rankingProductsFromRows>; error?: string }> {
  const admin = getSupabaseAdmin();
  const { data: productRows, error: productError } = await admin
    .from("attention_products")
    .select("id, slug, status, current_bid, listing_starts_at, listing_ends_at");
  if (productError) return { products: [], error: "Could not start checkout." };
  const rows = (productRows || []) as RankingProductRow[];
  const ids = rows.map((row) => row.id);
  const latestBids: Record<string, Bid> = {};
  if (ids.length) {
    const { data: bidRows, error: bidError } = await admin
      .from("attention_bids")
      .select("id, product_id, amount, created_at")
      .in("product_id", ids)
      .order("created_at", { ascending: false });
    if (bidError) return { products: [], error: "Could not start checkout." };
    for (const row of bidRows || []) {
      const productId = typeof row.product_id === "string" ? row.product_id : "";
      if (!productId || latestBids[productId]) continue;
      const createdAt = typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;
      latestBids[productId] = {
        id: typeof row.id === "string" ? row.id : productId,
        amount: typeof row.amount === "number" ? row.amount : 0,
        createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      };
    }
  }
  return { products: rankingProductsFromRows(rows, latestBids) };
}

export async function createAttentionBidCheckout(request: Request): Promise<Response> {
  try {
    if (tooManyCheckouts(checkoutClientKey(request))) {
      return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Enter a valid bid amount." }, { status: 400 });
    }

    const parsed = parseCheckoutBody(body);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: parsed.error === "Product not found." ? 404 : 400 });
    }

    const { products, error: loadError } = await loadRankingProducts();
    if (loadError) return Response.json({ error: loadError }, { status: 500 });
    const product = products.find((item) => item.id === parsed.product_id);
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

    const validation = validateBid(products, parsed.product_id, parsed.increment);
    if (validation) return Response.json({ error: validation }, { status: 400 });

    const amountCents = amountCentsFromIncrement(parsed.increment);
    if (amountCents < 200) {
      return Response.json({ error: "Enter at least $2." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: inserted, error: insertError } = await admin
      .from("attention_bid_payments")
      .insert({
        user_id: null,
        product_id: parsed.product_id,
        increment: parsed.increment,
        amount_cents: amountCents,
        currency: "USD",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return Response.json({ error: "Could not start checkout." }, { status: 500 });
    }

    const paymentId = inserted.id as string;
    return startDodoPaymentSession({
      admin,
      request,
      paymentId,
      productId: parsed.product_id,
      increment: parsed.increment,
      amountCents,
      returnPath: checkoutReturnPath(product.slug),
    });
  } catch {
    return Response.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

export async function createAttentionListingCheckout(request: Request): Promise<Response> {
  try {
    if (tooManyCheckouts(checkoutClientKey(request))) {
      return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Enter a valid bid amount." }, { status: 400 });
    }

    const parsed = parseListingCheckoutBody(body);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const listingError = validateAttentionListing({
      name: parsed.listing.name,
      websiteUrl: parsed.listing.websiteUrl,
      description: parsed.listing.description,
      category: parsed.listing.category,
      initialBid: parsed.increment,
      brandName: parsed.listing.brandName,
      logo: parsed.listing.logo,
    });
    if (listingError) return Response.json({ error: listingError }, { status: 400 });

    const amountCents = amountCentsFromIncrement(parsed.increment);
    if (amountCents < 200) {
      return Response.json({ error: "Enter at least $2." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: pending, error: pendingError } = await admin.rpc("create_pending_attention_listing", {
      p_name: parsed.listing.name.trim(),
      p_website_url: safeWebsite(parsed.listing.websiteUrl) || parsed.listing.websiteUrl,
      p_description: parsed.listing.description.trim(),
      p_category: parsed.listing.category,
      p_logo: parsed.listing.logo || parsed.listing.name.trim().slice(0, 1),
      p_color: "#3267e8",
      p_initial_bid: parsed.increment,
      p_brand_name: (parsed.listing.brandName || parsed.listing.name).trim(),
    });

    if (pendingError || !pending || typeof pending !== "object") {
      const message = pendingError?.message || "";
      if (message.includes("just listed")) {
        return Response.json({ error: "This product was just listed. Please wait before listing it again." }, { status: 429 });
      }
      if (message.includes("Please wait a moment")) {
        return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
      }
      if (message.includes("Initial bid must")) {
        return Response.json({ error: "Initial bid must be a whole dollar between $2 and $100,000." }, { status: 400 });
      }
      return Response.json({ error: "Could not start checkout." }, { status: 500 });
    }

    const created = pending as { id?: unknown; slug?: unknown };
    const productId = typeof created.id === "string" ? created.id : "";
    const slug = typeof created.slug === "string" ? created.slug : "";
    if (!productId || !slug) {
      return Response.json({ error: "Could not start checkout." }, { status: 500 });
    }

    const { data: inserted, error: insertError } = await admin
      .from("attention_bid_payments")
      .insert({
        user_id: null,
        product_id: productId,
        increment: parsed.increment,
        amount_cents: amountCents,
        currency: "USD",
        status: "pending",
        kind: "listing",
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return Response.json({ error: "Could not start checkout." }, { status: 500 });
    }

    return startDodoPaymentSession({
      admin,
      request,
      paymentId: inserted.id as string,
      productId,
      increment: parsed.increment,
      amountCents,
      returnPath: listingCheckoutReturnPath(),
    });
  } catch {
    return Response.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

async function startDodoPaymentSession(input: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  request: Request;
  paymentId: string;
  productId: string;
  increment: number;
  amountCents: number;
  returnPath: string;
}) {
  const returnUrl = `${checkoutOrigin(input.request)}${input.returnPath}`;
  try {
    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [
        {
          product_id: attentionBidProductId(),
          quantity: 1,
          amount: input.amountCents,
        },
      ],
      return_url: returnUrl,
      metadata: checkoutMetadata({
        payment_id: input.paymentId,
        product_id: input.productId,
        increment: input.increment,
      }),
      feature_flags: { redirect_immediately: true },
    });

    const checkoutUrl = session.checkout_url;
    const sessionId = session.session_id;
    if (!checkoutUrl || !sessionId) {
      throw new AttentionCheckoutError(502, "Could not start checkout.");
    }

    const { error: sessionError } = await input.admin
      .from("attention_bid_payments")
      .update({ dodo_session_id: sessionId })
      .eq("id", input.paymentId);
    if (sessionError) {
      throw new AttentionCheckoutError(500, "Could not start checkout.");
    }

    return Response.json({ checkout_url: checkoutUrl, payment_id: input.paymentId });
  } catch (error) {
    await input.admin.from("attention_bid_payments").update({ status: "failed" }).eq("id", input.paymentId);
    return Response.json({ error: jsonSafeError(error) }, { status: error instanceof AttentionCheckoutError ? error.status : 502 });
  }
}
