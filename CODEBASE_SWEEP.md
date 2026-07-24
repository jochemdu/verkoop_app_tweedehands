# VerkoopAssistent — Codebase Sweep

*Generated 2026-07-24 against `claude/wizardly-heisenberg-nwkp9n` (HEAD `cfd8fab`, phase 61).*

## How this was produced

A multi-agent audit: 10 parallel finder dimensions (security, RLS/multi-tenancy, web-API
correctness, shared+MCP logic, frontend/a11y, performance, mobile sync, edge functions,
duplication, testing/CI) with **every finding adversarially re-verified** against the code, plus
three dedicated sub-investigations (dependency upgrades, shared-code consolidation, speed/opportunities).
Cross-validation was strong — the biggest issues were independently surfaced by more than one agent.

**Baseline health is genuinely good:** `typecheck` ✓, `eslint` (web) ✓, 56 unit tests ✓, disk healthy.
Only 1 TODO / 2 `any` / 7 `console` across ~24k LOC. The findings below are deeper defects and
high-value improvements, not broken basics.

Raw counts: 65 machine findings (2 critical, 15 high, 30 medium, 18 low) → 57 confirmed, 5
rejected/deflated on verification, 3 unverified (verifier agents timed out). Severities below reflect
the *verified* assessment, not the finder's initial claim.

---

## P0 — Security & active data-loss (do first; all small)

### 1. `next` 16.2.10 → 16.2.11 — patches 9 security advisories
One-line bump (+ `eslint-config-next` in lockstep). Fixes: **HIGH** middleware/proxy bypass
(Turbopack+single-locale), DoS in Server Actions, SSRF in Server Actions (custom servers), SSRF in
rewrites via attacker-controlled host; **MODERATE** response-body cache confusion ×2, unbounded Server
Action payload (Edge), Image-Optimization DoS via SVG, unauth disclosure of internal Server Function
endpoints. This is the single highest-value change in the whole sweep.

### 2. Transitive dependency CVEs — add `pnpm.overrides`
`pnpm audit` reports 1 critical / 16 high / 11 moderate, almost all transitive (RN/metro/vitest chains):
**shell-quote** (CRITICAL ≤1.8.4, parse DoS), **sharp** (HIGH <0.35.0, libvips CVEs), **@xmldom/xmldom**
(HIGH ×4 <0.8.13), **ws**, **vite**, **js-yaml**, **fast-uri**, **uuid**, and a transitive **postcss**
≤8.5.11. Pin them via `pnpm.overrides` and re-audit.

### 3. Mobile batch-scan silently loses scanned barcodes on partial save `[HIGH, confirmed]`
`apps/mobile/app/(tabs)/batch-scan.tsx:152` — `saveAll()` swallows per-item errors then
**unconditionally `clearAll()`**, wiping the failed items too. Failures here are typically transient
(network drop mid-batch; stubs have no unique constraint). User scans a box of 20, hits one blip, and
loses the failed barcodes with no idea which. **Fix:** keep only the succeeded items out of the queue;
leave failures visible (status `error`) to retry.

### 4. `price-watcher` nulls out `current_lowest` on a silent scrape failure `[HIGH, confirmed]`
`supabase/functions/price-watcher/index.ts:62` — when Tweakers returns HTTP 200 with zero parsed
listings (markup change / transient miss), `stats` is null, and the watch is updated with
`current_lowest: null` **and** `last_checked_at: now`. A single silent scrape breakage destroys the
last-known-good price for every active watch and hides the failure until the next interval. **Fix:**
`current_lowest: lowest ?? w.current_lowest`, and don't advance `last_checked_at` when nothing was
scraped so it retries.

---

## P1 — Multi-tenant isolation, correctness & resilience

The app migrated solo-user → workspace-scoped over phases 21/31/48/49. Several surfaces didn't fully
follow. These are the substantive theme of the sweep.

