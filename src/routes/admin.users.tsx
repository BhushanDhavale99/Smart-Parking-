import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Inbox,
  Database,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Server Function: Protected by requireAdmin(request) ──
// Reads public.profiles with the caller's JWT so RLS is enforced.
export const fetchAdminUsers = createServerFn({ method: "GET" })
  .validator((params: { page?: number; pageSize?: number; search?: string }) => {
    const rawPage = Number(params?.page) || 1;
    const rawSize = Number(params?.pageSize) || 10;
    return {
      page: Math.max(1, rawPage),
      pageSize: Math.min(50, Math.max(1, rawSize)),
      search: typeof params?.search === "string" ? params.search.trim().slice(0, 80) : "",
    };
  })
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireAdmin } = await import("@/lib/auth.server");
    // Throws 403 HTTP response if the caller is not an admin
    await requireAdmin(request);

    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY =
      process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error("[fetchAdminUsers] Supabase configuration missing on server");
      throw new Response("Service configuration missing", { status: 500 });
    }

    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false },
    });

    const { page, pageSize, search } = data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from("profiles")
      .select("id, full_name, phone, role, created_at", { count: "exact" });

    // Parameterized search filter: sanitize characters to prevent SQL/filter injection
    if (search) {
      const sanitized = search.replace(/[^a-zA-Z0-9 +@.-]/g, "");
      if (sanitized) {
        query = query.or(`full_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
      }
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: rows, count, error } = await query;
    if (error) {
      console.error("[fetchAdminUsers] Supabase query failed:", error.message);
      throw new Response("Failed to fetch user profiles", { status: 500 });
    }

    return {
      users: rows ?? [],
      totalCount: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize) || 1,
    };
  });

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Users" },
      {
        name: "description",
        content: "Registered customer profiles, access roles, and account records.",
      },
    ],
  }),
  component: AdminUsersPage,
});

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "member" | "admin" | "staff";
  created_at: string;
}

function formatIST(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounce search query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load users via server function
  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchAdminUsers({
        data: { page, pageSize, search: debouncedSearch },
      });
      setUsers(res.users as ProfileRow[]);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      console.error("[AdminUsers] Error loading profiles:", err);
      setErrorMsg("Failed to load user accounts. Please verify your admin connection or retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, pageSize, debouncedSearch]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Users & Accounts
            </h1>
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded"
            >
              <Database className="size-2.5 text-emerald-400" />
              Live DB
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Registered customer profiles, access roles, and account records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadUsers}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Concise Security Note ── */}
      <div className="rounded-lg border border-border/80 bg-surface/60 px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
        <span>
          User credentials remain protected in authentication storage; account role elevations must
          be performed via database administration.
        </span>
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by full name or phone number..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* ── User Profiles Table (horizontal scroll container) ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {errorMsg ? (
          <div className="p-8 text-center text-xs">
            <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
            <p className="text-foreground font-semibold">{errorMsg}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUsers}
              className="mt-4 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Full Name
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Contact Phone
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Registered (Asia/Kolkata)
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    User ID (UUID)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={5} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">No user profiles found matching your query.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {u.full_name || (
                            <span className="text-muted-foreground font-normal italic">
                              No name provided
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {u.phone || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            u.role === "admin"
                              ? "border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold"
                              : u.role === "staff"
                                ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                                : "border-border/60 text-muted-foreground bg-muted/40"
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground tabular-nums">
                        {formatIST(u.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground text-right truncate max-w-[140px]">
                        {u.id}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Consistent Pagination Footer */}
        <div className="border-t border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-mono">
          <div>
            Showing <strong className="text-foreground tabular-nums">{users.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{totalCount}</strong> profiles
            registered
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
