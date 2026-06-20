import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * When VITE_USE_MOCK_DATA=true (or Supabase env vars are missing) the app runs
 * entirely against the in-memory mock data layer (see lib/mock-data.ts) and the
 * Supabase client is never used for queries.
 */
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true" || !url || !anonKey;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
