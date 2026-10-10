import { isAttentionProductId, validateAttentionIncrement } from "../app/attention/validation";
import { safeWebsite, type Bid, type Product } from "../app/attention/model";

export const ATTENTION_BID_CURRENCY = "USD";
export const MIN_PAID_BID_INCREMENT = 2;
export const ATTENTION_BID_PAYMENT_STATUSES = ["pending", "paid", "applied", "failed", "expired"] as const;
export type AttentionBidPaymentStatus = (typeof ATTENTION_BID_PAYMENT_STATUSES)[number];

export function amountCentsFromIncrement(increment: number) {
  return increment * 100;
}

export function validatePaidBidIncrement(increment: number) {
  const incrementError = validateAttentionIncrement(increment);
  if (incrementError) return incrementError;
  if (increment < MIN_PAID_BID_INCREMENT) return `Enter at least $${MIN_PAID_BID_INCREMENT}.`;
  return "";
}

export function parseCheckoutBody(body: unknown): { product_id: string; increment: number } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Enter a valid bid amount." };
  const value = body as { product_id?: unknown; increment?: unknown; user_id?: unknown; amount?: unknown; amount_cents?: unknown; listing?: unknown };
  if ("user_id" in value || "amount" in value || "amount_cents" in value || "listing" in value) {
    return { error: "Enter a valid bid amount." };
  }
  if (typeof value.product_id !== "string" || !isAttentionProductId(value.product_id)) {
    return { error: "Product not found." };
  }
  const increment = typeof value.increment === "number" ? value.increment : Number(value.increment);
  const incrementError = validatePaidBidIncrement(increment);
  if (incrementError) return { error: incrementError };
  return { product_id: value.product_id, increment };
}

export type ListingCheckoutFields = {
  name: string;
  websiteUrl: string;
  description: string;
  category: string;
  logo?: string;
  brandName?: string;
};

export function parseListingCheckoutBody(body: unknown): { listing: ListingCheckoutFields; increment: number } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Enter a valid bid amount." };
  const value = body as {
    listing?: unknown;
    increment?: unknown;
    initial_bid?: unknown;
    product_id?: unknown;
    user_id?: unknown;
    amount?: unknown;
    amount_cents?: unknown;
  };
  if ("user_id" in value || "amount" in value || "amount_cents" in value || "product_id" in value) {
    return { error: "Enter a valid bid amount." };
  }
  if (!value.listing || typeof value.listing !== "object") {
    return { error: "Add a product name, description, category, and valid website." };
  }
  const listing = value.listing as Record<string, unknown>;
  const incrementSource = value.increment ?? value.initial_bid ?? listing.initialBid ?? listing.initial_bid;
  const increment = typeof incrementSource === "number" ? incrementSource : Number(incrementSource);
  const incrementError = validatePaidBidIncrement(increment);
  if (incrementError) return { error: incrementError };
  const rawWebsite = typeof listing.websiteUrl === "string" ? listing.websiteUrl : typeof listing.website_url === "string" ? listing.website_url : "";
  return {
    listing: {
      name: typeof listing.name === "string" ? listing.name : "",
      websiteUrl: safeWebsite(rawWebsite) || rawWebsite,
      description: typeof listing.description === "string" ? listing.description : "",
      category: typeof listing.category === "string" ? listing.category : "",
      logo: typeof listing.logo === "string" ? listing.logo : undefined,
      brandName: typeof listing.brandName === "string" ? listing.brandName : typeof listing.brand_name === "string" ? listing.brand_name : undefined,
    },
    increment,
  };
}

export function checkoutReturnPath(slug: string) {
  return `/discover/product/${encodeURIComponent(slug)}?paid=1`;
}

export function listingCheckoutReturnPath() {
  return "/?paid=1";
}

export const ALREADY_LISTED_MESSAGE =
  "Already listed — this website is already on CollabCy. Bid more on the existing listing to increase its position.";
export const ALREADY_PENDING_MESSAGE =
  "Already listed — this website already has a pending listing checkout.";

export function alreadyListedBidPath(slug: string) {
  return `/discover/product/${encodeURIComponent(slug)}?bid=1`;
}

export function checkoutMetadata(input: {
  payment_id: string;
  product_id: string;
  increment: number;
}): Record<string, string> {
  return {
    payment_id: input.payment_id,
    product_id: input.product_id,
    increment: String(input.increment),
  };
}

export function isPaymentSucceededEvent(type: unknown) {
  return type === "payment.succeeded";
}

export function browserReturnDoesNotApplyBid(_paidQuery: string | null) {
  return true;
}

