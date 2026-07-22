"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type WS = { id: string; name: string; role: string };
type Member = { user_id: string; email: string; role: string };
type Invite = { id: string; email: string; token: string; expires_at: string };

export function HouseholdManager({
  userId,
  workspaces,
  activeId,
  members,
  invites,
}: {
  userId: string;
  workspaces: WS[];
  activeId: string | null;
  members: Member[];
  invites: Invite[];
}) {
  const t = useTranslations("household");
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const isOwner = active?.role === "owner";

  async function run(fn: () => PromiseLike<{ error?: unknown } | void>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res && "error" in res && res.error) {
        const msg =
          typeof res.error === "object" && res.error && "message" in res.error
            ? String((res.error as { message: unknown }).message)
            : t("failed");
        toast.error(msg);
        return false;
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(id: string) {
    if (id === activeId) return;
    const ok = await run(() =>
      supabase.from("profiles").update({ active_workspace_id: id }).eq("id", userId),
    );
    if (ok) router.refresh();
  }

  async function rename() {
    if (!active || !newName.trim()) return;
    const ok = await run(() =>
      supabase.from("workspaces").update({ name: newName.trim() }).eq("id", active.id),
    );
    if (ok) {
      toast.success(t("saved"));
      setNewName("");
      router.refresh();
    }
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    const ok = await run(async () => {
      const { data, error } = await supabase.rpc("create_workspace", {
        p_name: newName.trim(),
      });
      if (error) return { error };
      await supabase
        .from("profiles")
        .update({ active_workspace_id: data as string })
        .eq("id", userId);
    });
    if (ok) {
      toast.success(t("saved"));
      setNewName("");
      router.refresh();
    }
  }

  async function createInvite() {
    if (!active || !inviteEmail.trim()) return;
    const ok = await run(async () => {
      const { data, error } = await supabase
        .from("workspace_invites")
        .insert({
          workspace_id: active.id,
          email: inviteEmail.trim().toLowerCase(),
          role: "member",
        })
        .select("token")
        .single();
      if (error) return { error };
      setInviteLink(`${window.location.origin}/invite/${data.token}`);
    });
    if (ok) {
      setInviteEmail("");
      router.refresh();
    }
  }

  async function revoke(id: string) {
    const ok = await run(() =>
      supabase.from("workspace_invites").delete().eq("id", id),
    );
    if (ok) router.refresh();
  }

  async function removeMember(uid: string) {
    if (!active || !confirm(t("confirmRemove"))) return;
    const ok = await run(() =>
      supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", active.id)
        .eq("user_id", uid),
    );
    if (ok) router.refresh();
  }

  async function leave() {
    if (!active || !confirm(t("confirmLeave"))) return;
    const other = workspaces.find((w) => w.id !== active.id);
    const ok = await run(async () => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", active.id)
        .eq("user_id", userId);
      if (error) return { error };
      if (other) {
        await supabase
          .from("profiles")
          .update({ active_workspace_id: other.id })
          .eq("id", userId);
      }
    });
    if (ok) router.refresh();
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success(t("copied"));
  }

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h2 className="section-title">{t("title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Actieve workspace + switcher */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("activeWorkspace")}
        </label>
        {workspaces.length > 1 ? (
          <select
            className="input"
            value={active?.id ?? ""}
            disabled={busy}
            onChange={(e) => switchTo(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="font-medium">{active?.name}</p>
        )}
      </div>

      {/* Leden */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("members")}</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent"
                  aria-hidden
                >
                  {m.email.slice(0, 2)}
                </span>
                <span className="truncate">
                  {m.email}
                  {m.user_id === userId && (
                    <span className="text-muted-foreground"> ({t("you")})</span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span
                  className={`badge ${m.role === "owner" ? "badge-accent" : "badge-neutral"}`}
                >
                  {m.role === "owner" ? t("roleOwner") : t("roleMember")}
                </span>
                {isOwner && m.user_id !== userId && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    disabled={busy}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t("remove")}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {!isOwner && (
          <button
            onClick={leave}
            disabled={busy}
            className="text-sm text-destructive hover:underline"
          >
            {t("leave")}
          </button>
        )}
      </div>

      {/* Uitnodigen (alleen owner) */}
      {isOwner && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("invite")}</h3>
          <div className="flex gap-2">
            <input
              type="email"
              className="input flex-1"
              placeholder={t("invitePlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button
              onClick={createInvite}
              disabled={busy || !inviteEmail.trim()}
              className="btn btn-accent"
            >
              {t("inviteBtn")}
            </button>
          </div>

          {inviteLink && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("inviteLinkHint")}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs">{inviteLink}</code>
                <button onClick={copyLink} className="btn btn-outline btn-sm">
                  {t("copy")}
                </button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <ul className="space-y-1 pt-1">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>{inv.email}</span>
                  <button
                    onClick={() => revoke(inv.id)}
                    disabled={busy}
                    className="text-destructive hover:underline"
                  >
                    {t("revoke")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Naam wijzigen / nieuwe workspace */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={isOwner ? t("renamePlaceholder") : t("createPlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          {isOwner && (
            <button
              onClick={rename}
              disabled={busy || !newName.trim()}
              className="btn btn-outline"
            >
              {t("rename")}
            </button>
          )}
          <button
            onClick={createWorkspace}
            disabled={busy || !newName.trim()}
            className="btn btn-outline"
          >
            {t("createNew")}
          </button>
        </div>
      </div>
    </section>
  );
}
