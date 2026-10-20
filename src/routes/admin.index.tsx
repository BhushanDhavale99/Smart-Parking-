import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleGauge,
  IndianRupee,
  CarFront,
  ArrowUpRight,
  AlertTriangle,
  Zap,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { requireAdminGuard } from "@/lib/auth-guard";
import { useAdminDashboard } from "@/hooks/useSettings";
import { formatPaise, formatIstDateTime } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Dashboard" },
      {
        name: "description",
        content: "Operations overview, bay occupancy, and live revenue.",
      },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { data: dashboard, isLoading, isError, refetch, isFetching } = useAdminDashboard();

  const kpis = dashboard?.kpis;
  const chartData = dashboard?.revenue_last_7_days ?? [];
  const recentBookings = dashboard?.recent_bookings ?? [];
  const alerts = dashboard?.alerts ?? [];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Operations overview</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 h-8 text-xs font-medium"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link to="/admin/map">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs font-medium">
              View Live Map <ArrowUpRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load operational statistics from database.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs">
            Try Again
          </Button>
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Occupancy Card */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Occupancy Rate
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CircleGauge className="size-4" />
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="font-display text-3xl font-bold text-foreground">
                  {kpis?.occupancy_percent ?? 0}%
                </strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {kpis?.occupied_slots ?? 0} of {kpis?.total_active_slots ?? 0} active bays
              </p>
            </>
          )}
        </div>

        {/* Active Sessions */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Active Sessions
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <CarFront className="size-4" />
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="font-display text-3xl font-bold text-foreground">
                  {kpis?.active_sessions_count ?? 0}
                </strong>
                <span className="text-xs text-muted-foreground font-mono">vehicles</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Currently on-site</p>
            </>
          )}
        </div>

        {/* Today's Revenue */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Today's Net Revenue
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="size-4" />
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="font-display text-3xl font-bold text-foreground">
                  {formatPaise(kpis?.revenue_today_paise ?? 0)}
                </strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Succeeded minus refunds (IST)</p>
            </>
          )}
        </div>

        {/* Bookings Today */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Bookings Today
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <CalendarDays className="size-4" />
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="font-display text-3xl font-bold text-foreground">
                  {kpis?.bookings_today ?? 0}
                </strong>
                <span className="text-xs text-amber-400 font-mono">reservations</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Created today in IST</p>
            </>
          )}
        </div>
      </div>

      {/* ── 7-Day Revenue Trend Chart ── */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Daily Net Revenue (Last 7 Days)
            </h2>
            <p className="text-xs text-muted-foreground">
              Net payment receipts scoped to Indian Standard Time
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Skeleton className="h-60 w-full" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No revenue recorded in the last 7 days
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenue7dGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 100)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [formatPaise(val), "Net Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="net_paise"
                  name="Net Revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenue7dGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Two Columns: Recent Bookings & System Alerts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Recent Bookings
              </h2>
              <p className="text-xs text-muted-foreground">Latest reservation activity</p>
            </div>
            <Link to="/admin/bookings" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>

          <div className="divide-y divide-border/60">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : recentBookings.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent bookings recorded.
              </div>
            ) : (
              recentBookings.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{b.reference}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ({b.plate_snapshot || "No Plate"})
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-foreground">Bay {b.slot_code}</span>
                      <span>•</span>
                      <span>{formatIstDateTime(b.start_at)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">
                      {formatPaise(b.total_paise)}
                    </span>
                    <div className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono py-0 px-1.5 ${
                          b.status === "active"
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            : b.status === "confirmed"
                              ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                              : b.status === "cancelled"
                                ? "border-destructive/40 text-destructive bg-destructive/10"
                                : "border-border text-muted-foreground"
                        }`}
                      >
                        {b.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Alerts */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Operational Alerts
              </h2>
              <p className="text-xs text-muted-foreground">Live facility exceptions and issues</p>
            </div>
            <span
              className={`size-2 rounded-full inline-block ${
                alerts.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))
            ) : alerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-400" />
                <span>All systems normal. No operational alerts.</span>
              </div>
            ) : (
              alerts.map((alert) => {
                const isErrorAlert = alert.severity === "error";
                const isWarning = alert.severity === "warning";
                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3.5 text-xs ${
                      isErrorAlert
                        ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
                        : isWarning
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          : "border-border bg-background/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        {isErrorAlert ? (
                          <AlertTriangle className="size-3.5 text-destructive" />
                        ) : isWarning ? (
                          <Zap className="size-3.5 text-amber-400" />
                        ) : (
                          <Info className="size-3.5 text-primary" />
                        )}
                        {alert.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{alert.description}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
