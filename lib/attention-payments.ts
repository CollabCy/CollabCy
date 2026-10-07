import { isAttentionProductId, validateAttentionIncrement } from "../app/attention/validation";
import type { Bid, Product } from "../app/attention/model";

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
  const value = body as { product_id?: unknown; increment?: unknown; user_id?: unknown; amount?: unknown; amount_cents?: unknown };
  if ("user_id" in value || "amount" in value || "amount_cents" in value) {
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

export function checkoutReturnPath(slug: string) {
  return `/discover/product/${encodeURIComponent(slug)}?paid=1`;
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

export function extractPaymentSucceeded(event: unknown): {
  type: string;
  payment_id: string;
  checkout_session_id: string | null;
  total_amount: number;
  currency: string;
  metadata: Record<string, string>;
} | null {
  if (!event || typeof event !== "object") return null;
  const payload = event as { type?: unknown; data?: unknown };
  const type = typeof payload.type === "string" ? payload.type : "";
  if (!payload.data || typeof payload.data !== "object") {
    return { type, payment_id: "", checkout_session_id: null, total_amount: 0, currency: "", metadata: {} };
  }
  const data = payload.data as Record<string, unknown>;
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : typeof data.id === "string" ? data.id : "";
  const sessionId = typeof data.checkout_session_id === "string" ? data.checkout_session_id : null;
  const totalAmount = typeof data.total_amount === "number" ? data.total_amount : Number(data.total_amount);
  const currency = typeof data.currency === "string" ? data.currency : "";
  return {
    type,
    payment_id: paymentId,
    checkout_session_id: sessionId,
    total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
    currency,
    metadata: asMetadataRecord(data.metadata),
  };
}

export function paidAmountMatches(amountCents: number, paidAmount: number, currency: string) {
  return amountCents > 0 && paidAmount === amountCents && currency.toUpperCase() === ATTENTION_BID_CURRENCY;
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
}): "ignore_event" | "reject_mismatch" | "already_applied" | "continue_apply" | "mark_paid_and_apply" {
  if (!isPaymentSucceededEvent(input.eventType)) return "ignore_event";
  if (input.paymentStatus === "applied") return "already_applied";
  if (!input.metadataMatch || !paidAmountMatches(input.amountCents, input.paidAmount, input.currency)) {
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
