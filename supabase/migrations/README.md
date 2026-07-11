# Migrations

Deze map spiegelt de migration-history van het live Supabase project
(`ffifhjwjauvhohmhhbip`). Bestandsnamen = `supabase_migrations.schema_migrations.version`
op het project, zodat `supabase migration list` lokaal en remote 1:1 matcht.

| Bestand | Fase | Opmerking |
|---|---|---|
| `20260416155445_initial_schema.sql` | 1 | |
| `20260416160521_harden_update_updated_at.sql` | 8-prep | `search_path` pin |
| `20260416173708_storage_rls_policies.sql` | — | Storage object policies |
| `20260416180000_price_watcher_cron.sql` | 7 | ⚠️ handmatig toegepast via SQL editor, staat **niet** in de remote history. Vereist Vault secret `service_role_key` (zie SETUP.md). |
| `20260417034422_security_hardening_phase8.sql` | 8 | user_id + RLS + `reserve_next_sticker` |
| `20260417035459_ean_cache_phase11.sql` | 11 | |
| `20260417060846_performance_phase14.sql` | 14 | matview + `list_inventory_with_counts` |
| `20260417061300_clothing_category_phase15.sql` | 15 | |
| `20260417155628_power_features_phase16.sql` | 16 | containers / house_scans / market_trends / import_candidates / phash — DB-only, app-code volgt nog |
| `20260710210354_storage_buckets.sql` | — | idempotente bucket-creatie |
| `20260711015716_multi_tenant_phase21.sql` | 21 | multi-tenant: per-user stickers/app_settings, profiles, DEFAULT auth.uid(), storage-isolatie |

## Sync-status herstellen

Als `supabase db push` klaagt dat `20260416180000` remote ontbreekt terwijl de
cron al draait:

```bash
supabase migration repair --status applied 20260416180000
```

Nieuwe migrations: altijd via `supabase migration new <naam>` (of MCP
`apply_migration`) **én** het bestand hier committen — nooit alleen tegen de
live database draaien.