### 5. MCP server bypasses RLS but adds no workspace filter `[write path confirmed; read-path severity contested]`
`packages/mcp-server/src/lib/supabase.ts:20` connects with the **service-role key** (RLS bypassed), so
isolation must be enforced in code — and mostly isn't. `resolveProductId`
(`packages/shared/src/repo.ts:20`) selects by `sticker_id`/`id` with **no `workspace_id` filter**, and
`search_products.ts` / `inventory_summary.ts` query `products` with only `deleted_at`. Since sticker IDs
are unique *per workspace* (phase 49), a sticker like `0042` exists in many tenants, so MCP calls can
read or mutate the wrong tenant's data in a genuinely shared project.
*Verification note:* two verifiers split on severity — the write-path/resolver gap was confirmed; one
downgraded the read-path leak on the argument that many deployments run one owner per project. Treat it
as a real isolation-hardening item whose blast radius scales with how multi-tenant your deployment
actually is. **Fix:** resolve `getOwnerWorkspaceId()` once and `.eq('workspace_id', ws)` on every
read/resolve/update; add a scoping unit test.

### 6. Sticker → product resolution breaks / cross-writes when a user is in 2+ workspaces `[HIGH, confirmed]`
`packages/shared/src/repo.ts:26` and the web detail/analyze/PATCH/DELETE routes do
`.eq('sticker_id', ref).maybeSingle()/.single()` with **no workspace filter**. RLS `ws_all` grants
access to *every* workspace the user belongs to, and each workspace's counter starts at `0001`, so
low-numbered collisions are near-certain for anyone in a personal + household workspace. Result:
`/inventory/{sticker}` 404s and API routes 500 for products that plainly exist — and worse,
`api/products/[id]/route.ts:40` does `update(...).eq('sticker_id', ref)...single()`, which **mutates the
same-numbered product in *both* workspaces** before erroring. **Fix:** scope every sticker lookup to the
active workspace; link inventory/dashboard rows by product UUID, not sticker_id.

### 7. Offline outbox misattributes captures after an account/workspace switch `[HIGH, confirmed]`
`apps/mobile/lib/outbox/sync.ts:83` — `QueuedCapture` stores no `userId`/`workspaceId`; `flushOutbox()`
attributes every queued item to whoever is logged in / whatever workspace is active at flush time, and
`signOut()` leaves the outbox intact. Captures queued by user A (or workspace X) can land in another
tenant. **Fix:** stamp `userId`/`workspaceId` at enqueue; skip/park items whose stored user ≠ current;
clear/fence the outbox on sign-out.

### 8. "Add product" modal is broken whenever photos are attached `[HIGH, confirmed via duplicate]`
`apps/web/app/(app)/inventory/add-product-button.tsx:59` builds the upload path as `inbox/${name}` —
missing the `${userId}/` prefix that every other uploader uses and that both storage RLS
(`own_write_product_photos`) and the server (`isSafeInboxPath`) now require. Upload fails RLS; even if it
didn't, `POST /api/products` 400s the body. The primary add-product flow only works photo-less. A
regression the phase-21/48 migration never propagated to this one component. **Fix:** prefix with
`user.id`; better, add a shared `inboxPath(userId, filename)` helper used by all five uploaders.

### 9. Child rows stamped with the *active* workspace, not the product's `[MEDIUM, confirmed]`
`analyze/route.ts:138` (listing + `claude_analyses` inserts) and `photos/route.ts` never set
`workspace_id`, so the `set_workspace_id` trigger fills it from `active_workspace_id()`. When you act on
a product in a *non-active* workspace (reachable via merged inventory), its new listing/photo/analysis is
stamped to the wrong workspace — dashboard mis-attribution and orphaned rows if you later leave. **Fix:**
pass `workspace_id: product.workspace_id` explicitly on those inserts.

