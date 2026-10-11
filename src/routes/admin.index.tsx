import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  CircleGauge,
  IndianRupee,
  CarFront,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
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
import { DemoBadge } from "@/components/admin/demo-badge";
import {
  ADMIN_DASHBOARD_KPIS,
  ADMIN_HOURLY_CHART,
  ADMIN_ALERTS,
  ADMIN_BOOKINGS,
} from "@/mocks/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Dashboard" },
      {
        name: "description",
        content: "Operational overview, bay occupancy, and hourly revenue.",
      },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const kpis = ADMIN_DASHBOARD_KPIS;
  const recentBookings = ADMIN_BOOKINGS.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Operational overview, bay occupancy, and hourly revenue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/map">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs font-medium">
              View Live Map <ArrowUpRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

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
          <div className="mt-3 flex items-baseline gap-2">
            <strong className="font-display text-3xl font-bold text-foreground">
              {kpis.occupancyPercent}%
            </strong>
            <span className="text-xs text-emerald-400 font-mono flex items-center">
              <TrendingUp className="size-3 mr-0.5 inline" /> +4.2%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpis.occupiedSlots} of {kpis.totalSlots} bays active
          </p>
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
          <div className="mt-3 flex items-baseline gap-2">
            <strong className="font-display text-3xl font-bold text-foreground">
              {kpis.activeSessions}
            </strong>
            <span className="text-xs text-muted-foreground font-mono">vehicles</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Turnover: {kpis.turnoverRate}</p>
        </div>

        {/* Today's Revenue */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Today's Revenue
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="size-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <strong className="font-display text-3xl font-bold text-foreground">
              ₹{kpis.todayRevenue.toLocaleString("en-IN")}
            </strong>
            <span className="text-xs text-emerald-400 font-mono">+12%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Incl. EV power & valet fees</p>
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
          <div className="mt-3 flex items-baseline gap-2">
            <strong className="font-display text-3xl font-bold text-foreground">
              {kpis.bookingsToday}
            </strong>
            <span className="text-xs text-amber-400 font-mono">slots</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">6 Fast-EV chargers active</p>
        </div>
      </div>

      {/* ── Telemetry Chart: 24h Occupancy & Revenue Trend ── */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Occupancy and revenue (24h)
            </h2>
            <p className="text-xs text-muted-foreground">
              Hourly sensor occupancy rate and fee collection
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="size-2.5 rounded-full bg-primary" /> Occupancy %
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="size-2.5 rounded-full bg-cyan-400" /> Revenue (₹/h)
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={ADMIN_HOURLY_CHART}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#09090b",
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="occupancy"
                name="Occupancy (%)"
                stroke="var(--primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#occupancyGradient)"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue (₹)"
                stroke="#22d3ee"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
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
              <p className="text-xs text-muted-foreground">Incoming & active reservations</p>
            </div>
            <Link to="/admin/bookings" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>

          <div className="divide-y divide-border/60">
            {recentBookings.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-foreground font-medium">{b.guestName}</strong>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({b.vehiclePlate})
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      Bay {b.slotCode}
                    </span>
                    <span>•</span>
                    <span>Level {b.level}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-semibold text-foreground">₹{b.amount}</span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono py-0 px-1.5 ${
                        b.status === "active"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : b.status === "confirmed"
                            ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {b.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System & Hardware Alerts */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Hardware & Ops Alerts
              </h2>
              <p className="text-xs text-muted-foreground">
                Barrier gates, ultrasonic sensors, EV hubs
              </p>
            </div>
            <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          </div>

          <div className="space-y-3">
            {ADMIN_ALERTS.map((alert) => {
              const isWarning = alert.severity === "warning";
              const isCritical = alert.severity === "critical";
              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-3.5 text-xs ${
                    isCritical
                      ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
                      : isWarning
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-border bg-background/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      {isCritical ? (
                        <AlertTriangle className="size-3.5 text-destructive" />
                      ) : isWarning ? (
                        <Zap className="size-3.5 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      )}
                      {alert.title}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {alert.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{alert.description}</p>
                  <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Source: {alert.source}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
