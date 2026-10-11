<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project rules for AI agents

- **Stack:** TanStack Start + Vite (NOT Next.js). Supabase is the backend (Postgres, Auth, Realtime, Storage).
- **One feature per task.** Do not bundle unrelated changes in a single response.
- **UI unchanged** unless the task explicitly asks for it; do not touch `src/components` or `src/routes` otherwise.
- **No new packages or version changes** without explicit user approval.
- **Open choices** live in `docs/DECISIONS.md`; do not assume or implement anything listed as Undecided.
- **Times:** store as `timestamptz` (UTC) in Postgres; display in `Asia/Kolkata`.
- **Server functions:** validate input and check auth before touching the database.
- **New tables:** enable RLS and add at least one policy in the same commit/PR as the table.
- **Secrets:** never read, print, log, or embed `.env.local` or any secret variable value.
- **Lockfile:** npm (`package-lock.json`). Do not run `bun install`. Use `npm install` only with explicit user approval.
- At the end of every response, list each changed file on its own line.
