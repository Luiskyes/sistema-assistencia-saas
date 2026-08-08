import type { SupabaseClient } from "@supabase/supabase-js";

type PublicConfig = {
  supabase_url: string;
  supabase_publishable_key: string;
};

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

let clientPromise: Promise<SupabaseClient> | undefined;

async function createSupabaseClient(): Promise<SupabaseClient> {
  const [response, supabaseModule] = await Promise.all([
    fetch(apiUrl + "/api/v1/config/public"),
    import("@supabase/supabase-js"),
  ]);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a configuração do sistema.");
  }

  const config = (await response.json()) as PublicConfig;
  return supabaseModule.createClient(config.supabase_url, config.supabase_publishable_key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  clientPromise ??= createSupabaseClient();
  return clientPromise;
}

export { apiUrl };
