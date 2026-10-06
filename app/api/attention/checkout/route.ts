import { createAttentionBidCheckout } from "@/lib/attention-checkout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createAttentionBidCheckout(request);
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
