# VerkoopAssistent — Diepte-analyse + Skills Map + Kritieke Review

*Gegenereerd 2026-04-17. Codebase: commit `ba9b570` — <https://github.com/jochemdu/verkoop_app_tweedehands>. Live: <https://verkoopassistent.vercel.app>*

---

## 1. Executive Summary

VerkoopAssistent is een volledig functionele Nederlandse tweedehands-verkoop app met stickergebaseerde inventarisatie, Claude Desktop/Code integratie via MCP, en automatische prijsopzoeking. De kern werkt end-to-end: print stickervel → indexeer producten (mobile of web bulk) → laat Claude via MCP analyseren/categoriseren/bundelen → review draft-advertentie in web → plaats manueel op Marktplaats → markeer gepubliceerd.

**Stack:** Next.js 15 + React 19 + Tailwind v4 (web) · Expo SDK 53 + expo-camera + ML Kit (mobile) · Supabase Postgres + Auth + Storage + Edge Functions (Deno) · MCP server met 13 tools · pnpm monorepo · TypeScript 5.8 strict.

**Omvang:** 15 tabellen · 10 enums · 5 Edge Functions · 11 web routes + 8 API routes · 4 mobile tabs · 2 PDF-generatoren · 13 MCP tools.

**Wat werkt:** indexering flow, sticker-PDF generatie, magic-link auth, MCP tool dispatch, listing approval workflow, taxatie-dossier PDF, prijswatcher cron-schedule, silver/tin hallmark lookups (best-effort scrape).

**Wat ontbreekt:** automated testing, observability (logs/metrics/traces), offline mobile mode, push notificaties, email-delivery taxatiedossier, auto-publish naar platforms, Cardmarket API, geautomatiseerde data-kwaliteit checks, WCAG audit, rate limiting, rollback-strategie.

Dit document mapt **90 industrie-best-practice skills** naar concrete verbetermogelijkheden in de huidige codebase (sectie 3), levert een **kritieke review over 10 dimensies** (sectie 4), en stelt **20 nieuwe features** voor — 10 om beter/sneller te indexeren, 10 om nog niet-aangeraakte categorieën van verkoopbare items uit je huis te identificeren (sectie 5).

---

## 2. Codebase Feature Inventory

### 2.1 Database (supabase/migrations/0001_initial_schema.sql + 0003_price_watcher_cron.sql)

**15 tabellen:**

| Tabel | Rol | Opmerkelijke velden |
|-------|-----|---------------------|
| `products` | Kern inventaris + verkoopvoorbereiding | `sticker_id` (UNIQUE 4-cijf), `sticker_input_method`, `sticker_confidence`, `status` (8 states), `specs` (JSONB), `indexed_at` vs `analyzed_at` |
| `photos` | Foto's per product | `storage_path`, `photo_type` (11 types incl. sticker/mark/detail/barcode), `sticker_visible`, `detected_sticker`, `ocr_confidence`, `capture_mode` |
| `sticker_sheets` | Tracking uitgeprinte vellen | `start_number` UNIQUE, `end_number`, `pdf_storage_path`, `printed_at` |
| `listings` | Advertentieconcepten | 8 status-states, `generated_title/description` vs `final_title/description`, `listing_url`, UNIQUE(`product_id`,`platform_id`) |
| `bundles` + `bundle_items` | Claude bundelsuggesties | `claude_reasoning` (verplicht), `suggested_by` ('user'/'claude_mcp'), `total_individual_value` |
| `buyback_quotes` | Opkoopdiensten offertes | `quoted_price`, `quote_source` (manual/api/scraped), `valid_until` |
| `price_history` | Prijsgeschiedenis per zoekopdracht | `price_low/avg/high`, `sample_count`, per platform + query |
| `claude_analyses` | Logboek MCP analyses | `analysis_type`, `subject_products` UUID[], `claude_response` JSONB, `applied` bool |
| `price_watches` | Cron-gedreven watchers | `search_query`, `target_price`, `alert_on_below`, `check_interval_hours`, `is_active` |
| `taxatie_exports` | Gegenereerde dossiers | `pdf_storage_path`, `recipient_name/email`, CHECK(product_id IS NOT NULL OR bundle_id IS NOT NULL) |
| `app_settings` | Key-value config | `last_sticker_number`, `default_sticker_mode`, `quick_replies`, `platforms_enabled`, `seller_name` |
| `platforms` · `categories` · `buyback_services` | Reference data | Gescheeid (7 + 15 + 5 rijen), public SELECT RLS |

**10 enums:** `product_condition`, `product_status`, `listing_status`, `photo_type`, `sticker_input_method`, `platform_slug`, `buyback_service_slug`, `category_slug`, `bundle_type`.

**RLS:** alle user-tabellen: `FOR ALL TO authenticated USING (true) WITH CHECK (true)` (solo-user patroon). Reference tables: public SELECT.

**Storage buckets (4):** `product-photos`, `bulk-uploads`, `taxatie-pdfs`, `sticker-sheets` — allen private, 12 RLS policies voor authenticated CRUD.

**Triggers:** `update_updated_at()` op `products`, `listings`, `bundles` met `SET search_path=''` (security hardened).

**pg_cron:** `price-watcher-hourly` schedule (elk uur, gebruikt Vault secret `service_role_key`).

### 2.2 Edge Functions (Deno, allen ACTIVE op `ffifhjwjauvhohmhhbip.supabase.co`)

| Functie | verify_jwt | Externe bron | Doel |
|---------|-----------|--------------|------|
| `lookup-ean` | true | Open Food Facts + Beauty + Products waterfall | EAN → productinfo |
| `fetch-tweakers-prices` | true | Tweakers V&A HTML scraping | Prijsindicatie met min/max/avg stats |
| `lookup-silver-hallmark` | true | Zilver.nl best-effort scrape | Keurmerk + NL context (gehalte, kantoormerken) |
| `lookup-tin-mark` | true | TinVereniging + Zilver.nl | Tinmerk + NL context (engel/rozenkroontje) |
| `price-watcher` | true | Cron → roept fetch-tweakers-prices aan per watch | Update `current_lowest` + insert `price_history` + alert |

### 2.3 Web app (apps/web/)

**Route group `(app)` met shared layout + nav** (Dashboard/Inventaris/Advertenties/Taxatie/Bulk upload/Stickers).

| Route | Type | Key functie |
|-------|------|-------------|
| `/login` | public page | Magic link via `signInWithOtp`, deep-link voor mobile + web callback |
| `/auth/callback` | public route handler | `exchangeCodeForSession` + redirect |
| `/` | dashboard | 5-stat grid, recharts (pie categorie / bar status / line weekly), recent geïndexeerd, geschatte inventariswaarde |
| `/inventory` | tabel | Filters (sticker range, status, categorie, zoek) + inline add-product modal |
| `/inventory/[sticker]` | detail | Photo gallery met 1u signed URLs, edit form (title/description/condition/status/price), delete met cleanup |
| `/listings` | tabel | Status filter chips, platform kolom, tijd gesorteerd |
| `/listings/[id]` | detail+actions | Edit tekst + prijs, copy-to-clipboard voor platform, 3-staps flow: approve → post → mark-published |
| `/upload` | bulk drop | react-dropzone, 2 modi (per_photo / single), client-side resize via canvas API, auto-increment sticker-ID |
| `/stickers` | pdf generator | Form (start + count), overlap-detectie (409), PDF signed URL |
| `/taxatie` | dossier builder | Multi-select checklist (filter antique_*), recipient + notes, PDF generatie |