export type RankingProductRow = {
  id: string;
  slug: string;
  status: string;
  current_bid: number;
  listing_starts_at: string | null;
  listing_ends_at: string | null;
};

export function rankingProductsFromRows(
  rows: RankingProductRow[],
  latestBids: Record<string, Bid>,
  now = Date.now(),
): Product[] {
  return rows.map((row) => {
    const listingStartsAt = row.listing_starts_at ? Date.parse(row.listing_starts_at) : 0;
    const listingEndsAt = row.listing_ends_at ? Date.parse(row.listing_ends_at) : 0;
    const bid = latestBids[row.id];
    const product: Product = {
      id: row.id,
      brandId: "",
      brandName: "",
      name: row.slug,
      slug: row.slug,
      logo: "P",
      color: "#3267e8",
      websiteUrl: "https://example.com",
      description: "",
      category: "Other",
      tags: [],
      currentBid: row.current_bid,
      clickCount: 0,
      visitTimes: [],
      status: row.status === "active" ? "active" : "expired",
      listingStartsAt: Number.isFinite(listingStartsAt) ? listingStartsAt : 0,
      listingEndsAt: Number.isFinite(listingEndsAt) ? listingEndsAt : 0,
      bids: bid ? [bid] : [],
    };
    if (now < product.listingStartsAt || (product.listingEndsAt > 0 && now >= product.listingEndsAt)) product.status = "expired";
    return product;
  });
}

export function asMetadataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" && item) record[key] = item;
    else if (typeof item === "number" && Number.isFinite(item)) record[key] = String(item);
  }
  return record;
}

function asFiniteAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export type DodoProductCartItem = { product_id?: string };

export function asProductCart(value: unknown): DodoProductCartItem[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  return value.map((item) => {
    if (!item || typeof item !== "object") return {};
    const productId = (item as { product_id?: unknown }).product_id;
    return typeof productId === "string" && productId ? { product_id: productId } : {};
  });
}

function cartContainsConfiguredProduct(cart: DodoProductCartItem[] | null | undefined, dodoProductId: string) {
  if (!Array.isArray(cart) || cart.length === 0 || !dodoProductId) return false;
  return cart.some((item) => item?.product_id === dodoProductId);
}

export function extractPaymentSucceeded(event: unknown): {
  type: string;
  payment_id: string;
  checkout_session_id: string | null;
  total_amount: number;
  currency: string;
  settlement_amount: number;
  settlement_currency: string;
  metadata: Record<string, string>;
  product_cart: DodoProductCartItem[] | null;
} | null {
  if (!event || typeof event !== "object") return null;
  const payload = event as { type?: unknown; data?: unknown };
  const type = typeof payload.type === "string" ? payload.type : "";
  if (!payload.data || typeof payload.data !== "object") {
    return {
      type,
      payment_id: "",
      checkout_session_id: null,
      total_amount: 0,
      currency: "",
      settlement_amount: 0,
      settlement_currency: "",
      metadata: {},
      product_cart: null,
    };
  }
  const data = payload.data as Record<string, unknown>;
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : typeof data.id === "string" ? data.id : "";
  const sessionId = typeof data.checkout_session_id === "string" ? data.checkout_session_id : null;
  const currency = typeof data.currency === "string" ? data.currency : "";
  const settlementCurrency = typeof data.settlement_currency === "string" ? data.settlement_currency : "";
  return {
    type,
    payment_id: paymentId,
    checkout_session_id: sessionId,
    total_amount: asFiniteAmount(data.total_amount),
    currency,
    settlement_amount: asFiniteAmount(data.settlement_amount),
    settlement_currency: settlementCurrency,
    metadata: asMetadataRecord(data.metadata),
    product_cart: asProductCart(data.product_cart),
  };
}

export type PaidAmountClass = "usd_match" | "usd_settlement" | "converted" | "mismatch";

