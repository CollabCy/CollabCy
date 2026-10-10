import { safeWebsite } from "@/app/attention/model";
import { ALREADY_LISTED_MESSAGE, ALREADY_PENDING_MESSAGE, alreadyListedBidPath } from "@/lib/attention-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Add a valid website." }, { status: 400 });
  }

  const rawWebsite =
    body && typeof body === "object" && "website_url" in body
      ? (body as { website_url?: unknown }).website_url
      : null;
  const website = typeof rawWebsite === "string" ? safeWebsite(rawWebsite) : null;
  if (!website) {
    return Response.json({ error: "Add a valid website." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("find_attention_listing_by_website", {
    p_website_url: website,
  });
  if (error || !data || typeof data !== "object") {
    return Response.json({ error: "Could not check this website." }, { status: 500 });
  }

  const result = data as { ok?: unknown; reason?: unknown; id?: unknown; slug?: unknown; status?: unknown };
  if (result.ok !== false || result.reason !== "already_listed") {
    return Response.json({ already_listed: false });
  }
  const productId = typeof result.id === "string" ? result.id : "";
  const slug = typeof result.slug === "string" ? result.slug : "";
  const status = result.status === "active" || result.status === "draft" ? result.status : "";
  if (!productId || !slug || !status) {
    return Response.json({ error: "Could not check this website." }, { status: 500 });
  }

  return Response.json({
    error: status === "active" ? ALREADY_LISTED_MESSAGE : ALREADY_PENDING_MESSAGE,
    already_listed: true,
    product_id: productId,
    slug,
    status,
    bid_path: status === "active" ? alreadyListedBidPath(slug) : null,
  });
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
