/** Official `dodopayments@2.52.0` ClientOptions.environment hosts. */
export const DODO_SDK_BASE_URLS = {
  live_mode: "https://live.dodopayments.com",
  test_mode: "https://test.dodopayments.com",
} as const;

export type DodoPaymentsEnvironment = keyof typeof DODO_SDK_BASE_URLS;

export function dodoPaymentsEnvironmentFromValue(value: string | undefined): DodoPaymentsEnvironment {
  const environment = value?.trim();
  if (environment === "live_mode" || environment === "test_mode") return environment;
  throw new Error("Payment provider is not configured.");
}

export function dodoPaymentsBaseUrlFor(environment: DodoPaymentsEnvironment) {
  return DODO_SDK_BASE_URLS[environment];
}
