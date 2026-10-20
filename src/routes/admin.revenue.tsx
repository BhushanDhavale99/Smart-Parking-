import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  IndianRupee,
  Calendar,
  Download,
  TrendingUp,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  CreditCard,
  Grid3X3,
  Percent,
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
import { useAdminRevenueReport } from "@/hooks/usePayments";
import { formatPaise } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/revenue")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Revenue" },
      {
        name: "description",
        content: "Revenue",
      },
    ],
  }),
  component: AdminRevenuePage,
});

function getTodayIstString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function getDefaultDates() {
  const today = getTodayIstString();
  return { from: today, to: today };
}

function AdminRevenuePage() {
  const defaults = useMemo(() => getDefaultDates(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminRevenueReport({
    from,
    to,
    group,
  });

  const totals = report?.totals ?? {
    total_gross_paise: 0,
    total_refund_paise: 0,
    total_net_paise: 0,
    total_gst_paise: 0,
    total_bookings: 0,
    total_cancelled: 0,
    total_overstay_paise: 0,
    average_booking_value_paise: 0,
    cancellation_rate_bps: 0,
  };

  const periods = useMemo(() => report?.periods ?? [], [report]);
  const slotBreakdown = useMemo(() => report?.breakdown_by_slot_type ?? [], [report]);
  const levelBreakdown = useMemo(() => report?.breakdown_by_level ?? [], [report]);
  const methodBreakdown = useMemo(() => report?.breakdown_by_payment_method ?? [], [report]);

  // Transform periods for chart data (rupees)
  const chartData = useMemo(() => {
    return periods.map((p) => ({
      period: p.period_label,
      Gross: Math.round(p.gross_paise / 100),
      Net: Math.round(p.net_paise / 100),
      Refunds: Math.round(p.refund_paise / 100),
      Bookings: p.bookings_count,
    }));
  }, [periods]);

  // CSV Generator in Browser
  const handleDownloadCsv = () => {
    if (!periods || periods.length === 0) {
      toast.error("No report data available to export.");
      return;
    }

    const headers = [
      "Period",
      "Gross Revenue (INR)",
      "Refunds Issued (INR)",
      "Net Revenue (INR)",
      "GST Collected (INR)",
      "Bookings Count",
      "Cancellations",
      "Overstay Fees (INR)",
    ];

    const rows = periods.map((p) => [
      p.period_label,
      (p.gross_paise / 100).toFixed(2),
      (p.refund_paise / 100).toFixed(2),
      (p.net_paise / 100).toFixed(2),
      (p.gst_paise / 100).toFixed(2),
      p.bookings_count,
      p.cancelled_count,
      (p.overstay_paise / 100).toFixed(2),
    ]);

    // Append summary footer row
    rows.push([
      "TOTAL",
      (totals.total_gross_paise / 100).toFixed(2),
      (totals.total_refund_paise / 100).toFixed(2),
      (totals.total_net_paise / 100).toFixed(2),
      (totals.total_gst_paise / 100).toFixed(2),
      totals.total_bookings.toString(),
      totals.total_cancelled.toString(),
      (totals.total_overstay_paise / 100).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `parkgrid_revenue_${from}_to_${to}_${group}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Revenue CSV report downloaded successfully.");
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const toStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(end);
    const fromStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(start);
    setFrom(fromStr);
    setTo(toStr);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Revenue
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Revenue</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={periods.length === 0}
            className="h-8 text-xs gap-1.5 font-mono"
          >
            <Download className="size-3.5" />
            Download CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Filters & Controls ── */}
      <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] font-mono">From:</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-xs bg-background w-32"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] font-mono">To:</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-xs bg-background w-32"
            />
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-border/60">
            {[
              { label: "7D", days: 7 },
              { label: "30D", days: 30 },
              { label: "90D", days: 90 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPresetRange(p.days)}
                className="px-2 py-1 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/40"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Day / Week / Month Toggle */}
        <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border font-mono text-xs">
          {(["day", "week", "month"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                group === g
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Revenue */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Net Revenue</span>
            <div className="grid size-7 place-items-center rounded bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-emerald-400">
                {formatPaise(totals.total_net_paise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Gross: {formatPaise(totals.total_gross_paise)}
              </p>
            </div>
          )}
        </div>

        {/* GST Tax Reconciliation */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">GST Collected</span>
            <div className="grid size-7 place-items-center rounded bg-primary/10 text-primary">
              <Percent className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-foreground">
                {formatPaise(totals.total_gst_paise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Overstay fees: {formatPaise(totals.total_overstay_paise)}
              </p>
            </div>
          )}
        </div>

        {/* Refunds Issued */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Refunds</span>
            <div className="grid size-7 place-items-center rounded bg-amber-500/10 text-amber-500">
              <RotateCcw className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-amber-500">
                {formatPaise(totals.total_refund_paise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Cancellation rate: {(totals.cancellation_rate_bps / 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Volume & Average Value */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Volume & Avg Value</span>
            <div className="grid size-7 place-items-center rounded bg-muted/40 text-muted-foreground">
              <IndianRupee className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-foreground">
                {totals.total_bookings}{" "}
                <span className="text-xs font-normal text-muted-foreground">bookings</span>
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Avg ticket: {formatPaise(totals.average_booking_value_paise)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Revenue Chart ── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              Financial Progression Trend (₹)
            </h3>
            <p className="text-xs text-muted-foreground">
              Comparison of gross billings vs net collections over the selected timeframe.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-cyan-400" />
              <span>Gross</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-400" />
              <span>Net</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span>Refunds</span>
            </div>
          </div>
        </div>

        <div className="mt-4 h-72 w-full">
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="h-6 w-32 animate-pulse rounded bg-accent/40" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No revenue data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="period"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`]}
                />
                <Area
                  type="monotone"
                  dataKey="Gross"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#grossGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="Net"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#netGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Breakdown Tables Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By Slot Type */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Grid3X3 className="size-4 text-primary" />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Revenue by Bay Type
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {slotBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
            ) : (
              slotBreakdown.map((s) => (
                <div
                  key={s.slot_type}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="font-mono capitalize text-muted-foreground">{s.slot_type}</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-foreground block">
                      {formatPaise(s.gross_paise)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {s.bookings_count} bookings
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Facility Level */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Layers className="size-4 text-cyan-400" />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Revenue by Floor Level
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {levelBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
            ) : (
              levelBreakdown.map((l) => (
                <div
                  key={l.level_code}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="font-mono text-muted-foreground">Level {l.level_code}</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-foreground block">
                      {formatPaise(l.gross_paise)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {l.bookings_count} bookings
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Payment Method */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <CreditCard className="size-4 text-emerald-400" />
            <h4 className="font-display text-sm font-semibold text-foreground">
              By Payment Method
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {methodBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
            ) : (
              methodBreakdown.map((m) => (
                <div
                  key={m.method}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="font-mono uppercase text-muted-foreground">{m.method}</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-foreground block">
                      {formatPaise(m.gross_paise)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{m.count} txns</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Tabular Period Progression ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Period-by-Period Settlement Details
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            {periods.length} time interval(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surface-elevated/40">
              <TableRow className="border-border/60">
                <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                  Period
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">
                  Bookings
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">
                  Cancelled
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                  Gross
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                  Refunds
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                  GST
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                  Overstay
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                  Net Revenue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                    No revenue data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                periods.map((p) => (
                  <TableRow
                    key={p.period_label}
                    className="border-border/60 text-xs hover:bg-accent/40 font-mono"
                  >
                    <TableCell className="font-bold text-foreground">{p.period_label}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.bookings_count}</TableCell>
                    <TableCell className="text-center text-amber-500 tabular-nums">
                      {p.cancelled_count}
                    </TableCell>
                    <TableCell className="text-right text-foreground tabular-nums">
                      {formatPaise(p.gross_paise)}
                    </TableCell>
                    <TableCell className="text-right text-amber-500 tabular-nums">
                      {p.refund_paise > 0 ? formatPaise(p.refund_paise) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatPaise(p.gst_paise)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {p.overstay_paise > 0 ? formatPaise(p.overstay_paise) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-400 tabular-nums">
                      {formatPaise(p.net_paise)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
