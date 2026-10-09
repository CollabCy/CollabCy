import DodoPayments from "dodopayments";
import {
  dodoPaymentsBaseUrlFor,
  dodoPaymentsEnvironmentFromValue,
  type DodoPaymentsEnvironment,
} from "@/lib/dodo-environment";

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

export function dodoPaymentsEnvironment(): DodoPaymentsEnvironment {
  assertServerOnly();
  return dodoPaymentsEnvironmentFromValue(process.env.DODO_PAYMENTS_ENVIRONMENT);
}

export function dodoPaymentsBaseUrl() {
  return dodoPaymentsBaseUrlFor(dodoPaymentsEnvironment());
}

let client: DodoPayments | undefined;
let clientEnvironment: DodoPaymentsEnvironment | undefined;

export function getDodoClient(): DodoPayments {
  assertServerOnly();
  const environment = dodoPaymentsEnvironment();
  if (client && clientEnvironment === environment) return client;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  client = new DodoPayments({
    bearerToken: requiredEnv("DODO_API_KEY"),
    environment,
    baseURL: null,
    webhookKey: webhookKey || undefined,
  });
  clientEnvironment = environment;
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
