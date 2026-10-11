import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ---------------------------------------------------------------------------
// Custom Supabase fetch: strips the opaque "sb_publishable_*" key from the
// Authorization header (it must travel as "apikey", not "Bearer").
// ---------------------------------------------------------------------------
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// ---------------------------------------------------------------------------
// Switchable storage adapter
// Checked = localStorage (persists across tabs/restarts).
// Unchecked = sessionStorage (clears when the tab is closed).
// Call authStorage.use(localStorage | sessionStorage) before every sign-in.
// ---------------------------------------------------------------------------
export type SwitchableStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Swap the backend. Call this before supabase.auth.signIn* so the new
   *  tokens land in the right store. */
  use(backend: Pick<Storage, "getItem" | "setItem" | "removeItem">): void;
};

function createSwitchableStorage(): SwitchableStorage {
  // Default to localStorage; LoginPage switches to sessionStorage when
  // "Remember this terminal" is unchecked.
  let _backend: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null =
    typeof window !== "undefined" ? localStorage : null;

  return {
    use(backend) {
      _backend = backend;
    },
    getItem(key) {
      return _backend?.getItem(key) ?? null;
    },
    setItem(key, value) {
      _backend?.setItem(key, value);
    },
    removeItem(key) {
      _backend?.removeItem(key);
    },
  };
}

/** Exported so LoginPage can call authStorage.use(localStorage | sessionStorage)
 *  before every sign-in attempt. */
export const authStorage = createSwitchableStorage();

// ---------------------------------------------------------------------------
// Supabase browser client (singleton, lazy-initialised)
// ---------------------------------------------------------------------------
function createSupabaseClient() {
  // VITE_ vars are replaced by Vite at build time and embedded in both
  // client and SSR bundles.
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["VITE_SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Add them to .env.local — see .env.example.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      // On the server (SSR pass) there is no window, so we pass undefined
      // and let supabase-js skip persistence. On the client, use the
      // switchable adapter so "Remember this terminal" is honoured.
      storage: typeof window !== "undefined" ? authStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
