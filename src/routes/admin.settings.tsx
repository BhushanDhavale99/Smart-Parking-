import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Settings,
  Shield,
  Clock,
  Percent,
  Calendar,
  AlertCircle,
  RefreshCw,
  FileText,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  Sliders,
  CarFront,
  Zap,
  IndianRupee,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import {
  useAdminSettings,
  useAdminUpdateSettings,
  useAdminAuditLogs,
  useAdminSlotRates,
  useAdminUpdateSlotRates,
  type PricingSettingsRow,
  type AdminAuditLogRow,
  type SlotRates,
} from "@/hooks/useSettings";
import { formatIstDateTime, formatPaise } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Settings" },
      {
        name: "description",
        content: "System parameters and audit trail",
      },
    ],
  }),
  component: AdminSettingsPage,
});

interface FormState {
  gst_bps: number;
  hold_minutes: number;
  min_hours: number;
  max_hours: number;
  max_advance_days: number;
  refund_full_hours: number;
  refund_partial_minutes: number;
  partial_refund_bps: number;
  exit_grace_minutes: number;
}

const DEFAULT_FORM: FormState = {
  gst_bps: 1800,
  hold_minutes: 15,
  min_hours: 1,
  max_hours: 24,
  max_advance_days: 30,
  refund_full_hours: 2,
  refund_partial_minutes: 30,
  partial_refund_bps: 5000,
  exit_grace_minutes: 15,
};

