"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";

// Toont de MCP connect-URL van deze deploy + install-stappen, zodat de gebruiker
// de connector zonder documentatie in claude.ai kan toevoegen.
export function McpConnector({ connectUrl }: { connectUrl: string }) {
  const t = useTranslations("mcpConnector");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(connectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="section-title">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm">
          {connectUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn btn-outline shrink-0"
          aria-label={t("copy")}
        >
          {copied ? (
            <>
              <Check className="size-4" aria-hidden />
              {t("copied")}
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden />
              {t("copy")}
            </>
          )}
        </button>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
        <li>{t("step4")}</li>
      </ol>
    </section>
  );
}
