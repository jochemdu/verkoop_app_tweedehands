import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type SessionState = {
  session: Session | null;
  loading: boolean;
  setSession: (s: Session | null) => void;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  loading: true,
  setSession: (session) => set({ session, loading: false }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));

// Eenmalige subscribe — wordt geactiveerd bij eerste import in _layout.tsx.
export function bootstrapSessionListener() {
  supabase.auth.getSession().then(({ data }) => {
    useSession.getState().setSession(data.session);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    useSession.getState().setSession(session);
  });
}