function isIsoCurrency(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

export function classifyPaidAmount(
  amountCents: number,
  paidAmount: number,
  currency: string,
  settlement?: { amount?: number; currency?: string },
): PaidAmountClass {
  if (!(amountCents > 0) || !(paidAmount > 0)) return "mismatch";
  const charged = (currency || "").toUpperCase();
  if (!isIsoCurrency(charged)) return "mismatch";
  if (charged === ATTENTION_BID_CURRENCY) return paidAmount === amountCents ? "usd_match" : "mismatch";
  const settledCurrency = (settlement?.currency || "").toUpperCase();
  const settledAmount = settlement?.amount;
  // Settlement is the merchant credit, not the original listing price. Dodo
  // fees make it differ from amount_cents (INR example: 236 vs 200). There is
  // no safe expected FX amount, so any positive USD settlement is accepted
  // here; claim_paid_attention_bid_payment still enforces stored amount_cents.
  if (
    settledCurrency === ATTENTION_BID_CURRENCY &&
    typeof settledAmount === "number" &&
    Number.isFinite(settledAmount) &&
    settledAmount > 0
  ) {
    return "usd_settlement";
  }
  return "converted";
}

export function paidAmountMatches(
  amountCents: number,
  paidAmount: number,
  currency: string,
  settlement?: { amount?: number; currency?: string },
) {
  const kind = classifyPaidAmount(amountCents, paidAmount, currency, settlement);
  return kind === "usd_match" || kind === "usd_settlement";
}

export function convertedPaymentMatches(input: {
  dodoPaymentId: string;
  checkoutSessionId: string | null;
  metadata: Record<string, string>;
  dodoProductId: string;
  payment: {
    payment_id?: string;
    status?: string | null;
    checkout_session_id?: string | null;
    metadata?: unknown;
    product_cart?: Array<{ product_id?: string }> | null;
    total_amount?: unknown;
    currency?: string | null;
  };
  webhookProductCart?: DodoProductCartItem[] | null;
}) {
  if (!input.dodoPaymentId || !input.checkoutSessionId || !input.dodoProductId) return false;
  if (input.payment.payment_id !== input.dodoPaymentId) return false;
  if (input.payment.status !== "succeeded") return false;
  if (input.payment.checkout_session_id !== input.checkoutSessionId) return false;
  if (!isIsoCurrency((input.payment.currency || "").toUpperCase())) return false;
  if (!(asFiniteAmount(input.payment.total_amount) > 0)) return false;
  const retrieved = asMetadataRecord(input.payment.metadata);
  if (
    retrieved.payment_id !== input.metadata.payment_id ||
    retrieved.product_id !== input.metadata.product_id ||
    retrieved.increment !== input.metadata.increment
  ) {
    return false;
  }
  const retrievedCart = input.payment.product_cart;
  if (Array.isArray(retrievedCart) && retrievedCart.length > 0) {
    return cartContainsConfiguredProduct(retrievedCart, input.dodoProductId);
  }
  return cartContainsConfiguredProduct(input.webhookProductCart, input.dodoProductId);
}

export function metadataMatchesPending(row: {
  id: string;
  user_id: string | null;
  product_id: string;
  increment: number;
}, metadata: Record<string, string>) {
  const metadataUser = metadata.user_id || null;
  const rowUser = row.user_id || null;
  return (
    metadata.payment_id === row.id &&
    metadataUser === rowUser &&
    metadata.product_id === row.product_id &&
    metadata.increment === String(row.increment)
  );
}

export function fulfillmentAction(input: {
  eventType: string;
  paymentStatus: AttentionBidPaymentStatus | string;
  webhookId: string;
  existingWebhookId: string | null;
  dodoPaymentId: string;
  existingDodoPaymentId: string | null;
  amountCents: number;
  paidAmount: number;
  currency: string;
  metadataMatch: boolean;
  settlement?: { amount?: number; currency?: string };
  convertedConfirmed?: boolean;
}): "ignore_event" | "reject_mismatch" | "already_applied" | "continue_apply" | "mark_paid_and_apply" {
  if (!isPaymentSucceededEvent(input.eventType)) return "ignore_event";
  if (input.paymentStatus === "applied") return "already_applied";
  const amountClass = classifyPaidAmount(input.amountCents, input.paidAmount, input.currency, input.settlement);
  if (
    !input.metadataMatch ||
    amountClass === "mismatch" ||
    (amountClass === "converted" && !input.convertedConfirmed)
  ) {
    return "reject_mismatch";
  }
  if (
    (input.existingWebhookId && input.existingWebhookId === input.webhookId) ||
    (input.existingDodoPaymentId && input.existingDodoPaymentId === input.dodoPaymentId)
  ) {
    return input.paymentStatus === "paid" ? "continue_apply" : "already_applied";
  }
  if (input.paymentStatus === "paid") return "continue_apply";
  if (input.paymentStatus === "pending") return "mark_paid_and_apply";
  return "reject_mismatch";
}

export function dodoWebhookHeaders(headers: Headers): Record<string, string> {
  return {
    "webhook-id": headers.get("webhook-id") || "",
    "webhook-signature": headers.get("webhook-signature") || "",
    "webhook-timestamp": headers.get("webhook-timestamp") || "",
  };
}
