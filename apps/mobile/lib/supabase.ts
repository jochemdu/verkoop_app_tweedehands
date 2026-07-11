import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { createMMKV } from "react-native-mmkv";
import Constants from "expo-constants";
import type { Database } from "@verkoopassistent/shared";

// MMKV is snellere & sync storage dan AsyncStorage — ideaal voor auth tokens.
const storage = createMMKV({ id: "verkoopassistent-auth" });

const mmkvStorageAdapter = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

declare const process: { env: Record<string, string | undefined> };

function envVar(name: string): string {
  // Vanaf SDK 51 worden EXPO_PUBLIC_* via process.env blootgelegd.
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  // Fallback via expoConfig.extra (voor EAS builds).
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (extra?.[name]) return extra[name];
  throw new Error(
    `Mobile app mist env var ${name}. Zet in apps/mobile/.env met EXPO_PUBLIC_ prefix.`,
  );
}

const supabaseUrl = envVar("EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = envVar("EXPO_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // URL-parsing gebeurt handmatig in de deep-link handler van login.tsx.
    detectSessionInUrl: false,
  },
});