**API routes (8):**
- `POST /api/products` — 1 product + photos in FormData
- `POST /api/products/bulk` — N photos → N products met auto-sticker
- `PATCH/DELETE /api/products/[id]` — update + cascade delete
- `POST /api/stickers/generate` — PDF + storage + sheet record + overlap detect
- `POST /api/taxatie/generate` — PDF dossier uit product_ids
- `PATCH/DELETE /api/listings/[id]` — edit + status transitions (approved_at/published_at auto)

**Middleware:** redirect unauth HTML → `/login`, API → 401 JSON.

**PDF generators:** `lib/pdf/sticker-sheet.tsx` (A4, 4 kwartieren × 40, Courier-Bold 11pt, dashed cut lines) · `lib/pdf/taxatie-dossier.tsx` (per-product card met `wrap={false}`, fotogrid, specs tabel, fixed footer met pagenum).

### 2.4 Mobile app (apps/mobile/)

**4 tabs:** Dashboard (stats + shortcut), Indexeren (capture.tsx), Inventaris (FlatList), Advertenties (read-only list).

**capture.tsx state machine:**
- Phase `configure`: kies sticker-mode (ocr_separate / ocr_inline / manual), vul sticker-ID + werktitel + notes
- Phase `capture`: live `<CameraView>` met 3 sub-modi (sticker / product / barcode)
- Sticker-mode: shutter → ML Kit `TextRecognition.recognize()` → extract 4-digit candidates → Alert picker bij >1
- Product-mode (ocr_inline): OCR passief op productfoto
- Barcode-mode: `onBarcodeScanned` EAN-13/8/UPC-A/E/Code128/QR → vult `ean`
- Save: upload alle foto's naar `product-photos/inbox/` → insert `products` + `photos` met `photo_type=sticker` + `detected_sticker` + `ocr_confidence`

**Auth:** `lib/supabase.ts` met MMKV storage adapter (sync, snel) · `lib/auth/useSession.ts` zustand store + `onAuthStateChange` subscribe · deep-link handler in login.tsx.

### 2.5 MCP Server (packages/mcp-server/ — 13 tools)

| Tool | Input | Returns | Notes |
|------|-------|---------|-------|
| `ping` | — | count(products) | Verbindingstest |
| `list_inventory` | status, category, sticker_range, has_photos, limit | [{id, sticker_id, title, category, status, photo_count, indexed_at}] | Accept UUID of sticker_id |
| `get_product_photos` | product, expires_in_seconds | [{id, url (signed), photo_type, capture_mode, sticker_visible}] | Signed URLs (default 1u) — Claude Desktop kan ze zien |
| `search_products` | query, category | Full-text op title/working_title/description/notes | ilike OR |
| `suggest_bundle` | title, bundle_type, product_ids_or_stickers, suggested_price, reasoning (VERPLICHT) | Bundle + items, status=ready_to_list, suggested_by=claude_mcp | Auto-compute total_individual_value |
| `create_listing` | product, platform, title, description, price | Listing status=pending_review | UNIQUE constraint (product, platform) |
| `update_product` | product, velden (title/condition/status/specs/defects/etc), mark_analyzed | Updated product | ProductUpdate typed |
| `lookup_ean` | ean | Edge Function `lookup-ean` output | Open*Facts waterfall |
| `fetch_tweakers_prices` | query, limit | listings + stats (min/max/avg/sample) | Tweakers V&A scraper |
| `mark_listing_published` | listing_id, listing_url, external_id? | Listing status=published + product.status=listed | |
| `create_taxatie_pdf` | products[], recipient_name/email, notes | export_id + wijst naar /taxatie web voor PDF | MVP: registreert export-rij |
| `lookup_silver_hallmark` | mark_text, country_hint | Candidates + NL context + extra zoek-URLs | |
| `lookup_tin_mark` | mark_text, hints | Candidates + NL context (8 productiecentra) | |

**Shared utils:** `lib/supabase.ts` (singleton service-role client met env vars) · `lib/resolve.ts` (UUID ↔ sticker_id resolver, batch variant) · `lib/format.ts` (jsonContent/errorContent helpers).

### 2.6 Shared package (packages/shared/)

- `database.types.ts` — Supabase-generated Database type met `__InternalSupabase` marker (vereist @supabase/supabase-js ≥2.50 voor correcte interpretatie)
- `enums.ts` — Runtime arrays + type aliases voor alle 10 enums (uit `Constants.public.Enums`)
- `schemas.ts` — zod schemas: `stickerIdSchema` (4-digit regex), `productIndexSchema` (Fase A), `productUpdateSchema` (Fase B, zonder specs), `photoInsertSchema`, `stickerSheetGenerateSchema`; split tussen `z.input` en `z.output` voor react-hook-form compat
- `index.ts` — expliciete named re-exports met `.js` extensies (ESM)

### 2.7 Infrastructure

- **GitHub:** `jochemdu/verkoop_app_tweedehands` (private), 9 commits op `main`
- **Vercel:** project `verkoopassistent`, auto-deploy via git-integration, commit `ba9b570` live
- **Supabase:** `ffifhjwjauvhohmhhbip`, eu-central-1, RLS + Vault + pg_cron actief
- **Monorepo:** pnpm 10.33, 4 workspaces, TypeScript 5.8, Node 20/22
- **Next config:** `serverExternalPackages: ['@react-pdf/renderer']`, webpack `extensionAlias: {'.js': ['.ts',...]}` voor ESM workspace imports, `transpilePackages: ['@verkoopassistent/shared']`

### 2.8 Niet geïmplementeerd (bewust uitgesteld)

Push notificaties · offline mobile · auto-publish Marktplaats API · email delivery taxatie · Cardmarket API · advanced analytics · automated testing · observability (geen OTel, geen Sentry, geen logs buiten console) · rate limiting · CSP headers · WCAG audit · rollback-strategie.

---

## 3. Skills-to-Improvements Map (15 categorieën × 90 skills)

Elke skill in deze map staat in `E:\AI_apps\Antigravity_Skills_Builder\skills\skills\<folder-name>`. Per skill: wat het doet + **concrete toepassing** in VerkoopAssistent met file-paths.

### 3.1 Security & Compliance (6 skills)

- `api-security-best-practices` — Secure API design, authn/authz, rate limiting, input validation. **Toepassing:** doorloop alle 8 API routes (`apps/web/app/api/**/route.ts*`); voeg rate-limit middleware toe (per-user sliding window in `app_settings` of Upstash Redis); verifieer Zod validation op request bodies is overal strict.
- `auth-implementation-patterns` — Secure auth/authz patronen. **Toepassing:** audit `apps/web/lib/supabase/middleware.ts` — session refresh + token exchange; voeg MFA-pad toe voor toekomstige multi-user; zet korte session lifetime in Supabase Auth settings (nu default 1 week).
- `backend-security-coder` — Input validation + API security. **Toepassing:** sweep over alle zod schemas in `packages/shared/src/schemas.ts` en API routes; voeg `z.string().trim().max(N)` overal toe; check op SSRF in Edge Functions die externe URLs fetchen (`fetch-tweakers-prices`, `lookup-*`).
- `broken-authentication` — OWASP broken-auth detection. **Toepassing:** test scenario's op `apps/web/app/login/page.tsx` en mobile `login.tsx` — geen info-leak in errors, sessie invalidate bij logout, geen enum op bestaande accounts.
- `cc-skill-security-review` — Pre-commit security review skill. **Toepassing:** run na elke feature op wijzigingen; vooral op nieuwe Edge Functions en MCP tools die service role key gebruiken.
- `supply-chain-security` / `aegisops-ai` — DevSecOps guardrails. **Toepassing:** Dependabot/Renovate voor de 953 npm deps; `pnpm audit` in CI; checksum-verify Supabase MCP tools die door Claude gebruikt worden.