function AdminSettingsPage() {
  const {
    data: settings,
    isLoading: isSettingsLoading,
    isError: isSettingsError,
    refetch: refetchSettings,
  } = useAdminSettings();

  const {
    data: auditLogs,
    isLoading: isAuditLoading,
    isError: isAuditError,
    refetch: refetchAuditLogs,
  } = useAdminAuditLogs(50);

  const {
    data: slotRates,
    isLoading: isRatesLoading,
    isError: isRatesError,
    refetch: refetchRates,
  } = useAdminSlotRates();

  const updateMutation = useAdminUpdateSettings();
  const updateRatesMutation = useAdminUpdateSlotRates();

  // Settings form state
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [auditReason, setAuditReason] = useState("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminAuditLogRow | null>(null);

  // Slot rates form state
  const [ratesForm, setRatesForm] = useState({
    standard_rate: 50,
    ev_rate: 70,
    accessible_rate: 50,
  });
  const [isRatesConfirmOpen, setIsRatesConfirmOpen] = useState(false);
  const [ratesAuditReason, setRatesAuditReason] = useState("");

  // Sync settings form state when backend loads
  useEffect(() => {
    if (settings) {
      setForm({
        gst_bps: settings.gst_bps,
        hold_minutes: settings.hold_minutes,
        min_hours: settings.min_hours,
        max_hours: settings.max_hours,
        max_advance_days: settings.max_advance_days,
        refund_full_hours: settings.refund_full_hours,
        refund_partial_minutes: settings.refund_partial_minutes,
        partial_refund_bps: settings.partial_refund_bps,
        exit_grace_minutes: settings.exit_grace_minutes,
      });
    }
  }, [settings]);

  // Sync slot rates when backend loads
  useEffect(() => {
    if (slotRates) {
      setRatesForm({
        standard_rate: Math.round(slotRates.standard_rate_paise / 100),
        ev_rate: Math.round(slotRates.ev_rate_paise / 100),
        accessible_rate: Math.round(slotRates.accessible_rate_paise / 100),
      });
    }
  }, [slotRates]);

  // Compute changed keys for settings
  const changedFields = useMemo(() => {
    if (!settings) return [];
    const diff: {
      label: string;
      key: keyof FormState;
      oldVal: number;
      newVal: number;
      unit: string;
    }[] = [];

    const fieldMeta: Record<keyof FormState, { label: string; unit: string }> = {
      gst_bps: { label: "GST Tax Rate", unit: "bps" },
      hold_minutes: { label: "Slot Hold Duration", unit: "mins" },
      min_hours: { label: "Min Booking Duration", unit: "hrs" },
      max_hours: { label: "Max Booking Duration", unit: "hrs" },
      max_advance_days: { label: "Max Advance Window", unit: "days" },
      refund_full_hours: { label: "Full Refund Cutoff", unit: "hrs" },
      refund_partial_minutes: { label: "Partial Refund Cutoff", unit: "mins" },
      partial_refund_bps: { label: "Partial Refund Rate", unit: "bps" },
      exit_grace_minutes: { label: "Exit Grace Period", unit: "mins" },
    };

    (Object.keys(DEFAULT_FORM) as (keyof FormState)[]).forEach((key) => {
      if (settings[key] !== form[key]) {
        diff.push({
          label: fieldMeta[key].label,
          key,
          oldVal: settings[key],
          newVal: form[key],
          unit: fieldMeta[key].unit,
        });
      }
    });

    return diff;
  }, [settings, form]);

  const isDirty = changedFields.length > 0;

  // Compute dirty state for rates
  const areRatesDirty = useMemo(() => {
    if (!slotRates) return false;
    return (
      ratesForm.standard_rate !== Math.round(slotRates.standard_rate_paise / 100) ||
      ratesForm.ev_rate !== Math.round(slotRates.ev_rate_paise / 100) ||
      ratesForm.accessible_rate !== Math.round(slotRates.accessible_rate_paise / 100)
    );
  }, [slotRates, ratesForm]);

  // Validation bounds for settings
  const validationError = useMemo(() => {
    if (form.gst_bps < 0 || form.gst_bps > 2800) {
      return "GST must be between 0 and 2800 basis points (0% - 28%).";
    }
    if (form.hold_minutes < 5 || form.hold_minutes > 30) {
      return "Slot hold window must be between 5 and 30 minutes.";
    }
    if (form.min_hours < 1 || form.min_hours > 4) {
      return "Minimum booking duration must be between 1 and 4 hours.";
    }
    if (form.max_hours < 1 || form.max_hours > 72) {
      return "Maximum booking duration must be between 1 and 72 hours.";
    }
    if (form.max_hours < form.min_hours) {
      return "Maximum booking duration cannot be less than minimum duration.";
    }
    if (form.max_advance_days < 1 || form.max_advance_days > 90) {
      return "Maximum advance reservation window must be between 1 and 90 days.";
    }
    if (form.refund_full_hours < 0 || form.refund_full_hours > 48) {
      return "Full refund cutoff must be between 0 and 48 hours.";
    }
    if (form.refund_partial_minutes < 0 || form.refund_partial_minutes > 1440) {
      return "Partial refund cutoff must be between 0 and 1440 minutes.";
    }
    if (form.partial_refund_bps < 0 || form.partial_refund_bps > 10000) {
      return "Partial refund percentage must be between 0 and 10000 basis points (0% - 100%).";
    }
    if (form.exit_grace_minutes < 0 || form.exit_grace_minutes > 120) {
      return "Exit grace period must be between 0 and 120 minutes.";
    }
    return null;
  }, [form]);

  // Validation bounds for rates
  const ratesValidationError = useMemo(() => {
    if (ratesForm.standard_rate < 10 || ratesForm.standard_rate > 1000) {
      return "Standard rate must be between ₹10 and ₹1,000/hr.";
    }
    if (ratesForm.ev_rate < 10 || ratesForm.ev_rate > 1000) {
      return "EV rate must be between ₹10 and ₹1,000/hr.";
    }
    if (ratesForm.accessible_rate < 10 || ratesForm.accessible_rate > 1000) {
      return "Accessible rate must be between ₹10 and ₹1,000/hr.";
    }
    return null;
  }, [ratesForm]);

  const handleReset = () => {
    if (settings) {
      setForm({
        gst_bps: settings.gst_bps,
        hold_minutes: settings.hold_minutes,
        min_hours: settings.min_hours,
        max_hours: settings.max_hours,
        max_advance_days: settings.max_advance_days,
        refund_full_hours: settings.refund_full_hours,
        refund_partial_minutes: settings.refund_partial_minutes,
        partial_refund_bps: settings.partial_refund_bps,
        exit_grace_minutes: settings.exit_grace_minutes,
      });
      toast.info("Form reset to active system parameters.");
    }
  };

  const handleResetRates = () => {
    if (slotRates) {
      setRatesForm({
        standard_rate: Math.round(slotRates.standard_rate_paise / 100),
        ev_rate: Math.round(slotRates.ev_rate_paise / 100),
        accessible_rate: Math.round(slotRates.accessible_rate_paise / 100),
      });
      toast.info("Rates reset to active database tariffs.");
    }
  };

  const handleOpenConfirm = () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setAuditReason("");
    setIsConfirmOpen(true);
  };

  const handleOpenRatesConfirm = () => {
    if (ratesValidationError) {
      toast.error(ratesValidationError);
      return;
    }
    setRatesAuditReason("");
    setIsRatesConfirmOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!auditReason.trim() || auditReason.trim().length < 5) {
      toast.error("Please enter a valid audit reason (minimum 5 characters).");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        ...form,
        reason: auditReason.trim(),
      });
      toast.success("System parameters updated and audited successfully.");
      setIsConfirmOpen(false);
      setAuditReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update parameters.";
      toast.error(msg);
    }
  };

  const handleSaveRates = async () => {
    if (!ratesAuditReason.trim() || ratesAuditReason.trim().length < 5) {
      toast.error("Please enter a valid audit reason (minimum 5 characters).");
      return;
    }

    try {
      await updateRatesMutation.mutateAsync({
        standard_rate_paise: ratesForm.standard_rate * 100,
        ev_rate_paise: ratesForm.ev_rate * 100,
        accessible_rate_paise: ratesForm.accessible_rate * 100,
        reason: ratesAuditReason.trim(),
      });
      toast.success("Hourly slot tariffs updated and audited successfully.");
      setIsRatesConfirmOpen(false);
      setRatesAuditReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update slot rates.";
      toast.error(msg);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "update_settings":
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
            update_settings
          </Badge>
        );
      case "update_slot_rates":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            update_slot_rates
          </Badge>
        );
      case "override_booking":
        return (
          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30">
            override_booking
          </Badge>
        );
      case "refund_payment":
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30">refund_payment</Badge>
        );
      case "change_user_role":
        return (
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">
            change_user_role
          </Badge>
        );
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="size-7 text-primary" />
            Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            System parameters and audit trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSettings();
              refetchAuditLogs();
              refetchRates();
              toast.info("Refreshed all settings and audit trail.");
            }}
            disabled={isSettingsLoading || isAuditLoading || isRatesLoading}
          >
            <RefreshCw
              className={`size-3.5 mr-1.5 ${
                isSettingsLoading || isAuditLoading || isRatesLoading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── SECTION 1: HOURLY RATES & TARIFFS ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="size-5 text-primary" />
            Hourly Tariffs & Slot Rates
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live hourly base rates applied to parking slots by bay classification.
          </p>
        </div>

        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Bay Tariffs</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Adjusting these rates modifies the hourly rate on all corresponding parking slots.
                </CardDescription>
              </div>
              {areRatesDirty && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-400 bg-amber-500/10"
                >
                  Unsaved rate changes
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {isRatesLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <RefreshCw className="size-6 mx-auto animate-spin mb-2 opacity-50" />
                Loading slot rates from database...
              </div>
            ) : isRatesError || !slotRates ? (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                Failed to load parking slot tariffs.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Standard Bay Rate */}
                  <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-surface/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CarFront className="size-4 text-primary" />
                        <span className="text-xs font-semibold">Standard Bay</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        standard
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm font-semibold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min={10}
                        max={1000}
                        value={ratesForm.standard_rate}
                        onChange={(e) =>
                          setRatesForm((prev) => ({
                            ...prev,
                            standard_rate: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="font-mono text-base font-bold"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ hr</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Regular 4W and 2W covered parking bays.
                    </p>
                  </div>

                  {/* EV Fast Charge Rate */}
                  <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-surface/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="size-4 text-emerald-400" />
                        <span className="text-xs font-semibold">EV Fast-Charging Bay</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-emerald-400">
                        ev
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm font-semibold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min={10}
                        max={1000}
                        value={ratesForm.ev_rate}
                        onChange={(e) =>
                          setRatesForm((prev) => ({
                            ...prev,
                            ev_rate: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="font-mono text-base font-bold"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ hr</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Includes parking space and Level 2 AC charger power.
                    </p>
                  </div>

                  {/* Accessible Bay Rate */}
                  <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-surface/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CarFront className="size-4 text-cyan-400" />
                        <span className="text-xs font-semibold">Accessible / VIP Bay</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-cyan-400">
                        accessible
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm font-semibold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min={10}
                        max={1000}
                        value={ratesForm.accessible_rate}
                        onChange={(e) =>
                          setRatesForm((prev) => ({
                            ...prev,
                            accessible_rate: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="font-mono text-base font-bold"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ hr</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Extra-wide bays positioned near terminal elevators.
                    </p>
                  </div>
                </div>

                {ratesValidationError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    {ratesValidationError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetRates}
                    disabled={!areRatesDirty || updateRatesMutation.isPending}
                  >
                    Reset Rates
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenRatesConfirm}
                    disabled={
                      !areRatesDirty || !!ratesValidationError || updateRatesMutation.isPending
                    }
                  >
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                    Save Slot Rates
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 2: BOOKING & REFUND RULES ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            Booking & Refund Rules
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational boundaries, advance booking windows, GST tax levy, and cancellation refund
            tiers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 spans): Editable Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Facility Operational Controls
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Fine-tune booking durations, hold windows, and tax schedules.
                    </CardDescription>
                  </div>
                  {isDirty && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-400 bg-amber-500/10"
                    >
                      Unsaved changes ({changedFields.length})
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {isSettingsLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <RefreshCw className="size-6 mx-auto animate-spin mb-2 opacity-50" />
                    Loading facility settings...
                  </div>
                ) : isSettingsError || !settings ? (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    Failed to load system settings from database.
                  </div>
                ) : (
                  <>
                    {/* Group 1: Booking Windows */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Reservation Constraints
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Hold Minutes */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="hold_minutes" className="text-xs font-medium">
                              Slot Hold Window (Minutes)
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              5 - 30 min
                            </span>
                          </div>
                          <Input
                            id="hold_minutes"
                            type="number"
                            min={5}
                            max={30}
                            value={form.hold_minutes}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                hold_minutes: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Time bay remains locked while user is on checkout screen.
                          </p>
                        </div>

                        {/* Max Advance Days */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="max_advance_days" className="text-xs font-medium">
                              Max Advance Window (Days)
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              1 - 90 days
                            </span>
                          </div>
                          <Input
                            id="max_advance_days"
                            type="number"
                            min={1}
                            max={90}
                            value={form.max_advance_days}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                max_advance_days: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            How far in advance users can book a bay.
                          </p>
                        </div>

                        {/* Min Hours */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="min_hours" className="text-xs font-medium">
                              Min Booking Duration (Hours)
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              1 - 4 hrs
                            </span>
                          </div>
                          <Input
                            id="min_hours"
                            type="number"
                            min={1}
                            max={4}
                            value={form.min_hours}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                min_hours: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Minimum duration allowed per single booking.
                          </p>
                        </div>

                        {/* Max Hours */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="max_hours" className="text-xs font-medium">
                              Max Booking Duration (Hours)
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              1 - 72 hrs
                            </span>
                          </div>
                          <Input
                            id="max_hours"
                            type="number"
                            min={1}
                            max={72}
                            value={form.max_hours}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                max_hours: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Maximum duration allowed per single booking.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Group 2: Taxation & Grace */}
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Percent className="size-3.5" />
                        Taxation & Departure Grace
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* GST Bps */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="gst_bps" className="text-xs font-medium">
                              GST Tax Rate (Basis Points)
                            </Label>
                            <Badge variant="secondary" className="font-mono text-[11px]">
                              {(form.gst_bps / 100).toFixed(2)}%
                            </Badge>
                          </div>
                          <Input
                            id="gst_bps"
                            type="number"
                            min={0}
                            max={2800}
                            value={form.gst_bps}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                gst_bps: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Indian GST levy applied at checkout (1800 bps = 18.00%).
                          </p>
                        </div>

                        {/* Exit Grace Minutes */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="exit_grace_minutes" className="text-xs font-medium">
                              Exit Grace Period (Minutes)
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              0 - 120 min
                            </span>
                          </div>
                          <Input
                            id="exit_grace_minutes"
                            type="number"
                            min={0}
                            max={120}
                            value={form.exit_grace_minutes}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                exit_grace_minutes: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Departure tolerance window before overstay charges accrue.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Group 3: Cancellation & Refund Policy */}
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Shield className="size-3.5" />
                        Cancellation & Refund Policy Tiers
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Full Refund Hours */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="refund_full_hours" className="text-xs font-medium">
                              100% Refund Cutoff
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              0 - 48 hrs
                            </span>
                          </div>
                          <Input
                            id="refund_full_hours"
                            type="number"
                            min={0}
                            max={48}
                            value={form.refund_full_hours}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                refund_full_hours: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Hours before start time for 100% refund.
                          </p>
                        </div>

                        {/* Partial Refund Cutoff Minutes */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="refund_partial_minutes" className="text-xs font-medium">
                              Partial Refund Cutoff
                            </Label>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              0 - 1440 min
                            </span>
                          </div>
                          <Input
                            id="refund_partial_minutes"
                            type="number"
                            min={0}
                            max={1440}
                            value={form.refund_partial_minutes}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                refund_partial_minutes: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Minutes before start time for partial tier.
                          </p>
                        </div>

                        {/* Partial Refund Percentage */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="partial_refund_bps" className="text-xs font-medium">
                              Partial Refund Rate
                            </Label>
                            <Badge variant="secondary" className="font-mono text-[11px]">
                              {(form.partial_refund_bps / 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <Input
                            id="partial_refund_bps"
                            type="number"
                            min={0}
                            max={10000}
                            value={form.partial_refund_bps}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                partial_refund_bps: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Rate returned during partial refund window.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Validation Error Banner */}
                    {validationError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" />
                        {validationError}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={!isDirty || updateMutation.isPending}
                      >
                        Reset Changes
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenConfirm}
                        disabled={!isDirty || !!validationError || updateMutation.isPending}
                      >
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                        Save System Parameters
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1 span): System Architecture & Status */}
          <div className="space-y-6">
            {/* Payment Gateway Mode Card */}
            <Card className="border-border/60 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="size-4 text-primary" />
                  Payment Integration Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border/60">
                  <div>
                    <div className="text-xs font-medium text-foreground">Active Payment Mode</div>
                    <div className="text-[11px] text-muted-foreground">Gateway provider</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      settings?.payment_mode === "razorpay"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono uppercase"
                        : "bg-blue-500/15 text-blue-400 border-blue-500/30 font-mono uppercase"
                    }
                  >
                    {settings?.payment_mode || "mock"}
                  </Badge>
                </div>

                <div className="text-[11px] text-muted-foreground leading-relaxed p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="font-semibold text-foreground mb-1">Architecture Note:</p>
                  The payment integration mode is locked to the backend deployment environment. To
                  toggle between Mock simulation and live Razorpay webhooks, update system
                  configuration keys and redeploy.
                </div>

                {settings?.updated_at && (
                  <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between">
                    <span>Last Updated:</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(settings.updated_at)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cancellation Schedule Card */}
            <Card className="border-border/60 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Policy Summary Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-start justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">
                    Cancellation &gt; {form.refund_full_hours}h prior:
                  </span>
                  <span className="font-semibold text-emerald-400">100% Refund</span>
                </div>
                <div className="flex items-start justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">
                    Between {form.refund_partial_minutes}m and {form.refund_full_hours}h:
                  </span>
                  <span className="font-semibold text-amber-400">
                    {(form.partial_refund_bps / 100).toFixed(0)}% Refund
                  </span>
                </div>
                <div className="flex items-start justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">
                    Cancellation &lt; {form.refund_partial_minutes}m prior:
                  </span>
                  <span className="font-semibold text-destructive">No Refund (0%)</span>
                </div>
                <div className="flex items-start justify-between py-1.5">
                  <span className="text-muted-foreground">Departure Grace Period:</span>
                  <span className="font-semibold text-foreground">
                    {form.exit_grace_minutes} minutes
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: CHANGE HISTORY (AUDIT TRAIL) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              Administrative Audit Trail
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Immutable ledger recording all administrative overrides, setting adjustments, rate
              updates, role mutations, and refunds.
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {auditLogs?.length ?? 0} Events Logged
          </Badge>
        </div>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-0">
            {isAuditLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <RefreshCw className="size-6 mx-auto animate-spin mb-2 opacity-50" />
                Loading audit trail records...
              </div>
            ) : isAuditError || !auditLogs ? (
              <div className="p-6 text-center text-sm text-destructive">
                Failed to load administrative audit logs.
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <Shield className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                No administrative audit records found yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Timestamp (IST)</TableHead>
                      <TableHead className="text-xs font-semibold">Admin / Actor</TableHead>
                      <TableHead className="text-xs font-semibold">Action</TableHead>
                      <TableHead className="text-xs font-semibold">Target Record</TableHead>
                      <TableHead className="text-xs font-semibold">Audit Reason</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="border-border/50 hover:bg-muted/30">
                        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {formatIstDateTime(log.created_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">
                            {log.actor?.full_name || "Admin"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {log.actor_id.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {log.record_type}
                          {log.record_id ? `:${log.record_id.slice(0, 8)}` : ""}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={log.reason}>
                          {log.reason}
                        </TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSelectedAuditLog(log)}
                          >
                            <Eye className="size-3.5 mr-1" />
                            Diff
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog for System Settings */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              Confirm System Parameter Changes
            </DialogTitle>
            <DialogDescription className="text-xs">
              This action directly modifies operational thresholds across the active facility. An
              audited change log entry will be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium text-foreground">Modified Parameters:</div>
              <div className="space-y-1.5 text-xs">
                {changedFields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{f.label}:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-destructive line-through">
                        {f.oldVal} {f.unit}
                      </span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span className="text-emerald-400 font-bold">
                        {f.newVal} {f.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit_reason" className="text-xs font-medium">
                Audit Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="audit_reason"
                placeholder="Explain the operational justification for updating these parameters..."
                rows={3}
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                className="text-xs resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                Minimum 5 characters. Stored immutably in public.admin_audit_log.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSettings}
              disabled={auditReason.trim().length < 5 || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm & Log Change"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Slot Rates */}
      <Dialog open={isRatesConfirmOpen} onOpenChange={setIsRatesConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <IndianRupee className="size-5 text-primary" />
              Confirm Hourly Tariff Updates
            </DialogTitle>
            <DialogDescription className="text-xs">
              Updating these rates will directly modify the hourly rate in public.parking_slots for
              all matching bays.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium text-foreground">Updated Rates:</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-sans">Standard Bay:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      ₹{slotRates ? slotRates.standard_rate_paise / 100 : 50}/hr
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-emerald-400 font-bold">
                      ₹{ratesForm.standard_rate}/hr
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-sans">EV Fast-Charging Bay:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      ₹{slotRates ? slotRates.ev_rate_paise / 100 : 70}/hr
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-emerald-400 font-bold">₹{ratesForm.ev_rate}/hr</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-sans">Accessible / VIP Bay:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      ₹{slotRates ? slotRates.accessible_rate_paise / 100 : 50}/hr
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-emerald-400 font-bold">
                      ₹{ratesForm.accessible_rate}/hr
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rates_audit_reason" className="text-xs font-medium">
                Audit Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rates_audit_reason"
                placeholder="Explain the justification for adjusting hourly parking tariffs..."
                rows={3}
                value={ratesAuditReason}
                onChange={(e) => setRatesAuditReason(e.target.value)}
                className="text-xs resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                Minimum 5 characters. Stored immutably in public.admin_audit_log.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRatesConfirmOpen(false)}
              disabled={updateRatesMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRates}
              disabled={ratesAuditReason.trim().length < 5 || updateRatesMutation.isPending}
            >
              {updateRatesMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm & Update Rates"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Diff Modal */}
      <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Audit Event Diff Inspection
            </DialogTitle>
            <DialogDescription className="text-xs font-mono">
              Action: {selectedAuditLog?.action} | Target: {selectedAuditLog?.record_type}:
              {selectedAuditLog?.record_id}
            </DialogDescription>
          </DialogHeader>

          {selectedAuditLog && (
            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                <div className="text-muted-foreground">Reason Provided:</div>
                <div className="font-medium text-foreground">{selectedAuditLog.reason}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    Previous State (old_data)
                  </div>
                  <pre className="p-3 rounded-lg bg-surface border border-border/60 text-[10px] font-mono overflow-x-auto text-muted-foreground">
                    {JSON.stringify(selectedAuditLog.old_data, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-primary text-[11px] uppercase tracking-wider">
                    New State (new_data)
                  </div>
                  <pre className="p-3 rounded-lg bg-surface border border-border/60 text-[10px] font-mono overflow-x-auto text-emerald-400">
                    {JSON.stringify(selectedAuditLog.new_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedAuditLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
