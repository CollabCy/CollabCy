import DodoPayments from "dodopayments";

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Dodo client is server-only.");
  }
}

function requiredEnv(name: "DODO_API_KEY" | "DODO_ATTENTION_BID_PRODUCT_ID") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Payment provider is not configured.");
  return value;
}

let client: DodoPayments | undefined;

export function getDodoClient(): DodoPayments {
  assertServerOnly();
  if (client) return client;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  client = new DodoPayments({
    bearerToken: requiredEnv("DODO_API_KEY"),
    environment: "test_mode",
    webhookKey: webhookKey || undefined,
  });
  return client;
}

export function attentionBidProductId() {
  assertServerOnly();
  return requiredEnv("DODO_ATTENTION_BID_PRODUCT_ID");
}

export function dodoWebhookKey() {
  assertServerOnly();
  const value = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!value) throw new Error("Payment webhook is not configured.");
  return value;
}
