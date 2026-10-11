# Lovable Leftovers

Files and lines that depend on Lovable auth or a Lovable-managed Supabase client.
Replace these during the auth feature — do not touch before then.

| File                                              | Scope                                                         | What to replace with                                                         | Status                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/integrations/lovable/index.ts`               | Entire file                                                   | Your own OAuth / auth-provider calls                                         | ✅ Replaced with stub; OAuth now calls `supabase.auth.signInWithOAuth()` |
| `src/integrations/supabase/previewAuthStorage.ts` | Entire file                                                   | Standard `localStorage` adapter or `@supabase/ssr` cookie storage            | ✅ Replaced with stub; client uses `SwitchableStorage` adapter           |
| `src/integrations/supabase/client.ts:4`           | `import { brokeredPreviewStorage }`                           | Remove import                                                                | ✅ Removed                                                               |
| `src/integrations/supabase/client.ts:55`          | `storage: brokeredPreviewStorage()`                           | Your own storage adapter                                                     | ✅ Replaced with `SwitchableStorage` (localStorage / sessionStorage)     |
| `src/integrations/supabase/auth-middleware.ts`    | Entire file                                                   | JWT validation middleware or `@supabase/ssr` server helper                   | ✅ Replaced with server round-trip `supabase.auth.getUser(token)`        |
| `src/integrations/supabase/auth-attacher.ts`      | Entire file                                                   | Your own request auth-header attacher                                        | Kept as global serverFn Bearer token attacher                            |
| `src/integrations/supabase/cron-auth.ts`          | Entire file                                                   | Service-role key approach for scheduled jobs                                 | Preserved                                                                |
| `src/integrations/supabase/client.server.ts:44`   | Error message still says "Connect Supabase in Lovable Cloud." | Update message to match `.env.example` naming                                | ✅ Updated to point to `.env.local`                                      |
| `package.json`                                    | `@lovable.dev/cloud-auth-js` dependency                       | OAuth removed; safe to uninstall                                             | Ready for removal                                                        |
| `package.json`                                    | `@lovable.dev/vite-tanstack-config` devDependency             | **Do not remove** until you have a replacement Nitro/Cloudflare build config | Kept                                                                     |

> [!WARNING]
> `@lovable.dev/vite-tanstack-config` provides the entire Vite + Nitro + Cloudflare build pipeline.
> Removing it without a replacement will break `npm run build`.

## Resolved Items

- `supabase/config.toml`: Updated from old Lovable `shvztrkqacqftukuainq` to user project reference ID `aftnzwfqeebkxyclbfxn`.
- `previewAuthStorage.ts` & `src/integrations/lovable/index.ts`: Stubbed out; no longer referenced.
- `src/integrations/supabase/client.ts`: Switched from Lovable brokered storage to `SwitchableStorage` adapter supporting "Remember this terminal".
- `src/integrations/supabase/auth-middleware.ts`: Validates tokens using `supabase.auth.getUser(token)` against Supabase Auth server.
- `src/integrations/supabase/client.server.ts`: Error message updated to reference `.env.local`.
- `src/components/LoginPage.tsx`: Demo login removed; real Supabase Auth wired for email/pwd and password reset only; OAuth (Google, GitHub) removed.
- `src/routes/auth.reset-password.tsx`: Created for password recovery.
- `src/routes/auth.callback.tsx`: Removed (OAuth no longer supported).
- Route protection: `beforeLoad` guards wired for `/bookings`, `/checkout`, `/confirmation`, `/vehicles`, `/notifications`, `/profile`, `/admin`, `/admin/knowledge`, and `/api/chat`.
