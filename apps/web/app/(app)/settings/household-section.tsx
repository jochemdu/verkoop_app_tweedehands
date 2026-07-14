import { createClient } from "@/lib/supabase/server";
import { HouseholdManager } from "./household-manager";

// Fase 48: household/team-sharing beheer. Haalt de workspaces van de gebruiker,
// de actieve workspace, de leden (via SECURITY DEFINER rpc voor e-mails) en de
// openstaande uitnodigingen op, en geeft ze aan de client-manager.
export async function HouseholdSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: memberRows }, { data: profile }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, workspace_id, workspaces(id, name)")
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const workspaces = (memberRows ?? [])
    .map((m) => {
      const ws = m.workspaces as { id: string; name: string } | null;
      return ws ? { id: ws.id, name: ws.name, role: m.role } : null;
    })
    .filter((w): w is { id: string; name: string; role: string } => w !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeId =
    profile?.active_workspace_id ?? workspaces[0]?.id ?? null;

  const [membersRes, invitesRes] = activeId
    ? await Promise.all([
        supabase.rpc("list_workspace_members", { p_workspace: activeId }),
        supabase
          .from("workspace_invites")
          .select("id, email, token, expires_at")
          .eq("workspace_id", activeId)
          .is("accepted_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <HouseholdManager
      userId={userId}
      workspaces={workspaces}
      activeId={activeId}
      members={(membersRes.data ?? []).map((m) => ({
        user_id: m.user_id,
        email: m.email,
        role: m.role,
      }))}
      invites={(invitesRes.data ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        token: i.token,
        expires_at: i.expires_at,
      }))}
    />
  );
}
