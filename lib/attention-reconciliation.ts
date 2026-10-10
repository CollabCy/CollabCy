export const OCTOPUS_CANONICAL_LISTING_ID = "bc1d0cae-b355-42c4-b239-b3367ceb09ac";
export const OCTOPUS_SIX_DOLLAR_LISTING_ID = "364d6628-2904-4773-bf75-4c856b49fc11";
export const OCTOPUS_THIRD_DRAFT_LISTING_ID = "f387b38b-c6e2-4557-baf5-b4fb919cf774";
export const OCTOPUS_THREE_DOLLAR_PAYMENT_ID = "ead97d2d-ea48-4d65-8bb6-b5a46abc3617";
export const OCTOPUS_SIX_DOLLAR_PAYMENT_ID = "f82b060a-92f4-4948-ab2a-4a9aa0c0219e";
export const OCTOPUS_THIRD_PAYMENT_ID = "d88981fa-e386-41e6-b1e4-41a97a8fb76d";
export const OCTOPUS_SIX_DODO_PAYMENT_ID = "pay_0NpPxF3NRm5j1MjV1Ubez";
export const OCTOPUS_THREE_DODO_PAYMENT_ID = "pay_0NpPv0hEmViVlmah8ZZFB";
export const OCTOPUS_THREE_APPLIED_BID_ID = "09d001a7-dc99-46d1-ae0e-4603668bee71";
export const OCTOPUS_SIX_APPLIED_BID_ID = "9c3fba34-c7e0-48fc-8091-3e78a9d59ada";
export const OCTOPUS_THIRD_SESSION_ID = "cks_0NpPvrD03A4XYEL4OIrQU";
export const OCTOPUS_RECONCILE_SQL_PATH = "supabase/sql/octopusx_reconcile_and_unique_website.sql";

export type ReconciliationPayment = {
  id: string;
  product_id: string;
  increment: number;
  amount_cents: number;
  status: string;
  kind: string;
  dodo_payment_id: string | null;
  webhook_id?: string | null;
  applied_bid_id?: string | null;
  dodo_session_id?: string | null;
};

export type ReconciliationProduct = {
  id: string;
  status: string;
  current_bid: number;
};

export type ReconciliationBid = { id: string; product_id: string; amount: number };
export type ReconciliationActivity = { product_id: string; type: string; amount: number | null };

function paymentById(payments: ReconciliationPayment[], id: string) {
  return payments.find((row) => row.id === id);
}

function productById(products: ReconciliationProduct[], id: string) {
  return products.find((row) => row.id === id);
}