### 10. Migrations aren't runnable from scratch — `btree_gist` never created `[HIGH, confirmed]`
`supabase/migrations/...phase55.sql:14` adds an `EXCLUDE USING gist (user_id WITH =, ...)` needing the
`btree_gist` extension, which is never `CREATE EXTENSION`-ed. A fresh `supabase db reset` / new-region
deploy / CI DB aborts mid-chain. **Fix:** `create extension if not exists btree_gist;`. **While there:**
that exclusion + the sheet uniqueness constraint are still `user_id`-scoped after the move to workspace
tenancy (finding 11) — two members of one workspace can concurrently reserve overlapping sticker ranges.

### 11. Edge functions: no fetch timeouts + brittle scraping `[HIGH/MEDIUM, confirmed]`
No outbound `fetch` has a timeout/`AbortController` (`fetch-tweakers-prices:36`, `lookup-*`,
`price-watcher`). Deno's fetch never times out, so one hung upstream freezes the entire serial
`price-watcher` cron and starves the tail of due watches. The scrapers also can't distinguish "no
listings" from "markup changed" (both → 200/empty), feeding finding 4. `price-watcher` has no `.limit()`,
ordering, backoff, or 429 handling. **Fix:** `AbortSignal.timeout(8000)` on every fetch; order by
`last_checked_at` + batch cap + pacing; return a `scrape_ok:false` signal distinct from empty results.

### 12. Outbox at-least-once with no idempotency + poison-item wedging `[MEDIUM, confirmed]`
`sync.ts:102` commits server-side, then deletes local + dequeues — a kill in between re-creates a
duplicate product (no unique key for sticker-less captures). A terminally-failing item (`23505`) retries
forever, re-uploading photos each pass, invisible (no queue UI), badge stuck. Related: offline captures
don't advance `last_sticker_number` (`capture.tsx:360`), so a restart reuses a claimed number → guaranteed
`23505` → the item that can never succeed. **Fix:** client idempotency key + unique constraint; retryable
vs terminal error handling + backoff cap + a queue screen; advance the counter for queued captures.

### 13. Rate limiting is per-instance in-memory → ineffective on Vercel `[MEDIUM, confirmed]`
`apps/web/lib/rate-limit.ts:7` stores counters in a per-process `Map`. On Vercel's fan-out, the AI-cost
guards on `/api/products/[id]/analyze` (Claude vision), `/suggestions/audit`, `/room-audit` (20/5min) are
trivially bypassed by concurrent requests hitting different lambdas. `ipFromRequest()` also keys on the
client-spoofable leftmost `X-Forwarded-For`. **Fix:** shared store (Upstash Redis / Postgres INCR+TTL);
use `x-real-ip` or the trusted right-most hop.

### Other confirmed correctness fixes (P1, mostly small)
- **`resolveProductId` ignores `deleted_at`** (`repo.ts:24`) — MCP mutating tools attach listings/research to
  soft-deleted products. Add `.is('deleted_at', null)`.
- **listings PATCH/DELETE don't exclude soft-deleted rows** (`api/listings/[id]/route.ts:47`) — a deleted
  listing can be republished, flipping its deleted product back to `listed`.
- **Edit-product form can't clear a title/description/price** (`edit-form.tsx:42`, *unverified*) — truthiness
  guards drop blanked fields; Save shows success but silently no-ops. Send changed fields as `null`.
- **Bulk `per_photo` startSticker**: prefixed IDs → `"0NaN"` unique-violation 500; near-9999 ranges
  mis-attach every leftover photo to one product (`bulk/route.ts:118`). Validate range up front; key photos
  by index not a nullable sticker map.
- **`create_taxatie_pdf`** stores only `resolved[0]` for a multi-product dossier while claiming all were
  saved (`create_taxatie_pdf.ts:55`). *(Verifier deflated the harm — confirm intended behavior; at minimum
  fix the response message.)*
- **`list_inventory` `has_photos` filter applied after the DB limit** (`list_inventory.ts:71`) — returns an
  arbitrary subset. Push the predicate into the RPC.
