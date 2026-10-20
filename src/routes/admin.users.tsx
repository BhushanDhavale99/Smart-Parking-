import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Inbox,
  UserCheck,
  Eye,
  AlertTriangle,
  Car,
  CalendarCheck,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import {
  useAdminUsers,
  useAdminSetUserRole,
  useAdminUserDetail,
  type AdminUserRow,
} from "@/hooks/useUsers";
import { formatIstDateTime, formatPaise } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Users" },
      {
        name: "description",
        content: "Accounts and roles",
      },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [roleModalUser, setRoleModalUser] = useState<AdminUserRow | null>(null);
  const [targetRole, setTargetRole] = useState<"member" | "staff" | "admin">("member");
  const [roleChangeReason, setRoleChangeReason] = useState("");

  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers({
    search: search.trim() || undefined,
    role: roleFilter,
    page,
    pageSize,
  });

  const { data: userDetail, isLoading: isLoadingDetail } = useAdminUserDetail(detailUserId);
  const setRoleMutation = useAdminSetUserRole();

  const users = data?.users ?? [];
  const total = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleOpenRoleModal = (u: AdminUserRow) => {
    setRoleModalUser(u);
    setTargetRole(u.role);
    setRoleChangeReason("");
  };

  const handleConfirmRoleChange = async () => {
    if (!roleModalUser) return;
    const trimmed = roleChangeReason.trim();
    if (trimmed.length < 5 || trimmed.length > 300) {
      toast.error("Reason must be between 5 and 300 characters.");
      return;
    }

    try {
      await setRoleMutation.mutateAsync({
        user_id: roleModalUser.id,
        role: targetRole,
        reason: trimmed,
      });

      toast.success(
        `Role for ${roleModalUser.fullName || roleModalUser.email} updated to ${targetRole}.`,
      );
      setRoleModalUser(null);
      setRoleChangeReason("");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change user role.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Users
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Accounts and roles</p>
        </div>

        <div className="flex items-center gap-2">
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

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">
              Total accounts: <strong className="text-foreground tabular-nums">{total}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-surface">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, or phone..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-muted-foreground text-[11px] mr-1">Role:</span>
          {["All", "member", "staff", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => {
                setRoleFilter(r);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                roleFilter === r
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="size-8 mx-auto text-destructive" />
            <div className="text-sm font-semibold text-foreground">Failed to load accounts</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {error?.message ||
                "An unexpected error occurred while communicating with the database."}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-surface-elevated/40">
                <TableRow className="border-border/60">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    User / Email
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Phone
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">
                    Bookings
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Total Paid
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Last Sign-In
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right w-32">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={7} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">
                          No registered accounts matched your criteria.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {u.fullName?.trim() || u.email}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {u.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            u.role === "admin"
                              ? "border-red-500/40 text-red-400 bg-red-500/10 font-bold"
                              : u.role === "staff"
                                ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                : "border-border/60 text-muted-foreground bg-muted/30"
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold text-foreground tabular-nums">
                        {u.bookingCount}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground tabular-nums">
                        {formatPaise(u.totalPaidPaise)}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {u.lastSignInAt ? formatIstDateTime(u.lastSignInAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-mono border-border/80 hover:bg-accent/50"
                            onClick={() => handleOpenRoleModal(u)}
                            title="Alter access role"
                          >
                            <UserCheck className="size-3 mr-1 text-primary" />
                            Role
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setDetailUserId(u.id)}
                            title="View customer record"
                          >
                            <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="border-t border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-mono">
          <div>
            Showing <strong className="text-foreground tabular-nums">{users.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{total}</strong> accounts
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Change Role Modal Dialog ── */}
      <Dialog
        open={Boolean(roleModalUser)}
        onOpenChange={(open) => !open && setRoleModalUser(null)}
      >
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-lg">
              <ShieldCheck className="size-5 text-primary" />
              Modify Access Role
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Adjust permissions for{" "}
              <strong className="text-foreground font-mono">
                {roleModalUser?.fullName || roleModalUser?.email}
              </strong>
              . All role modifications require an audit reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Role Options */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground text-xs">Target Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(["member", "staff", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTargetRole(r)}
                    className={`py-2 px-3 rounded-lg border text-center font-mono capitalize transition-all ${
                      targetRole === r
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning when selecting or demoting admin */}
            {(targetRole === "admin" || roleModalUser?.role === "admin") && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-amber-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Privileged Role Notice:</strong> Administrative access grants complete
                  system configuration, refund execution, and user management capabilities. Ensure
                  verification before proceeding.
                </div>
              </div>
            )}

            {/* Reason Textarea */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-medium text-foreground">
                  Reason for Role Change <span className="text-destructive">*</span>
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {roleChangeReason.trim().length}/300
                </span>
              </div>
              <Textarea
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder="Reason (5-300 characters, e.g. Promoted to operations supervisor per management request)..."
                className="text-xs bg-background min-h-[75px]"
                maxLength={300}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleModalUser(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                roleChangeReason.trim().length < 5 ||
                targetRole === roleModalUser?.role ||
                setRoleMutation.isPending
              }
              onClick={handleConfirmRoleChange}
              className="h-8 text-xs"
            >
              {setRoleMutation.isPending ? "Updating..." : "Save Role Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Read-Only Customer Detail Drawer ── */}
      <Sheet open={Boolean(detailUserId)} onOpenChange={(open) => !open && setDetailUserId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-surface border-border">
          {userDetail && (
            <div className="space-y-6">
              <SheetHeader className="text-left border-b border-border/70 pb-4">
                <SheetTitle className="font-display text-xl font-bold">
                  User Account Record
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  UID: {userDetail.profile.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-xs">
                {/* Profile Overview */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block font-bold">
                    Profile Data
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Full Name:</span>
                    <strong className="text-foreground">
                      {userDetail.profile.full_name || "—"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Phone Number:</span>
                    <span className="font-mono text-foreground">
                      {userDetail.profile.phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Access Role:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono uppercase px-2 py-0.5"
                    >
                      {userDetail.profile.role}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Registered:</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(userDetail.profile.created_at)}
                    </span>
                  </div>
                </div>

                {/* Registered Vehicles */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Registered Vehicles
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {userDetail.vehicles.length} vehicle(s)
                    </span>
                  </div>
                  {userDetail.vehicles.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic py-1">
                      No vehicles saved.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {userDetail.vehicles.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-2 rounded border border-border/70 bg-surface text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Car className="size-3.5 text-primary" />
                            <div>
                              <div className="font-mono font-bold text-foreground">
                                {v.plate_number}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {v.make} {v.model}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {v.vehicle_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Booking History */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Recent Reservations
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {userDetail.bookings.length} record(s)
                    </span>
                  </div>
                  {userDetail.bookings.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic py-1">
                      No bookings on file.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {userDetail.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded border border-border/70 bg-surface space-y-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-foreground">
                              {b.reference}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono uppercase px-1.5 py-0"
                            >
                              {b.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                            <span>Bay {b.parking_slots?.code || "—"}</span>
                            <span className="font-mono font-semibold text-foreground">
                              {formatPaise(b.total_paise)}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {formatIstDateTime(b.start_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
