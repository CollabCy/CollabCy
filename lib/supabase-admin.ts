import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client is server-only.");
  }
}

function publicSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("Marketplace backend is not configured.");
  return value;
}

let admin: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  assertServerOnly();
  if (admin) return admin;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("Marketplace backend is not configured.");
  admin = createClient(publicSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export async function getRequestAuthUser(request: Request): Promise<User | null> {
  assertServerOnly();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!anonKey || !token) return null;
  const supabase = createClient(publicSupabaseUrl(), anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user;
}