- **`search_products` ad-hoc ilike escaping** (`search_products.ts:32`) — `replace(/[,()]/g)` leaves
  `% _ \ *` live; use the existing shared `sanitizeIlikeQuery` (the hosted web tool already does).
- **EAN/book lookup returns 400 for upstream outages** (`api/lookup/[type]/route.ts:79`) — use
  `apiErrors.dependency()` (502); stop echoing raw upstream errors.
- **Non-atomic `order_index` on photo add** (`photos/route.ts:47`) — concurrent adds collide; compute in DB.
- **`ean_cache` is world-writable by any authenticated user** (`...phase11.sql:18`, `WITH CHECK(true)`) —
  cross-tenant cache poisoning of a global table. Make writes server-managed.
- **OAuth hardening**: issuer/endpoints built from unvalidated `Host`/`X-Forwarded-Host`
  (`lib/mcp/config.ts:34`) — pin to `NEXT_PUBLIC_SITE_URL`/allowlist; auth-code consume is non-atomic
  select-then-delete (`store.ts:87`) — use `delete().select()`; `/api/mcp/register` is unauthenticated &
  unbounded — add rate-limit + pruning.

---

## P2 — Shared-code consolidation (kill divergence at the source)

Recurring root cause behind many bugs above: the same concept is hand-rolled on each surface and drifts.
Move these into `packages/shared` and make each surface a thin consumer.

| What | Where it's duplicated | Target |
|---|---|---|
| **Sticker parse/format/next + regex** (root of the `NaN`/prefix bugs) | `parseInt`/`padStart`/regex re-rolled ~10× across web + mobile; `padSticker` exists but is used *nowhere*; the regex `^[A-Z]{0,6}\d{4}$` lives in 4 places incl. a 2nd copy inside shared; web edit-form hardcodes `\d{4}` and can't enter prefixes | `parseStickerId`/`formatStickerId`/`nextStickerId`/`isStickerId`/`STICKER_ID_RE` in `sticker.ts` |
| **Currency formatting** | `formatEuro` is web-only (`lib/utils.ts:9`, pulls in clsx/twMerge); mobile + ≥5 web components hand-roll `€${x.toFixed(2)}` → 3 incompatible formats | move `formatEuro` to shared (param by `localeTag`) |
| **Category validation** | MCP validates against static `z.enum(CATEGORY_SLUGS)` while the DB is data-driven (phase 22, `CHECK ~ '^[a-z0-9_]+$'`) — any category added later is **rejected by Claude's tools** while web/mobile accept it | shared `categorySlugSchema` regex; drop the enum |
| **EAN/ISBN lookup** | `shared/lookups.ts` is byte-for-byte re-implemented in `supabase/functions/lookup-ean` + `lookup-book`; mobile calls the edge copies → 3 impls, already drifting | point mobile at the cache-backed web `/api/lookup`, retire edge copies (or vendor from shared) |
| **Barcode classify + title-build** | duplicated in mobile `capture.tsx` + `batch-scan.tsx` | shared `classifyBarcode()` / `barcodeTitle()` |
| **Inbox storage path** (root of finding 8) | `${userId}/inbox/...` copy-pasted in 5 uploaders, one wrong | shared `inboxPath(userId, filename)` |
| **Storage bucket name** | `'product-photos'` literal in ~25 places; `STORAGE_BUCKET` exists but is private/unexported | export `STORAGE_BUCKET` |
| **Product-insert rollback** | `insertProductWithPhotos` is shared & used well, but bulk `per_photo` and mobile `addPhotosToProduct` re-roll it | extend shared core with a batch/addPhotos variant |
| **Condition labels** (missing entirely) | 7 `product_condition` values have no i18n keys; rendered raw everywhere | add `conditions` namespace + `conditionLabel()` |
| **Two MCP tool impls** | stdio server (17 tools) vs hosted HTTP (6 tools) have drifted (weaker sanitizer, different shapes) | make both thin adapters over one shared registry *(large; do the `sanitizeIlikeQuery` fix now)* |
| **`api-error` helper** | used by 1 of 21 routes; the documented `{error,code,correlation_id}` contract is a fiction | adopt everywhere (+ a `requireUser()` helper folding the 16× copy-pasted 401) or delete it |