export function planOctopusXReconciliation(input: {
  products: ReconciliationProduct[];
  payments: ReconciliationPayment[];
  bids?: ReconciliationBid[];
  activity?: ReconciliationActivity[];
}) {
  const blockers: string[] = [];
  const sixPay = paymentById(input.payments, OCTOPUS_SIX_DOLLAR_PAYMENT_ID);
  const threePay = paymentById(input.payments, OCTOPUS_THREE_DOLLAR_PAYMENT_ID);
  const thirdPay = paymentById(input.payments, OCTOPUS_THIRD_PAYMENT_ID);
  const canonical = productById(input.products, OCTOPUS_CANONICAL_LISTING_ID);
  const sixListing = productById(input.products, OCTOPUS_SIX_DOLLAR_LISTING_ID);
  const thirdListing = productById(input.products, OCTOPUS_THIRD_DRAFT_LISTING_ID);

  if (!canonical || canonical.status !== "active") blockers.push("canonical_listing_missing");
  if (!sixListing || (sixListing.status !== "active" && sixListing.status !== "hidden")) blockers.push("six_dollar_listing_missing");
  if (
    !threePay ||
    threePay.status !== "applied" ||
    threePay.product_id !== OCTOPUS_CANONICAL_LISTING_ID ||
    threePay.kind !== "listing" ||
    threePay.increment !== 3 ||
    threePay.amount_cents !== 300 ||
    threePay.dodo_payment_id !== OCTOPUS_THREE_DODO_PAYMENT_ID ||
    threePay.applied_bid_id !== OCTOPUS_THREE_APPLIED_BID_ID
  ) {
    blockers.push("three_dollar_payment_unverified");
  }
  if (
    !sixPay ||
    sixPay.status !== "applied" ||
    sixPay.product_id !== OCTOPUS_SIX_DOLLAR_LISTING_ID ||
    sixPay.kind !== "listing" ||
    sixPay.increment !== 6 ||
    sixPay.amount_cents !== 600 ||
    sixPay.dodo_payment_id !== OCTOPUS_SIX_DODO_PAYMENT_ID ||
    sixPay.applied_bid_id !== OCTOPUS_SIX_APPLIED_BID_ID
  ) {
    blockers.push("six_dollar_payment_unverified");
  }
  if (canonical && canonical.current_bid !== 3 && canonical.current_bid !== 9) blockers.push("canonical_bid_unexpected");
  if (sixListing && sixListing.current_bid !== 6) blockers.push("six_dollar_bid_unexpected");
  if (thirdPay && (thirdPay.status === "paid" || thirdPay.status === "applied" || thirdPay.dodo_payment_id || thirdPay.webhook_id || thirdPay.applied_bid_id)) {
    blockers.push("third_checkout_has_successful_payment");
  }
  if (thirdPay && (thirdPay.status !== "pending" && thirdPay.status !== "expired" || thirdPay.kind !== "listing" || thirdPay.dodo_session_id !== OCTOPUS_THIRD_SESSION_ID)) {
    blockers.push("third_payment_unexpected");
  }
  if (thirdListing && thirdListing.status !== "draft" && thirdListing.status !== "hidden") blockers.push("third_listing_unexpected");
  const canonicalBids = (input.bids ?? []).filter((row) => row.product_id === OCTOPUS_CANONICAL_LISTING_ID);
  const nineBids = canonicalBids.filter((row) => row.amount === 9);
  const nineActivity = (input.activity ?? []).filter((row) => row.product_id === OCTOPUS_CANONICAL_LISTING_ID && row.type === "bid" && row.amount === 9);
  if (canonical?.current_bid === 3 && (canonicalBids.length !== 1 || nineBids.length !== 0 || nineActivity.length !== 0)) {
    blockers.push("canonical_history_unexpected");
  }
  if (canonical?.current_bid === 9 && (canonicalBids.length !== 2 || nineBids.length !== 1 || nineActivity.length !== 1)) {
    blockers.push("canonical_history_unexpected");
  }

  const alreadyCredited = Boolean(canonical && canonical.current_bid === 9);
  const hideThird = Boolean(
    thirdListing &&
    (thirdListing.status === "draft" || thirdListing.status === "hidden") &&
    thirdPay &&
    (thirdPay.status === "pending" || thirdPay.status === "expired") &&
    !thirdPay.dodo_payment_id &&
    !thirdPay.webhook_id &&
    !thirdPay.applied_bid_id,
  );

  return {
    safe: blockers.length === 0,
    blockers,
    canonicalListingId: OCTOPUS_CANONICAL_LISTING_ID,
    combinedBid: 9,
    alreadyCredited,
    hideListingIds: [OCTOPUS_SIX_DOLLAR_LISTING_ID, ...(hideThird ? [OCTOPUS_THIRD_DRAFT_LISTING_ID] : [])],
    leavePaymentsApplied: [OCTOPUS_THREE_DOLLAR_PAYMENT_ID, OCTOPUS_SIX_DOLLAR_PAYMENT_ID],
    creditIncrement: 6,
  };
}

