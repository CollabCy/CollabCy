import { validateBid } from "@/app/attention/model";
import {
  amountCentsFromIncrement,
  checkoutMetadata,
  checkoutReturnPath,
  parseCheckoutBody,
  rankingProductsFromRows,
  type RankingProductRow,
} from "@/lib/attention-payments";
import { attentionBidProductId, getDodoClient } from "@/lib/dodo";
import { getRequestAuthUser, getSupabaseAdmin } from "@/lib/supabase-admin";
import type { User } from "@supabase/supabase-js";
import type { Bid } from "@/app/attention/model";

export class AttentionCheckoutError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AttentionCheckoutError";
  }
}

function jsonSafeError(error: unknown) {
  return error instanceof AttentionCheckoutError ? error.message : "Could not start checkout.";
}

function customerFromUser(user: User) {
  const email = user.email?.trim();
  if (!email) return undefined;
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    email;
  return { email, name };
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
    const user = await getRequestAuthUser(request);
    if (!user) {
      return Response.json({ error: "Sign in to place a bid." }, { status: 401 });
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
        user_id: user.id,
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
    const returnUrl = `${checkoutOrigin(request)}${checkoutReturnPath(product.slug)}`;

    try {
      const session = await getDodoClient().checkoutSessions.create({
        product_cart: [
          {
            product_id: attentionBidProductId(),
            quantity: 1,
            amount: amountCents,
          },
        ],
        return_url: returnUrl,
        customer: customerFromUser(user),
        metadata: checkoutMetadata({
          payment_id: paymentId,
          product_id: parsed.product_id,
          user_id: user.id,
          increment: parsed.increment,
        }),
        feature_flags: { redirect_immediately: true },
      });

      const checkoutUrl = session.checkout_url;
      const sessionId = session.session_id;
      if (!checkoutUrl || !sessionId) {
        throw new AttentionCheckoutError(502, "Could not start checkout.");
      }

      const { error: sessionError } = await admin
        .from("attention_bid_payments")
        .update({ dodo_session_id: sessionId })
        .eq("id", paymentId);
      if (sessionError) {
        throw new AttentionCheckoutError(500, "Could not start checkout.");
      }

      return Response.json({ checkout_url: checkoutUrl, payment_id: paymentId });
    } catch (error) {
      await admin.from("attention_bid_payments").update({ status: "failed" }).eq("id", paymentId);
      return Response.json({ error: jsonSafeError(error) }, { status: error instanceof AttentionCheckoutError ? error.status : 502 });
    }
  } catch {
    return Response.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
