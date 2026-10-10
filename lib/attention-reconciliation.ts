export const OCTOPUS_CANONICAL_LISTING_ID = "bc1d0cae-b355-42c4-b239-b3367ceb09ac";
export const OCTOPUS_SIX_DOLLAR_LISTING_ID = "364d6628-2904-4773-bf75-4c856b49fc11";
export const OCTOPUS_THIRD_DRAFT_LISTING_ID = "f387b38b-c6e2-4557-baf5-b4fb919cf774";
export const OCTOPUS_THREE_DOLLAR_PAYMENT_ID = "ead97d2d-ea48-4d65-8bb6-b5a46abc3617";
export const OCTOPUS_SIX_DOLLAR_PAYMENT_ID = "f82b060a-92f4-4948-ab2a-4a9aa0c0219e";
export const OCTOPUS_THIRD_PAYMENT_ID = "d88981fa-e386-41e6-b1e4-41a97a8fb76d";
export const OCTOPUS_SIX_DODO_PAYMENT_ID = "pay_0NpPxF3NRm5j1MjV1Ubez";
export const OCTOPUS_THREE_DODO_PAYMENT_ID = "pay_0NpPv0hEmViVlmah8ZZFB";

export type ReconciliationPayment = {
  id: string;
  product_id: string;
  increment: number;
  amount_cents: number;
  status: string;
  kind: string;
  dodo_payment_id: string | null;
};

export type ReconciliationProduct = {
  id: string;
  status: string;
  current_bid: number;
};

export function planOctopusXReconciliation(input: {
  products: ReconciliationProduct[];
  payments: ReconciliationPayment[];
}) {
  const blockers: string[] = [];
  const byId = Object.fromEntries(input.products.map((row) => [row.id, row]));
  const payById = Object.fromEntries(input.payments.map((row) => [row.id, row]));
  const sixPay = payById[OCTOPUS_SIX_DOLLAR_PAYMENT_ID];
  const threePay = payById[OCTOPUS_THREE_DOLLAR_PAYMENT_ID];
  const thirdPay = payById[OCTOPUS_THIRD_PAYMENT_ID];
  const canonical = byId[OCTOPUS_CANONICAL_LISTING_ID];
  const sixListing = byId[OCTOPUS_SIX_DOLLAR_LISTING_ID];
  const thirdListing = byId[OCTOPUS_THIRD_DRAFT_LISTING_ID];

  if (!canonical || canonical.status !== "active") blockers.push("canonical_listing_missing");
  if (!sixListing || sixListing.status !== "active") blockers.push("six_dollar_listing_missing");
  if (!threePay || threePay.status !== "applied" || threePay.product_id !== OCTOPUS_CANONICAL_LISTING_ID || threePay.increment !== 3) {
    blockers.push("three_dollar_payment_unverified");
  }
  if (
    !sixPay ||
    sixPay.status !== "applied" ||
    sixPay.product_id !== OCTOPUS_SIX_DOLLAR_LISTING_ID ||
    sixPay.increment !== 6 ||
    sixPay.dodo_payment_id !== OCTOPUS_SIX_DODO_PAYMENT_ID
  ) {
    blockers.push("six_dollar_payment_unverified");
  }
  if (threePay && threePay.dodo_payment_id && threePay.dodo_payment_id !== OCTOPUS_THREE_DODO_PAYMENT_ID) {
    blockers.push("three_dollar_dodo_mismatch");
  }
  if (canonical && canonical.current_bid !== 3) blockers.push("canonical_bid_unexpected");
  if (sixListing && sixListing.current_bid !== 6) blockers.push("six_dollar_bid_unexpected");
  if (thirdPay && (thirdPay.status === "paid" || thirdPay.status === "applied")) {
    blockers.push("third_checkout_has_successful_payment");
  }

  const hideThird = Boolean(thirdListing && thirdListing.status === "draft" && (!thirdPay || thirdPay.status === "pending"));
  const combinedBid = 9;
  return {
    safe: blockers.length === 0,
    blockers,
    canonicalListingId: OCTOPUS_CANONICAL_LISTING_ID,
    combinedBid,
    hideListingIds: [OCTOPUS_SIX_DOLLAR_LISTING_ID, ...(hideThird ? [OCTOPUS_THIRD_DRAFT_LISTING_ID] : [])],
    leavePaymentsApplied: [OCTOPUS_THREE_DOLLAR_PAYMENT_ID, OCTOPUS_SIX_DOLLAR_PAYMENT_ID],
    creditIncrement: 6,
  };
}