**Gezamenlijke impact:** dichtgesmeerde auth flow, rate-limited API, gevalideerde input overal, dependency-supply-chain onder controle.

### 3.2 Performance & Scalability (6 skills)

- `application-performance-performance-optimization` — End-to-end performance optimization. **Toepassing:** baseline meten op Vercel prod (Core Web Vitals); focus op `/inventory` (table rendering bij 1000+ rijen) en `/upload` (bulk photo resize).
- `web-performance-optimization` — Core Web Vitals, bundle size, caching. **Toepassing:** `/listings` en `/inventory` pages lazy-loaden met `Suspense` boundaries; Recharts uit critical path halen (dynamic import); `next/image` config voor Supabase signed URLs.
- `database-cloud-optimization-cost-optimize` — Cloud + DB cost optimization. **Toepassing:** Supabase indexes: check of `photos.product_id`, `listings.status`, `products.sticker_id` (UNIQUE al aanwezig), `price_history.product_id` indices optimaal zijn bij schaal; vacuum-tuning voor `claude_analyses` (JSONB-heavy).
- `performance-optimizer` — Bottleneck identificatie. **Toepassing:** profile `/taxatie/generate` (renderToBuffer kan seconden kosten bij 20+ foto's); cache signed URLs kort per product; hoist Supabase query in `/inventory` page (N+1 risk bij photos count).
- `performance-profiling` — Measurement + analysis. **Toepassing:** instrument `POST /api/stickers/generate` timing; log p50/p95/p99 via server-side OTel; baseline mobile `capture.tsx` ML Kit latency.
- `zipai-optimizer` — Token/context optimization. **Toepassing:** MCP tool responses kunnen groot worden bij `list_inventory` met 100+ items; trunk/truncate als Claude context schaars wordt; paginate getInventory.

**Gezamenlijke impact:** lagere p95 latency op alle routes, schaalbaar naar 10k+ producten zonder query-degradatie, lagere Supabase/Vercel-kosten.

### 3.3 UX/UI & Accessibility (6 skills)

- `accessibility-compliance-accessibility-audit` — WCAG audit + remediation. **Toepassing:** volledige audit op alle web pages; focus op color contrast (Tailwind muted-foreground vs muted), keyboard-only nav door filters in `/inventory`, form-labels in modals (add-product + sticker-form).
- `screen-reader-testing` — Screen reader validation. **Toepassing:** test NVDA/JAWS op `/inventory` tabel, `/listings/[id]` approve flow, en `/taxatie` checklist; voeg `aria-live` toe aan toast notifications (sonner default werkt deels).
- `tailwind-design-system` — Production design system. **Toepassing:** consolideer kleuren in `apps/web/app/globals.css @theme` block; extract button/card variants via `class-variance-authority` (al geïnstalleerd) in `components/ui/*`.
- `tailwind-patterns` — Tailwind v4 CSS-first + container queries. **Toepassing:** `/inventory` tabel → container query voor responsive kolommen op mobile; `/listings/[id]` edit form → grid gap tokens consistent.
- `ui-a11y` — WCAG 2.2 fixes. **Toepassing:** elk interactieve element (Pressable in mobile, button in web) minimaal 44×44pt; focus-visible styles op buttons; semantic headings hierarchy check.
- `zod-validation-expert` — Zod + react-hook-form integratie. **Toepassing:** upgrade alle forms naar consistent pattern: `zodResolver(schema)` + `form.handleSubmit`; unified error-display component die aria-invalid zet.

**Gezamenlijke impact:** WCAG 2.2 AA compliant, keyboard-workflows, screen-reader-bruikbaar, consistente design tokens.

### 3.4 Mobile Experience (6 skills)

- `expo-deployment` — Expo/EAS deployment workflows. **Toepassing:** documenteer EAS Build profielen (al in `eas.json`); voeg EAS Update toe voor OTA JS-bundel-updates na publish.
- `expo-dev-client` — Development client setup. **Toepassing:** reeds nodig voor ML Kit; voeg `expo-dev-menu` shortcuts toe voor snel toggle tussen staging/prod Supabase.
- `expo-cicd-workflows` — EAS Workflows voor CI/CD. **Toepassing:** na merge naar `main` auto-build dev-client + preview `.apk`; notificeer bij falende build.
- `expo-api-routes` — Expo API routes patronen. **Toepassing:** overweeg expo-router API routes als je serverless-op-mobile nodig hebt (bijv. offline sync bridge).
- `react-native-architecture` — RN production patterns (nav, state, native modules, offline). **Toepassing:** migreer `(tabs)/capture.tsx` state machine naar `zustand` store voor session-recovery bij app-crash; voeg `react-native-reanimated` waardes toe aan shutter-button voor haptic feedback.
- `mobile-developer` — General mobile skill reference. **Toepassing:** codereview op `capture.tsx` — image compression vóór Supabase upload (nu gebeurt het via `quality: 0.8` expo-camera; voeg `expo-image-manipulator` voor resize).

**Gezamenlijke impact:** OTA updates, CI/CD op mobile, offline-ready architecture, consistente native-quality interacties.

### 3.5 Testing & QA (7 skills)

- `code-review-checklist` — Structured code review. **Toepassing:** voeg `.github/PULL_REQUEST_TEMPLATE.md` met checklist; configureer CodeRabbit (skill beschikbaar) voor auto-reviews.
- `code-reviewer` — Elite code review specialist. **Toepassing:** run `/coderabbit:code-review` na elke grote feature; prioriteer security findings.
- `debugger` + `debugging-strategies` + `error-detective` — Debug workflows. **Toepassing:** formaliseer foutdiagnose SOP voor productie: Supabase logs → Vercel logs → MCP inspector → reproduceer lokaal.
- `e2e-testing` — Playwright E2E. **Toepassing:** scaffolden `tests/e2e/` met critical flows: login → create product → generate sticker PDF → create listing → mark published. Runt in GitHub Actions + preview-deploys.
- `awt-e2e-testing` — AI-powered E2E met YAML scenarios. **Toepassing:** declarative tests voor inventaris-flow die Claude Code kan onderhouden; visual matching (OpenCV+OCR) handig voor sticker-PDF output.
- `azure-microsoft-playwright-testing-ts` — Playwright cloud. **Toepassing:** later als NL LOCAL runs te traag zijn voor CI; alternatief: Vercel preview-env + playwright-native.
- `bats-testing-patterns` — Bash script testing. **Toepassing:** test helper-scripts (deploy, migraties) als je er meer krijgt.

**Gezamenlijke impact:** regressie-detectie, automatische PR reviews, gestructureerd foutdiagnose, CI/CD-geïntegreerde E2E runs.

### 3.6 Observability & Monitoring (6 skills)

- `observability-engineer` — Comprehensive observability. **Toepassing:** introduceer Sentry (skill beschikbaar) voor frontend errors + server errors; config `.sentryclirc` per app.
- `observability-monitoring-monitor-setup` — Metrics, tracing, logs aggregation. **Toepassing:** OpenTelemetry collector op Vercel Edge + Supabase Edge Functions; export naar Honeycomb/Grafana Cloud free tier.
- `observability-monitoring-slo-implement` — SLO/SLI + error budget. **Toepassing:** definieer SLOs: login success rate >99%, `/api/products/bulk` <2s p95, Edge Function `lookup-ean` <500ms p50; alert bij burn-rate.
- `error-debugging-error-trace` — Error tracking. **Toepassing:** Sentry integratie in `apps/web/app/layout.tsx` + `apps/mobile/app/_layout.tsx`; source maps uploaden in CI.
- `grafana-dashboards` — Production dashboards. **Toepassing:** dashboards voor: products-created/hour, listings-per-platform, edge-function-latency, failed-uploads; link vanuit `/` dashboard.
- `claude-monitor` — Performance diagnose voor Claude. **Toepassing:** MCP server response times meten (elk tool-call), logs naar Supabase table voor replay.

**Gezamenlijke impact:** zichtbaarheid in productie errors, latency budgets bewaakt, data-driven iteratie.

### 3.7 DevOps & CI/CD (6 skills)

- `deployment-engineer` — CI/CD + GitOps. **Toepassing:** voeg GitHub Actions workflow: `.github/workflows/ci.yml` met typecheck + build + lint; required status checks op PR → main.
- `deployment-pipeline-design` — Multi-stage pipelines. **Toepassing:** 3-stage flow: preview (Vercel per PR) → staging (aparte Supabase project) → prod; gate preview→staging op E2E green.
- `deployment-procedures` — Safe deployment + rollback. **Toepassing:** documenteer runbook in `SETUP.md` met: Vercel rollback via dashboard (instant), Supabase migration rollback via `supabase migration repair`, Edge Function via eerdere versie deployen.
- `deployment-validation-config-validate` — Config validation. **Toepassing:** `apps/web/lib/env.ts` uitbreiden met runtime check + preflight bij Vercel build (fail-fast); zelfde pattern voor `apps/mobile`.
- `docker-expert` — Docker best practices. **Toepassing:** Dockerfile voor MCP server zodat deze als container draait (alternatief voor tsx-lokaal); multi-stage voor kleine image.
- `cloudformation-best-practices` / `terraform-specialist` — IaC. **Toepassing:** beschrijf Supabase project + Vercel project in Terraform zodat je complete infra reproduceerbaar is (herstel na account-issue).

**Gezamenlijke impact:** veilige deploys met rollback-pad, preview-environments per PR, reproduceerbare infra.

### 3.8 Data Model & Schema (7 skills)

- `airflow-dag-patterns` — Data pipeline orchestration. **Toepassing:** mogelijk later als price_watches exploderen; voor nu pg_cron voldoende. Voor backups: cron die dagelijks `pg_dump` naar storage maakt.
- `data-migration` — Schema migratie strategieën. **Toepassing:** documenteer migration-workflow in SETUP.md: lokaal via Supabase MCP `apply_migration`, production via PR → review → run.
- `database-optimizer` / `sql-pro` — Query optimization. **Toepassing:** EXPLAIN ANALYZE op de top-3 queries: `list_inventory` met alle filters, `/inventory` tabel, `/dashboard` stats; index composietskey `(status, indexed_at DESC)` op products.
- `postgresql` — PostgreSQL-specifieke schema patterns. **Toepassing:** materialized view voor dashboard stats (nu 5 COUNT queries); refresh via pg_cron elk kwartier; partial indexes voor `WHERE status = 'indexed'`.
- `data-quality-frameworks` — Great Expectations / dbt tests. **Toepassing:** overweeg `dbt` niet-kritisch; voor nu eenvoudige CHECK constraints toevoegen: `products.recommended_price >= 0`, `photos.order_index >= 0`.
- `event-store-design` + `projection-patterns` — Event sourcing (DDD). **Toepassing:** voeg `activity_log` tabel toe (eenvoudige event stream) zodat je een product-historie kan tonen: created → photo_added → listed → sold. Geen full CQRS, wel context voor Claude.
- `vector-database-engineer` + `embedding-strategies` — Vector DB. **Toepassing:** Supabase pgvector voor image similarity (find-matching-products), voor NLP-search ("mijn oude rode shirt"). Embeddings via Cohere NL embed model of CLIP.

**Gezamenlijke impact:** schaalbaar DB-model, queryperformance op orde, audit-historie per product, semantic search mogelijk.

### 3.9 Backend Architecture (6 skills)

- `api-design-principles` — REST/GraphQL/tRPC principles. **Toepassing:** review alle API routes; zet HTTP status codes consistent (409 bij conflict — al gedaan voor overlap; 422 i.p.v. 400 voor validation errors); ETag op GET endpoints.
- `api-patterns` — API decision-making. **Toepassing:** pagination strategie voor `/api/products` (nu ontbreekt); cursor-based (since_id) voor toekomstige mobile infinite-scroll.
- `nextjs-app-router-patterns` — Next.js 14+ patterns. **Toepassing:** `generateMetadata` voor dynamische OG-images per product-detail (social share); Parallel Routes voor side-by-side modals; Intercepting Routes voor photo lightbox in `/inventory/[sticker]`.
- `code-refactoring-refactor-clean` — Clean code + SOLID. **Toepassing:** `api/listings/[id]/route.ts` heeft inline update-logica; extract naar `lib/listings/service.ts` met unit tests. Zelfde voor bulk.
- `async-python-patterns` — (niet direct relevant, we zijn TS-first). Fallback: `async-typescript-patterns` equivalent zoeken.
- `c4-container` — C4 Container documentation. **Toepassing:** genereer `docs/architecture/container.md` met C4-diagram (web + mobile + edge + MCP + Supabase + Vercel + GitHub). Mermaid-diagram in README.

**Gezamenlijke impact:** API consistent + gedocumenteerd, cleane service-laag, begrijpelijke architectuurdiagrammen.

### 3.10 Frontend Architecture (6 skills)

- `nextjs-app-router-patterns` — Server vs client components. **Toepassing:** verifieer elke page.tsx doet alleen server-only queries; client components in aparte bestanden (al goed gedaan); gebruik `revalidatePath` na mutaties i.p.v. router.refresh().
- `frontend-mobile-development-component-scaffold` — React component scaffolding. **Toepassing:** standaardiseer een `ComponentName/` folder-structuur met: index.tsx, styles.ts, hooks.ts, types.ts; begin met `components/ui/button/`.
- `fp-react` + `fp-ts-react` — Functional patterns in React. **Toepassing:** `Result<T, E>` pattern voor API fetches (i.p.v. try/catch overal); consistent error-handling via `Either`.
- `cloudflare-workers-expert` — Edge compute. **Toepassing:** overweeg offline PWA via Cloudflare Workers + D1 (niet Supabase) als fallback; niet hoogste prio.
- `claude-d3js-skill` — D3.js visualisaties. **Toepassing:** upgrade `dashboard-charts.tsx` van recharts naar d3 voor custom sunburst per categorie-hiërarchie (categorieën hebben `parent_slug`).
- `javascript-typescript-typescript-scaffold` — TS project scaffolding. **Toepassing:** deze skill is een referentie voor nieuwe workspace packages; gebruikt als je `packages/web-sdk/` toevoegt voor client code-gen uit API.

**Gezamenlijke impact:** consistente component patronen, errorhandling-als-first-class-citizen, hergebruikbare SDK's.

### 3.11 API Design & Integration (6 skills)

- `openapi-spec-generation` — OpenAPI 3.1 specs. **Toepassing:** genereer `openapi.yaml` uit de 8 API routes; publiceer als interactieve docs op `/api/docs` (Scalar/Swagger UI); SDK-gen voor mobile app later.
- `api-documentation` + `api-documentation-generator` — Developer guides + auto-gen docs. **Toepassing:** `docs/api.md` met voorbeelden per route; automatic update via CI als zod-schemas wijzigen.
- `api-endpoint-builder` — Production-ready endpoints. **Toepassing:** voor nieuwe endpoints: gebruik dit als template (validatie + authz + rate-limit + error-handling + metric + doc).
- `activecampaign-automation` / `airtable-automation` — External service automation via Rube MCP. **Toepassing:** niet direct, maar patroon voor toekomstige integraties (bijv. Gmail via MCP voor taxatie-email).
- `azure-eventgrid-*` / `azure-eventhub-*` — Event streaming. **Toepassing:** alternatief voor pg_cron + triggers: Supabase webhooks → Event Grid → parallel Edge Function processors. Overkill voor nu.
- `webhook-patterns` (als beschikbaar) — Webhook design. **Toepassing:** implement inbound webhook `/api/webhooks/marktplaats` voor toekomstige auto-sync van status-updates; HMAC verificatie.

**Gezamenlijke impact:** gedocumenteerde API, SDK-genereerbaar, webhook-ready voor toekomstige integraties.

### 3.12 AI/LLM & MCP (7 skills)

- `ai-engineer` — LLM application development. **Toepassing:** MCP tool output tunen — compacter response bij `list_inventory` met >50 items zodat Claude context niet opraakt; streaming via SSE is niet native in MCP, maar gebruik ToolResult `content[]` met progressive updates.
- `ai-engineering-toolkit` — 8-dim prompt eval, context budget, RAG design, security checklist. **Toepassing:** run security audit (65-point) op MCP tools (13×); voeg eval-harness toe in `packages/mcp-server/tests/` met fixture-producten.
- `agent-memory-mcp` — Persistent memory voor agents. **Toepassing:** voeg MCP tool `remember_analysis` toe — slaat user-corrections op zodat Claude leert (bijv. "kandelaar categoriseer ik altijd als antique_other, niet antique_tin").
- `mcp-builder` / `agent-framework-azure-ai-py` — Agent framework patronen. **Toepassing:** de MCP server kan nog meer tools krijgen; patterns voor grouping (bijv. `inventory.*`, `lookup.*` namespaces als tool-count groter wordt).
- `prompt-engineering-patterns` — Prompt engineering. **Toepassing:** tool descriptions verbeteren — nu 1 zin; uitbreiden met voorbeelden van goede prompts van de user side, zodat Claude weet wanneer tool X vs Y.
- `rag-implementation` — RAG systems. **Toepassing:** index alle product-titels + beschrijvingen in pgvector; MCP tool `similar_products` vindt look-alikes (voor bundel-suggesties en duplicate-detectie).
- `langchain-architecture` — LangChain/LangGraph voor agent orchestration. **Toepassing:** niet direct — MCP is simpeler. Maar patroon voor multi-step flows (bijv. analyze-bundel → pricing → draft-listing → review) kan lessen leveren.

**Gezamenlijke impact:** slimmere MCP tools met memory, gevalideerde prompts, semantic-similarity over inventaris.

### 3.13 Content & Documentation (6 skills)

- `openapi-spec-generation` (hergebruik cat 3.11) — API docs als content.
- `docs-architect` — Long-form technical docs. **Toepassing:** genereer `docs/architecture.md` — 1 pagina per subsysteem (db/web/mobile/mcp/edge), diagrammen, data-flow per feature.
- `code-documentation-doc-generate` — Auto-docs from code. **Toepassing:** genereer `docs/mcp-tools.md` uit de tool-definities in `packages/mcp-server/src/tools/*.ts`.
- `context7-auto-research` — Fetch latest library docs. **Toepassing:** CI step `context7-auto-research` voor Next.js 15 / Supabase 2.x / Expo 53 wanneer iemand upgrade PR maakt.
- `avoid-ai-writing` — Remove 21 AI-writing patronen. **Toepassing:** pas toe op `PLAN.md` en `README.md` voordat ze publiek worden (ook in private repo nuttig voor leesbaarheid).
- `seo-aeo-blog-writer` — Long-form content met SEO/AEO. **Toepassing:** schrijf `docs/blog/how-it-works.md` — voor toekomstige landing-page en AI-citation-readiness.

**Gezamenlijke impact:** altijd-actuele docs, architectuur zichtbaar, tekst zonder LLM-cruft.

### 3.14 Analytics & Data (5 skills)

- `google-analytics-automation` — GA4 + Rube MCP. **Toepassing:** GA4 property voor `verkoopassistent.vercel.app`; track events: `sticker_sheet_generated`, `product_indexed`, `listing_approved`.
- `seo-datafor-seo` — Live SERP/keyword data. **Toepassing:** later voor content-marketing van de app zelf; niet direct.
- `seo-technical` — Technical SEO audit. **Toepassing:** `robots.txt`, sitemap, OG-images, structured data (JsonLd) op product-detail pages (private, maar structuur klopt).
- `inventory-demand-planning` — Stock + demand. **Toepassing:** analyse patterns: welke categorieën sellen het snelst? `dashboard-charts.tsx` uitbreiden met "verkooptijd per categorie" uit `products.indexed_at` vs `products.sold_at`.
- `seo-structure-architect` — Content structure. **Toepassing:** (later) voor blog of docs site.

**Gezamenlijke impact:** meetbare product-metrics, historische trends, inzicht in verkoop-snelheid per categorie.

### 3.15 Workflow & Automation (8 skills)

- `ab-test-setup` — Structured A/B test framework. **Toepassing:** test 2 sticker PDF layouts (huidige vs groter nummer); meet OCR success rate in `photos.ocr_confidence`.
- `brainstorming` — Pre-creative-work skill. **Toepassing:** gebruik deze skill VÓÓR elke volgende fase 8/9 plan.
- `code-refactoring-tech-debt` — Quantify + prioritize tech debt. **Toepassing:** scan voor `TODO` + `// @ts-expect-error` + `any`; rank per impact.
- `crewai` — Multi-agent orchestration. **Toepassing:** specialized agents — `indexing-agent`, `pricing-agent`, `listing-agent` — elk met eigen MCP tool subset.
- `apify-actor-development` — Scrapable actors. **Toepassing:** fallback voor brittle scrapers (fetch-tweakers, lookup-silver): Apify actor met betere retries + proxies.
- `apify-ecommerce` — E-commerce data extraction. **Toepassing:** periodieke sync van prijzen bekende items vanuit Marktplaats search; injecteer in `price_history`.
- `apify-brand-reputation-monitoring` — Reviews + ratings scrape. **Toepassing:** voor verkochte items met brand (Samsung RAM, Sony console) — haal reviews op voor verkoopargument in advertentie.
- `daily-news-report` — Scraped content → markdown. **Toepassing:** niet direct, maar inspiratie voor `daily-inventory-report` functie: dagelijks samenvatting van nieuw geïndexeerd + prijs-alerts.

**Gezamenlijke impact:** data-gedreven iteratie, scraper-robuustheid, multi-agent-achtige MCP workflows.

---

**Totaal skills gemapped:** 90 (spread 5-8 per categorie).

---

## 4. Kritieke Review

### 4.1 Usability — friction voor de eigenaar

- 🟠 **Categorieselectie alleen via MCP** — In `apps/web/app/(app)/inventory/page.tsx:46-48` kun je filteren op category, maar er is geen way om in de UI een categorie te *zetten*. Eigenaar moet Claude Desktop openen voor een triviale actie. `add-product-button` laat enkel sticker+werktitel toe — geen category, geen condition, geen EAN. Elke "ik wil even snel X zetten" dwingt een context-switch af.
- 🟠 **Geen inline edit op tabel** — `inventory/page.tsx:162-198` is pure read-only. Voor status-wissel "indexed → archived" of quick price-update moet je per product naar `/inventory/[sticker]` navigeren. Bij 500 items = 500 round-trips.
- 🟡 **Sticker-range filter is brittle** — `inventory/page.tsx:50-53`: `gte("sticker_id", "0042")` werkt TEKSTUEEL. `"42" <= "0100"` = `false`. User die per ongeluk "42" intypt krijgt lege resultaten zonder uitleg.
- 🟡 **Capture flow heeft geen "continue session"** — `apps/mobile/app/(tabs)/capture.tsx:253-265` reset na save, bump sticker +1, maar je kunt niet kiezen om photo-set bij dezelfde sticker toe te voegen (bijv. schadefoto later).
- 🟡 **Dashboard toont geen "wat moet ik nu doen" CTA** — geen "42 producten wachten op categorisatie → open Claude".
- 🟢 **Geen keyboard shortcut op `/stickers` voor `next range`** — manuele input elke keer.

### 4.2 Features — ontbrekende flows

- 🔴 **Geen bulk-delete** — `api/products/[id]/route.ts` doet één-voor-één delete. Inventory table heeft zelfs geen checkbox.
- 🔴 **Geen undo** — product delete → photo storage delete is irreversible. Geen soft-delete, geen `deleted_at`, geen recycle-bin.
- 🟠 **Geen duplicate-sticker recovery** — `api/products/route.ts:50-58` geeft 409 als sticker bestaat, maar biedt geen "merge met bestaande" of "pick next free" flow.
- 🟠 **Geen search binnen MCP op EAN/barcode** — `packages/mcp-server/src/tools/list_inventory.ts:11-21` heeft geen `ean` filter.
- 🟠 **Geen pagination in inventory** — `inventory/page.tsx:19` hardcoded `PAGE_SIZE = 50`. Geen page 2.
- 🟠 **Geen photo-reorder** — `photos.order_index` bestaat, maar geen UI om te wisselen. Advertentie-first-photo bepaalt CTR.
- 🟠 **Geen sticker-sheet "afgekeurd" tracking** — als een vel verloren is ben je je range kwijt zonder recovery-pad.
- 🟡 **Geen "recent activity" feed** — geen audit/activity log.
- 🟡 **Geen quick-add-photo from web** — extra schadefoto toevoegen kan alleen via mobile.
- 🟡 **Geen tags/labels** — naast category_slug geen vrij-veld tagging.

### 4.3 Security posture

- 🔴 **RLS is effectief uit** — `0001_initial_schema.sql:547-570`: ALLE policies zijn `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Geen `auth.uid() = owner_id`. Geen `user_id` kolom. Als iemand ooit een account aanmaakt of Supabase-key lekt: volledige inventaris exposed.
- 🔴 **SSRF in `fetch-tweakers-prices`** — geen rate-limit + verify_jwt betekent dat een compromised token een vrije DoS-relay geeft op Tweakers.
- 🔴 **MCP server draait met SERVICE ROLE key** — Claude Desktop krijgt effectief godmode. Prompt-injection in working_title kan Claude sturen om `update_product`/`delete`-calls te doen. Geen human-in-loop check op `suggest_bundle.ts:75-90`.
- 🔴 **Storage path injection in bulk** — `apps/web/app/api/products/bulk/route.ts:12`: geen regex-validatie dat pad in `inbox/` ligt. Attacker kan `photo_paths: ["../../../other/foto.jpg"]` sturen.
- 🔴 **Prompt-injection via `indexing_notes` + `working_title`** — rechtstreeks in `list_inventory.ts:61` output naar Claude. Geen sanitizer.
- 🟠 **Magic-link auth zonder rate-limit** — iemand kan je inbox DoS'en.
- 🟠 **Geen CSRF protection** — POST via form uit fake HTML page = bypass.
- 🟠 **Zod schemas missen sanitization** — geen `.trim()`, geen XSS-strip.
- 🟠 **Geen CSP, X-Frame-Options, HSTS headers**.
- 🟡 **Service role key plaintext in `claude_desktop_config.json`**.
- 🟡 **`error.message` lekt schema-details naar client**.
- 🟡 **Edge function UA-spoofing van Tweakers** — ToS-overtreding.

### 4.4 Performance reality

- 🟠 **N+1 in MCP `list_inventory`** — `list_inventory.ts:42-44`: `.select("..., photos(count)")` doet subquery per rij.
- 🟠 **PDF render blocking** — `@react-pdf/renderer` `renderToBuffer()` valt om bij grote dossiers (Vercel Hobby 10s timeout).
- 🟠 **Inventory geen streaming** — `count: "exact"` forces full table scan.
- 🟠 **Recharts + pdf-renderer in main bundle** — geen `dynamic(import, { ssr: false })` voor Recharts.
- 🟠 **Geen image optimization** — geen `next/image`, Supabase image transform unused.
- 🟡 **Dashboard 5 losse COUNT queries** — geen materialized view.
- 🟡 **Mobile upload serieel** — `capture.tsx:188-199` `for` loop. 8 foto's 4G = 30-60s. `Promise.all` zou parallel doen.
- 🟡 **Bulk upload re-render storm** — `bulk-upload.tsx:50-76` setState per foto.

### 4.5 Code quality

- 🟠 **Sticker-ID-vs-UUID detectie hackig** — `id.length === 4 ? "sticker_id" : "id"`. Herhaalt op meerdere plekken.
- 🟠 **Dubbele logica: mobile capture vs /api/products** — `capture.tsx:187-246` bypass de API, doet eigen insert. Business-rules drift-risk.
- 🟠 **`api_model: "claude-sonnet-4-6"` in seed data** — dead code, geen code leest dit.
- 🟡 **Magic numbers** — `setStickerConfidence(0.85)` vs `0.95` vs `0.75`. Ongedocumenteerd.
- 🟡 **Error shape-drift** — 401 = `{error}`, 400 = `{error, issues}`, 207 = `{product, warning}`.
- 🟡 **`sticker_input_method` logica ambigu** in bulk/route.ts.
- 🟢 **Geen `eslint --max-warnings=0` in CI**.

### 4.6 Data integrity

- 🔴 **Race condition op `last_sticker_number`** — parallel inserts kunnen allebei "0043" claimen. Geen `SELECT FOR UPDATE`.
- 🔴 **CASCADE delete** op 5 tabellen (photos/bundle_items/listings/buyback_quotes/price_history) — delete van 1 product = historie weg.
- 🔴 **`taxatie_exports.product_id` geen ON DELETE** — orphan-risk.
- 🟠 **JSONB `specs` schema-drift** — geen validatie dat `products.specs` voldoet aan `categories.spec_schema`.
- 🟠 **`app_settings.value JSONB`** — string-drift kan `Number()` crashen.
- 🟠 **Bundle + individual listing dubbel** — product kan zowel in bundle als individueel `published` zijn. Dubbelverkoop.
- 🟠 **`products.sticker_id` UNIQUE maar nullable** — inconsistente identifier.
- 🟡 **Geen CHECK op prijzen** — `recommended_price` kan negatief.
- 🟡 **Enum-drift risico** — category_slug vereist migration voor nieuwe waarde.

### 4.7 Error handling

- 🟠 **Silent failure bij photo insert** — `bulk/route.ts:100-102`: errors gevangen maar product-rij blijft staan zonder foto.
- 🟠 **Geen retry op Edge Function failures** — price-watcher geen exponential backoff.
- 🟠 **`app_settings.update` zonder affected-rows check** — silent no-op mogelijk.
- 🟠 **`Alert.alert` blokkeert mobile UI** — `capture.tsx:122, 160, 267` geen toast, geen retry.
- 🟠 **Geen correlation ID** — logs en user-error niet te matchen.
- 🟡 **Geen gestructureerd logging** — `console.log` of niets.
- 🟡 **Edge function generic 502** — "Tweakers response 502" zegt niks.
- 🟡 **PDF render failure = lege loader** — geen catchable state.

### 4.8 Scalability

- 🔴 **Storage bij 50k foto's = €€€** — Free tier 1GB, 50k × 500KB = 25GB. Egress 200GB gratis dan €0.09/GB.
- 🔴 **`photos(count)` subquery bij 10k products** — materialized view nodig boven ~5k.
- 🟠 **Sticker-ID bereik 0001-9999** hard limit. Geen 5-digit migratie pad.
- 🟠 **Inventory tabel zonder virtualization** — 500 tr's DOM.
- 🟠 **MCP response size onbeperkt** — `list_inventory(limit=200)` = ~50KB token-explosie.
- 🟡 **Geen pagination op listings**.
- 🟡 **`claude_analyses.claude_response JSONB`** groeit ongelimiteerd.
- 🟡 **Recharts weekly line** laadt alle producten client-side.

### 4.9 Maintainability

- 🟠 **Zero tests** — bij refactor alles regressie-risk.
- 🟠 **Geen observability** — prod-incident = blind.
- 🟠 **PLAN.md en codebase lopen uit elkaar** — PLAN zegt Expo 55 + 6 MCP tools, codebase is 53 + 13.
- 🟠 **Coupling MCP ↔ Supabase schema** — schema-wijziging breekt MCP.
- 🟠 **Edge Functions copy-pasted** — corsHeaders/json helper 5× herhaald.
- 🟡 **3 Supabase client instanties** (mobile/web/MCP) — config-drift mogelijk.
- 🟡 **Geen ADRs**.
- 🟡 **`database.types.ts` handmatig** — geen CI-gate op drift.
- 🟢 **Geen C4 architecture diagram** in repo.

### 4.10 Business value / ROI voor solo-user

- 🟠 **Catawiki in platforms-enum, geen integratie-pad** — overengineered.
- 🟠 **Cardmarket + eBay + 5 buyback_services geseed maar ongebruikt** — feature-zwaar.
- 🟠 **`price_watches` met pg_cron** — voor ~10 items: overkill; poll-on-open had gewerkt.
- 🟠 **Taxatie-dossier is antiek-only** — veel code voor lage benutting.
- 🟡 **3 sticker-input modes** — user kiest er 1 in praktijk. YAGNI.
- 🟡 **Silver + tin hallmark lookups** — brittle scrapers, maintenance > value.
- 🟡 **Bundle + individual listing UI** — bundles komen ~5× voor bij 200 items.
- 🟡 **MCP tool `ping`** — dead in prod.
- 🟢 **`claude_analyses` log** — nooit teruggelezen in UI.

---

## 5. 20 Nieuwe Feature Voorstellen

### 5.1 Voor Betere Indexering (10)

#### 1. Voice-Dicteren naar Notitie
- **Type:** Indexering
- **Use case:** Hold-to-record tussen foto's, native speech-to-text transcribeert naar `indexing_notes`.
- **Impact:** ~70% tijdwinst op notitie-stap (200 items: 20-30 min i.p.v. 1-2u). Handschoenen-vriendelijk.
- **Implementatie:** `expo-speech-recognition` in `capture.tsx`; push-to-talk button; `notes` state append.
- **Complexity:** S · **Dependencies:** geen

#### 2. Multi-Product Capture Mode
- **Type:** Indexering
- **Use case:** Lade met 20 kleine items, één foto → app detecteert N stickers → crops per sticker → N products.
- **Impact:** Lades/dozen met 10+ items nu buiten 1-product-per-sticker model; 30-40% huis. 10× sneller.
- **Implementatie:** ML Kit ObjectDetection + TextRecognition, `expo-image-manipulator` crops. Nieuwe `photos.source_photo_id` self-ref.
- **Complexity:** L · **Dependencies:** `expo-image-manipulator`

#### 3. EAN-First Fast-Track
- **Type:** Indexering
- **Use case:** Scan EAN → auto-lookup → titel+category+specs prefilled → 1 product-foto → klaar, zonder Claude.
- **Impact:** 60% elektronica/huishouden heeft EAN; skipt MCP-step voor ~40% items.
- **Implementatie:** Cache tabel `ean_cache`. Mobile `onBarcodeScanned` → Edge Function → prefill UI.
- **Complexity:** M · **Dependencies:** bestaande `lookup-ean`

#### 4. Auto-Dedupe via Perceptual Hash
- **Type:** Indexering
- **Use case:** Per ongeluk zelfde item 2× sticker → app berekent pHash, toast: "Lijkt op 0042 — dedupe?"
- **Impact:** 2-5% duplicaten over 500 items = 10-25 items. Voorkomt dubbel werk.
- **Implementatie:** Server-side pHash via Edge Function. `photos.phash BIGINT`. Hamming distance query na upload.
- **Complexity:** L · **Dependencies:** pgvector of int64 bit-ops

#### 5. Categorie-Templates per Quick-Pick
- **Type:** Indexering
- **Use case:** Row met top-5 meest-gebruikte categorie-chips. Klik "RAM" → category+specs form preset.
- **Impact:** 40% minder form-velden in hardware-sessies.
- **Implementatie:** `app_settings.recent_categories`, row in `capture.tsx` configure phase.
- **Complexity:** S · **Dependencies:** geen

#### 6. Sticker Camera Overlay met Live OCR
- **Type:** Indexering
- **Use case:** Live viewfinder toont welk 4-cijfer nummer zichtbaar is. Auto-capture bij confidence > 0.9.
- **Impact:** 15-20% OCR-fails (foto→mislukt→opnieuw) weg.
- **Implementatie:** `expo-camera` frame processor + ML Kit real-time, 2fps throttle.
- **Complexity:** M · **Dependencies:** expo-camera frame processor

#### 7. Batch-Sticker Reservation
- **Type:** Indexering
- **Use case:** Reserveer 0500-0550 voor sessie. Anderen (mobile parallel) kunnen die range niet gebruiken.
- **Impact:** Lost race-condition (4.6.1) op; offline doorwerken zonder sync-conflict.
- **Implementatie:** Tabel `sticker_reservations (range_start, range_end, session_id, expires_at)`.
- **Complexity:** M · **Dependencies:** geen

#### 8. Offline-Queue met Sync
- **Type:** Indexering
- **Use case:** Op zolder zonder WiFi: indexeer 30 items, foto's in MMKV queue, upload on-resume.
- **Impact:** Huidige capture faalt bij 0 internet; huis heeft dead-zones.
- **Implementatie:** MMKV queue + `@tanstack/react-query` offlineFirst + `NetInfo` listener.
- **Complexity:** L · **Dependencies:** `@react-native-community/netinfo`

#### 9. QR-per-Doos Container ID
- **Type:** Indexering
- **Use case:** "DOOS-07" QR op kist → alle sessie-items krijgen `container_id=DOOS-07`. Later: "waar is 0043?" → "DOOS-07".
- **Impact:** Fysiek terugvinden zonder 200 dozen doorzoeken.
- **Implementatie:** `containers` tabel, `products.container_id` FK, nieuwe capture-mode, PDF-gen uitbreiden.
- **Complexity:** M · **Dependencies:** bestaande QR-scan

#### 10. Session Recap Screen
- **Type:** Indexering
- **Use case:** Swipe-through review van 30 net-geïndexeerde items met condition quick-pick + korte notitie. Batch-save.
- **Impact:** Rijkere metadata 5× vaker ingevuld.
- **Implementatie:** Nieuwe `app/(tabs)/review.tsx`, `@shopify/flash-list`, session-id uit feat 7.
- **Complexity:** M · **Dependencies:** feat 7

### 5.2 Voor Items-Uit-Huis Identificatie (10)

#### 11. Huis-Video-Scan Walkthrough
- **Type:** Item-ID
- **Use case:** 2-min video van zolder → frames samplen 0.5s → object-detection → "12 items gedetecteerd niet in inventaris".
- **Impact:** Fundamenteel. Zolder → 50-100 items die anders nooit worden geïndexeerd.
- **Implementatie:** `expo-video` frame extraction → Edge Function met Hugging Face DETR-ResNet-50 → `house_scans` tabel.
- **Complexity:** XL · **Dependencies:** HF endpoint

#### 12. Categorieën-Blinde-Vlekken Audit
- **Type:** Item-ID
- **Use case:** Dashboard: "200 items, 0 boeken, 0 LP's, 0 kleding. Waarschijnlijk ongeïndexeerd." Link "start boeken-sessie".
- **Impact:** Boeken/LP's/kleding verkopen goed. Per categorie 20-50 potentiële items.
- **Implementatie:** `apps/web/app/(app)/suggestions/page.tsx` + enum uitbreiding (`book`, `vinyl`, `clothing`, `kitchenware`, `tools`, `toys_vintage`).
- **Complexity:** S · **Dependencies:** geen

#### 13. "Wat Verkoopt Snel op Marktplaats" Data-Feed
- **Type:** Item-ID
- **Use case:** "Deze week 1200 LEGO-sets verkocht. Heb jij LEGO?" Context-gedreven prompts.
- **Impact:** Trigger voor items die user niet uit zichzelf als verkoopbaar ziet.
- **Implementatie:** Edge Function `fetch-marktplaats-trending`, `market_trends` tabel, MCP tool `get_market_trends`.
- **Complexity:** L · **Dependencies:** Marktplaats API/scraping

#### 14. Seizoens-Prompts
- **Type:** Item-ID
- **Use case:** November: "Ski? Winterbanden? Kerstversiering?". Maart: "Zomerspeelgoed?".
- **Impact:** Seizoensgebonden items 3-5× sneller verkocht bij goede timing.
- **Implementatie:** `SEASONAL_PROMPTS` map in `lib/seasonal.ts`. Dashboard alert + MCP tool `get_seasonal_opportunities`.
- **Complexity:** S · **Dependencies:** geen

#### 15. Foto-Album Import Scan
- **Type:** Item-ID
- **Use case:** Sync camera-roll → detecteer object-foto's → "34 foto's van electronics niet in inventaris".
- **Impact:** Bestaande foto's "voor later" omzetten naar indexering-kandidaten.
- **Implementatie:** `expo-media-library` + object-detection (feat 11) + pHash match (feat 4). `import_candidates` tabel.
- **Complexity:** L · **Dependencies:** feat 4, feat 11

#### 16. Hobby-Restanten Checklist
- **Type:** Item-ID
- **Use case:** User vult "hobbies: aquarium, modelbouw" in → app genereert checklist "filter, testkits, air-pump, onafgemaakte bouwpakketten".
- **Impact:** Verlaten hobbies die user zelf niet systematisch doorloopt.
- **Implementatie:** `app_settings.abandoned_hobbies: string[]`, gecureerde `HOBBY_ITEMS` map, web checklist.
- **Complexity:** M · **Dependencies:** gecureerde itemlijst

#### 17. Zolder/Kelder Heat-Map
- **Type:** Item-ID
- **Use case:** Dashboard grid-heat-map: "Zolder-hoek-links: 3 maanden niet bezocht, 0 items geïndexeerd."
- **Impact:** Fysieke dode-hoeken zichtbaar maken.
- **Implementatie:** `locations` tabel, web grid met recency-kleur.
- **Complexity:** M · **Dependencies:** feat 9

#### 18. Kledingkast-Bulk-Mode
- **Type:** Item-ID
- **Use case:** Foto op hanger + label-macro → OCR brand/size → product-prefill. Batch 20 stuks.
- **Impact:** Vinted-markt: honderden € per kast die nu niet wordt aangeraakt.
- **Implementatie:** Nieuwe capture-mode "clothing", OCR regex voor brand/size, `clothing` category met spec_schema.
- **Complexity:** M · **Dependencies:** feat 5

#### 19. Boeken-ISBN Rapid-Scan
- **Type:** Item-ID
- **Use case:** ISBN-barcode → Google Books API → titel/auteur/cover → product in 3s. 50 boeken in 5 min.
- **Impact:** Boekenkast met 200 boeken nu "te traag" om te indexeren.
- **Implementatie:** `lookup-book` Edge Function via Google Books API. `book` category. Mobile sticker-mode "book".
- **Complexity:** M · **Dependencies:** Google Books API

#### 20. Claude-Driven Room Audit
- **Type:** Item-ID
- **Use case:** Claude Desktop: "Foto van mijn woonkamer — wat staat er dat niet in inventaris?" Claude vergelijkt met samenvatting.
- **Impact:** Claude Vision + MCP. Foto > 50 items handmatig checken. Elke kamer.
- **Implementatie:** Nieuwe MCP tools `get_inventory_summary` + `create_product_stub` (sticker_id=null, later fysiek plakken).
- **Complexity:** M · **Dependencies:** MCP additions

---

## 6. Prioritering & Roadmap

| Rank | Item | Categorie | Impact | Effort | Prio |
|------|------|-----------|--------|--------|------|
| 1 | Proper RLS met user_id (4.3.1) | review-security | Voorkomt data-exposure | M | 🔴 Must |
| 2 | MCP service-role scoping + human-in-loop (4.3.3) | review-security | Beperkt prompt-injection blast | M | 🔴 Must |
| 3 | Storage path validation (4.3.4) | review-security | Blokkeert path-traversal | S | 🔴 Must |
| 4 | Race-condition fix `last_sticker_number` (4.6.1) | review-data | Geen duplicate-sticker crashes | M | 🔴 Must |
| 5 | Bulk-delete + soft-delete/undo (4.2.1+2) | review-features | Geen irreversibel dataverlies | M | 🔴 Must |
| 6 | Pagination inventory + listings (4.2.5) | review-features | Werkbaar >50 items | S | 🔴 Must |
| 7 | Prompt-injection sanitizer MCP inputs (4.3.5) | review-security | Minimaliseert hijack | S | 🔴 Must |
| 8 | Structured error-handling + correlation IDs (4.7.5) | review-error | Prod-debug | M | 🟠 Should |
| 9 | CASCADE + soft-delete strategie (4.6.2) | review-data | Recoverable model | L | 🟠 Should |
| 10 | E2E test suite critical flows (4.9.1) | review-maint | Regressie-vangnet | L | 🟠 Should |
| 11 | **Feat 11: Huis-Video-Scan** | feature-item-id | 50-100 verborgen items | XL | 🟠 Should |
| 12 | **Feat 19: Boeken-ISBN Rapid-Scan** | feature-indexering | 200 boeken in 20 min | M | 🟠 Should |
| 13 | **Feat 3: EAN-First Fast-Track** | feature-indexering | 40% items skip Claude | M | 🟠 Should |
| 14 | **Feat 12: Categorieën-Blinde-Vlekken** | feature-item-id | Nudge ontbrekende segmenten | S | 🟠 Should |
| 15 | **Feat 1: Voice-Dicteren** | feature-indexering | 70% tijdwinst notities | S | 🟠 Should |
| 16 | **Feat 14: Seizoens-Prompts** | feature-item-id | Timing op bestaande data | S | 🟠 Should |
| 17 | **Feat 20: Claude-Driven Room Audit** | feature-item-id | Hoge-ROI Claude Vision | M | 🟠 Should |
| 18 | **Feat 8: Offline-Queue Mobile** | feature-indexering | Werkt in dead-zones | L | 🟠 Should |
| 19 | **Feat 2: Multi-Product Capture** | feature-indexering | 10× voor lade-items | L | 🟡 Nice |
| 20 | **Feat 18: Kledingkast-Bulk** | feature-item-id | Nieuwe markt-categorie | M | 🟡 Nice |

---

*Einde ANALYSE.md — volgende iteratie: pak top-7 Must items als Fase 8 security hardening, dan feats 12/14/1 als Fase 9 quick-wins (allen S).*
