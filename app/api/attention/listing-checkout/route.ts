import { createAttentionListingCheckout } from "@/lib/attention-checkout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createAttentionListingCheckout(request);
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
