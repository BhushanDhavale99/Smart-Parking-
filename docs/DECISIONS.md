# Open Architectural Decisions

Do not implement any row marked "Undecided" without explicit approval. Update this file when a decision is made.

| Decision | Options | Recommendation for this repo | Blocks |
|---|---|---|---|
| **Data access & migrations** | Drizzle ORM + drizzle-kit **vs** Supabase client + CLI (`supabase db push`) | **Supabase client + CLI migrations** — `supabase/` dir already exists; CLI handles RLS, `btree_gist`/`vector` extensions, and advisory-lock double-booking protection natively in SQL; Drizzle schema is an intentionally blank placeholder | RLS design, vector search, double-booking guard |
| **Validation lib** | Zod (installed) vs Valibot vs native | **Zod** — already in `dependencies`; works with AI SDK structured output | Server functions, AI structured output |
| **AI provider** | OpenAI (installed) vs Anthropic vs Gemini vs local | **OpenAI** — `@ai-sdk/openai` already in `dependencies`, `src/routes/api.chat.ts` exists | RAG approach |
| **RAG approach** | pgvector via Supabase `vector` extension vs external vector DB vs no RAG | **pgvector** — keeps everything in one DB, no extra service | Deploy (needs DB connection), AI provider |
| **Testing tools** | Vitest vs Playwright vs none | **Vitest** (unit) + **Playwright** (E2E) — both Cloudflare-compatible | None |
| **Deploy target** | Cloudflare Workers vs Vercel vs Node | **Cloudflare Workers** — confirmed by build (`wrangler.json` auto-generated, `.wrangler/` in repo, worker named `bhushandhavale99-project`) | Server functions, SSR auth adapter |
| **Payments** | Stripe vs Razorpay vs none | **Undecided** — India-primary → lean Razorpay, international → Stripe | Checkout route (`src/routes/checkout.tsx`) |
| **QR payload** | Plain URL vs signed JWT vs opaque token (UUID) | **Opaque UUID token** — server validates, nothing sensitive in QR | Booking schema, server functions |
| **Caching** | TanStack Query (installed) vs Cloudflare KV vs Redis vs none | **TanStack Query** for client cache; **Cloudflare KV** for edge if needed | Deploy confirmed Cloudflare |
| **Lockfile manager** | ~~bun~~ vs npm | ✅ **npm** — `bun.lock` and `bunfig.toml` deleted. Note: `bunfig.toml` had a 24h supply-chain guard (`minimumReleaseAge`) with no npm equivalent; consider Dependabot delay rules as a replacement. | Resolved |
| **Supabase project ID** | Old Lovable ref vs User ref | ✅ **Resolved** — `supabase/config.toml` updated with reference ID `aftnzwfqeebkxyclbfxn`. | Resolved |

**Decide in this order:** Deploy target (done ✅ Cloudflare) → Data access & migrations → Validation lib (done ✅ Zod) → AI provider (done ✅ OpenAI) → RAG → Payments → QR payload → Caching → Testing tools → Lockfile manager.