Mobile also renders raw enum status/category and hardcodes only 3 of 8 listing-status colors while the
shared `status.ts` tone map + i18n catalog it already imports cover all of them — pure missed reuse.

---

## P2 — Performance & speed (independently cross-validated)

**Top quick wins (small effort, clear payoff):**
1. **Mobile uploads full-res photos** — no `expo-image-manipulator`; web already caps at 1920px/JPEG-0.85.
   Add the same resize in `createProduct.ts` (`uploadOne`) + the outbox path. ~4–8× fewer upload/storage bytes.
2. **`recharts` (~100KB gz) statically bundled** into the two hottest pages (`dashboard-charts.tsx`,
   `price-chart.tsx`). `next/dynamic({ssr:false})` + `optimizePackageImports:["recharts"]`.
3. **`resolveProductIds` is an N+1** (`repo.ts:38`) — 50 serial round-trips for a 50-item bundle/taxatie.
   Partition by id-type, two `.in()` queries.
4. **`ean_cache` bypassed** by MCP `lookup_ean` and the edge functions — every barcode scan re-hits external
   APIs. Route all callers through one cached helper; cache negative results too.
5. **Unbounded / count-by-download queries**: listings page downloads every row to count statuses
   (`listings/page.tsx:38`); `inventory_summary`, blind-spot audit, room-audit, and CSV export each pull the
   whole `products` table to aggregate in JS — use `get_dashboard_aggregates` / grouped RPCs / `head:true`
   counts / streamed export.
6. **Product-detail runs 4 queries serially** (`[sticker]/page.tsx:43`) — `Promise.all` the independent ones.
7. **Missing trigram index** behind the ILIKE search (`inventory/page.tsx:54`, `search_products.ts`) — the
   MCP tool even calls it "full-text" but it's a seq scan. `CREATE EXTENSION pg_trgm` + GIN on
   `working_title`/`title` `WHERE deleted_at IS NULL`.
8. **Storage RLS record-fallback seq-scans `storage_path`** on every cross-member object access — add btree
   indexes on `photos.storage_path`, `sticker_sheets.pdf_storage_path`, `taxatie_exports.pdf_storage_path`.
9. **Camera-capture leaks object URLs** (`camera-capture.tsx:177`) — `createObjectURL` in render, never
   revoked. Unbounded memory growth on phones. Create once in `snap()`, revoke on remove/close.
10. **Bulk photo upload is strictly serial** (`bulk-upload.tsx:59`) — bounded-concurrency pool (3–4).
11. **No `unstable_cache`/`React.cache`** on `categories`/`platforms` reference data (refetched every render).
12. **Inventory-table date formatting** without a fixed `timeZone` → hydration mismatch near midnight.

**Opportunity:** a `phash` near-duplicate detector (column + `find_similar_photos()` RPC) already exists
from phase 16 but no UI uses it — cheap "possible duplicate of sticker XXXX" during bulk upload.

---

## P2 — Testing & CI gaps

- **CI runs only `@verkoopassistent/shared` tests** — the mobile outbox suite (6 passing tests) never runs.
  Switch to `pnpm -r --if-present test`.
- **MCP server (18 tools, service-role, no RLS backstop) has zero tests** and no `test` script — the exact
  tier that produced the isolation findings. Add vitest + scoping tests (foreign-workspace row must not return).
- **Web (22 API routes) has no unit runner** — only 2 prod-only e2e smokes. Add vitest for the
  workspace-scoping/auth helpers.
- **E2E only runs on push-to-main against the live URL** (racing the deploy; no PR coverage; no local
  `webServer`). Add a `webServer` block + run against localhost on PRs.
