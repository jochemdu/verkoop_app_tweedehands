// Security utilities gedeeld door web, mobile en MCP server.

const MAX_SANITIZE_LEN = 2000;
// Patterns die vaak in prompt-injection attempts voorkomen — we vervangen ze
// door visual markers zodat Claude weet dat het geen instructie is.
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+(?:instructions|prompts|messages)/gi,
  /disregard\s+(?:all\s+)?(?:prior|above)/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_(?:start|end)\|>/gi,
  /<system>/gi,
  /<\/system>/gi,
  /you\s+are\s+now\s+(?:a\s+|an\s+)?/gi,
];

/**
 * Sanitize vrij-tekst dat naar een LLM (via MCP tool output) gaat.
 * Vervangt bekende prompt-injection patterns door een placeholder en kapt op
 * max lengte. Laat normale content intact.
 */
export function sanitizeForLLM(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input).slice(0, MAX_SANITIZE_LEN);
  for (const pat of INJECTION_PATTERNS) {
    s = s.replace(pat, "[sanitized-potential-injection]");
  }
  // Strip control characters behalve tab + newline.
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return s.trim();
}

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Valideert dat een storage path binnen de toegestane per-user prefix ligt
 * en geen path-traversal tekens bevat. Sinds de multi-tenant hardening is
 * het pad-formaat `{user_id}/inbox/<filename>`; de storage RLS policies
 * staan alleen de eigen map toe. Geef `userId` mee om ook te verifiëren
 * dat de prefix bij de aanroeper hoort.
 */
export function isSafeInboxPath(path: string, userId?: string): boolean {
  if (typeof path !== "string") return false;
  if (path.length > 256) return false;
  if (path.includes("..")) return false;
  if (path.includes("//")) return false;
  if (path.startsWith("/")) return false;
  const m = new RegExp(
    `^(${UUID_RE})\\/inbox\\/[a-zA-Z0-9._:-]+\\.(jpe?g|png|webp|heic|heif)$`,
    "i",
  ).exec(path);
  if (!m) return false;
  if (userId && m[1]!.toLowerCase() !== userId.toLowerCase()) return false;
  return true;
}

export function sanitizeAll<T extends Record<string, unknown>>(
  row: T,
  fields: (keyof T)[],
): T {
  const out = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === "string") {
      (out as Record<string, unknown>)[f as string] = sanitizeForLLM(v);
    }
  }
  return out;
}
