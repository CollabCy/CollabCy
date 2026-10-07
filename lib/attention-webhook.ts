import {
  extractPaymentSucceeded,
  isPaymentSucceededEvent,
  paidAmountMatches,
  dodoWebhookHeaders,
} from "@/lib/attention-payments";
import { dodoWebhookKey, getDodoClient } from "@/lib/dodo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function rpcRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function handleDodoWebhook(request: Request): Promise<Response> {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Invalid webhook." }, { status: 400 });
  }

  const webhookId = request.headers.get("webhook-id") || "";
  let event: unknown;
  try {
    const key = dodoWebhookKey();
    event = getDodoClient().webhooks.unwrap(rawBody, {
      headers: dodoWebhookHeaders(request.headers),
      key,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not configured")) {
      return Response.json({ error: "Webhook is not configured." }, { status: 500 });
    }
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const extracted = extractPaymentSucceeded(event);
  if (!extracted || !isPaymentSucceededEvent(extracted.type)) {
    return Response.json({ received: true, ignored: true });
  }

  const paymentId = extracted.metadata.payment_id;
  const productId = extracted.metadata.product_id;
  const increment = Number(extracted.metadata.increment);
  if (!webhookId || !paymentId || !extracted.payment_id || !productId || !Number.isInteger(increment) || increment <= 0) {
    return Response.json({ error: "Invalid payment event." }, { status: 400 });
  }
  if (!paidAmountMatches(increment * 100, extracted.total_amount, extracted.currency)) {
    return Response.json({ error: "Payment amount mismatch." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: claimed, error: claimError } = await admin.rpc("claim_paid_attention_bid_payment", {
    p_payment_id: paymentId,
    p_dodo_payment_id: extracted.payment_id,
    p_dodo_session_id: extracted.checkout_session_id,
    p_webhook_id: webhookId,
    p_amount_cents: increment * 100,
    p_currency: extracted.currency.toUpperCase(),
    p_user_id: null,
    p_product_id: productId,
    p_increment: increment,
  });

  if (claimError) {
    return Response.json({ error: "Could not record payment." }, { status: 500 });
  }

  const claim = rpcRecord(claimed);
  const reason = typeof claim.reason === "string" ? claim.reason : "";
  if (claim.ok !== true) {
    const status = reason === "not_found" ? 404 : 409;
    return Response.json({ error: "Could not record payment.", reason }, { status });
  }
  if (reason === "already_applied") {
    return Response.json({ received: true, result: "already_applied" });
  }

  const { data: applied, error: applyError } = await admin.rpc("apply_paid_attention_bid", {
    p_payment_id: paymentId,
  });
  if (applyError) {
    return Response.json({ error: "Could not apply bid." }, { status: 500 });
  }

  const result = rpcRecord(applied);
  const applyReason = typeof result.reason === "string" ? result.reason : "";
  if (result.ok === true) {
    return Response.json({ received: true, result: applyReason || "applied" });
  }
  if (applyReason === "product_inactive" || applyReason === "bid_cap") {
    return Response.json({ received: true, result: applyReason });
  }
  return Response.json({ error: "Could not apply bid.", reason: applyReason }, { status: 500 });
}
