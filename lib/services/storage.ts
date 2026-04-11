import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const env = getEnv();
  supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });

  return supabaseAdmin;
}

export function getPublicStorageUrl(path: string) {
  const env = getEnv();
  if (!env.SUPABASE_STORAGE_PUBLIC_BASE_URL) {
    return null;
  }
  return `${env.SUPABASE_STORAGE_PUBLIC_BASE_URL}/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
}
