# Lovable Leftovers

Files and lines that depend on Lovable auth or a Lovable-managed Supabase client.
Replace these during the auth feature — do not touch before then.

| File | Scope | What to replace with |
|---|---|---|
| `src/integrations/lovable/index.ts` | Entire file | Your own OAuth / auth-provider calls |
| `src/integrations/supabase/previewAuthStorage.ts` | Entire file | Standard `localStorage` adapter or `@supabase/ssr` cookie storage |
| `src/integrations/supabase/client.ts:4` | `import { brokeredPreviewStorage }` | Remove import |
| `src/integrations/supabase/client.ts:55` | `storage: brokeredPreviewStorage()` | Your own storage adapter (e.g., cookie-based for SSR) |
| `src/integrations/supabase/auth-middleware.ts` | Entire file | JWT validation middleware or `@supabase/ssr` server helper |
| `src/integrations/supabase/auth-attacher.ts` | Entire file | Your own request auth-header attacher |
| `src/integrations/supabase/cron-auth.ts` | Entire file | Service-role key approach for scheduled jobs |
| `src/integrations/supabase/client.server.ts:44` | Error message still says "Connect Supabase in Lovable Cloud." | Update message to match `.env.example` naming |
| `package.json` | `@lovable.dev/cloud-auth-js` dependency | Remove after auth is migrated |
| `package.json` | `@lovable.dev/vite-tanstack-config` devDependency | **Do not remove** until you have a replacement Nitro/Cloudflare build config |

> [!WARNING]
> `@lovable.dev/vite-tanstack-config` provides the entire Vite + Nitro + Cloudflare build pipeline.
> Removing it without a replacement will break `npm run build`.

## Resolved Items
- `supabase/config.toml`: Updated from old Lovable `shvztrkqacqftukuainq` to user project reference ID `aftnzwfqeebkxyclbfxn`.