export function applyOctopusXReconciliation(input: {
  products: ReconciliationProduct[];
  payments: ReconciliationPayment[];
  bids: ReconciliationBid[];
  activity: ReconciliationActivity[];
}) {
  const plan = planOctopusXReconciliation(input);
  if (!plan.safe) return { ok: false as const, reason: plan.blockers.join(","), world: input, credited: false };

  const products = input.products.map((row) => ({ ...row }));
  const payments = input.payments.map((row) => ({ ...row }));
  const bids = input.bids.map((row) => ({ ...row }));
  const activity = input.activity.map((row) => ({ ...row }));
  const canonical = products.find((row) => row.id === OCTOPUS_CANONICAL_LISTING_ID)!;
  const sixListing = products.find((row) => row.id === OCTOPUS_SIX_DOLLAR_LISTING_ID)!;
  const thirdListing = products.find((row) => row.id === OCTOPUS_THIRD_DRAFT_LISTING_ID);
  const hasNineBid = bids.some((row) => row.product_id === OCTOPUS_CANONICAL_LISTING_ID && row.amount === 9);
  let credited = false;

  if (canonical.current_bid === 3) {
    if (hasNineBid) return { ok: false as const, reason: "nine_bid_exists_while_current_is_three", world: input, credited: false };
    canonical.current_bid = 9;
    bids.push({ id: "recon-9", product_id: OCTOPUS_CANONICAL_LISTING_ID, amount: 9 });
    activity.push({ product_id: OCTOPUS_CANONICAL_LISTING_ID, type: "bid", amount: 9 });
    credited = true;
  } else if (canonical.current_bid === 9) {
    if (!hasNineBid) return { ok: false as const, reason: "current_is_nine_without_nine_bid", world: input, credited: false };
  }

  sixListing.status = "hidden";
  if (thirdListing && plan.hideListingIds.includes(OCTOPUS_THIRD_DRAFT_LISTING_ID)) thirdListing.status = "hidden";

  const sixPay = payments.find((row) => row.id === OCTOPUS_SIX_DOLLAR_PAYMENT_ID)!;
  const threePay = payments.find((row) => row.id === OCTOPUS_THREE_DOLLAR_PAYMENT_ID)!;
  if (sixPay.status !== "applied" || sixPay.dodo_payment_id !== OCTOPUS_SIX_DODO_PAYMENT_ID) {
    return { ok: false as const, reason: "successful_payment_mutated", world: input, credited: false };
  }
  if (threePay.status !== "applied" || threePay.dodo_payment_id !== OCTOPUS_THREE_DODO_PAYMENT_ID) {
    return { ok: false as const, reason: "successful_payment_mutated", world: input, credited: false };
  }

  return { ok: true as const, reason: credited ? "credited" : "already_reconciled", world: { products, payments, bids, activity }, credited };
}

export function productionOctopusXSnapshot(): {
  products: ReconciliationProduct[];
  payments: ReconciliationPayment[];
  bids: ReconciliationBid[];
  activity: ReconciliationActivity[];
} {
  return {
    products: [
      { id: OCTOPUS_CANONICAL_LISTING_ID, status: "active", current_bid: 3 },
      { id: OCTOPUS_SIX_DOLLAR_LISTING_ID, status: "active", current_bid: 6 },
      { id: OCTOPUS_THIRD_DRAFT_LISTING_ID, status: "draft", current_bid: 0 },
    ],
    payments: [
      {
        id: OCTOPUS_THREE_DOLLAR_PAYMENT_ID,
        product_id: OCTOPUS_CANONICAL_LISTING_ID,
        increment: 3,
        amount_cents: 300,
        status: "applied",
        kind: "listing",
        dodo_payment_id: OCTOPUS_THREE_DODO_PAYMENT_ID,
        applied_bid_id: OCTOPUS_THREE_APPLIED_BID_ID,
      },
      {
        id: OCTOPUS_SIX_DOLLAR_PAYMENT_ID,
        product_id: OCTOPUS_SIX_DOLLAR_LISTING_ID,
        increment: 6,
        amount_cents: 600,
        status: "applied",
        kind: "listing",
        dodo_payment_id: OCTOPUS_SIX_DODO_PAYMENT_ID,
        applied_bid_id: OCTOPUS_SIX_APPLIED_BID_ID,
      },
      {
        id: OCTOPUS_THIRD_PAYMENT_ID,
        product_id: OCTOPUS_THIRD_DRAFT_LISTING_ID,
        increment: 6,
        amount_cents: 600,
        status: "pending",
        kind: "listing",
        dodo_payment_id: null,
        webhook_id: null,
        applied_bid_id: null,
        dodo_session_id: OCTOPUS_THIRD_SESSION_ID,
      },
    ],
    bids: [
      { id: OCTOPUS_SIX_APPLIED_BID_ID, product_id: OCTOPUS_SIX_DOLLAR_LISTING_ID, amount: 6 },
      { id: OCTOPUS_THREE_APPLIED_BID_ID, product_id: OCTOPUS_CANONICAL_LISTING_ID, amount: 3 },
    ],
    activity: [
      { product_id: OCTOPUS_SIX_DOLLAR_LISTING_ID, type: "listing", amount: 6 },
      { product_id: OCTOPUS_CANONICAL_LISTING_ID, type: "listing", amount: 3 },
    ],
  };
}
