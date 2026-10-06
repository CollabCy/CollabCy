import { handleDodoWebhook } from "@/lib/attention-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleDodoWebhook(request);
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