- **Deno edge functions never typechecked/tested** — add a `deno check` job scoped to `supabase/functions/**`.
- **Lint runs for web only** — add minimal flat configs (with `no-floating-promises`) to mcp-server/shared,
  `pnpm -r --if-present lint`.
- **Node drift**: `.nvmrc` pins 20, CI uses 22, no `engines`. Pick one; add `engines`.

---

## Dependency plan (full table gathered from the registry)

- **PR 1 — security + safe web batch:** `next`/`eslint-config-next` → 16.2.11 (**the headline**), plus
  patches/minors: `@supabase/ssr` 0.12.3, `@supabase/supabase-js` 2.110.8 (everywhere), `jose` 6.2.4,
  `react`/`react-dom` 19.2.8 (**web only**), `lucide-react` 1.26.0, `next-intl` 4.13.4, `react-hook-form`
  7.82.0, `recharts` 3.10.0 (verify charts), `autoprefixer` 10.5.4, `tailwindcss`+`@tailwindcss/postcss`
  4.3.3, `postcss` 8.5.22, `tsx` 4.23.1, `@tanstack/react-virtual` 3.14.8, `@anthropic-ai/sdk` 0.114.0
  (additive), `@tanstack/react-query` 5.101.4.
- **PR 2 — mobile intra-SDK-57 patches:** `pnpm -F mobile exec expo install --fix` + `expo-doctor`. Leaves
  `react`, `react-native`, `react-native-gesture-handler`, `-reanimated`, `-screens`, `-safe-area-context`
  at their **Expo-pinned** versions.
- **PR 3 — transitive vuln overrides** (finding 2), then re-audit.
- **PR 4–6 — one each (REVIEW):** `react-dropzone` 15→19.1.1 (4 majors but only touches
  `upload/bulk-upload.tsx`; actually *fixes* today's React-19 peer mismatch), `@sentry/nextjs` 10.68 (verify
  build + source-map upload), `react-native-url-polyfill` 3→4 (device smoke-test Supabase).
- **HOLD:** `eslint` 9→10 (blocked by `eslint-config-next`'s bundled `typescript-eslint`), **`typescript`
  6→7** (native/Go rewrite; `@types/*` and `typescript-eslint` not cleared for it — pilot only),
  `@babel/core` 7→8 (Expo on Babel 7). `expo-speech-recognition@56` is *not* a mismatch — that's its latest.

---

## Rejected / deflated on verification (transparency)

- *"A single mobile scan resets the workspace sticker counter to 0"* — the specific trigger-null mechanism
  wasn't reproduced. **But** the underlying prefixed-sticker → `NaN` gap is real and confirmed via the bulk
  path and the web edit-form; fix it at the source (shared sticker helpers).
- *OAuth refresh-token not bound to `client_id`* — real code observation, negligible practical impact here.
- *`create_taxatie_pdf` drops products* — code-accurate; verifier argued the harm is bounded (still worth a
  message fix).
- *MCP read-path cross-tenant leak / two-server unification* — code facts accurate; severity/scope contested
  (see finding 5). The concrete `sanitizeIlikeQuery` fix stands.

---

## Suggested order of attack

1. **This week:** #1 (next patch), #2 (vuln overrides), #3 (batch-scan data-loss), #4 (price-watcher null),
   #8 (add-product path), #10 (btree_gist) — all small, high-value.
2. **Isolation hardening:** #5, #6, #7, #9, #11, #13 — the workspace-scoping theme.
3. **Consolidate** the shared helpers (sticker, currency, inbox path, bucket, category schema, lookups) —
   this retires several bugs *and* prevents the next ones.
4. **Perf quick wins** (mobile downscale, dynamic recharts, batch `resolveProductIds`, ean_cache reuse,
   unbounded queries, trigram index).
5. **Close the CI/testing gaps**, then work the dependency PR sequence.
