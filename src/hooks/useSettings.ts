import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetSettings,
  adminUpdateSettings,
  adminListAuditLogs,
  adminGetSlotRates,
  adminUpdateSlotRates,
  adminGetDashboardStats,
  type PricingSettingsRow,
  type AdminAuditLogRow,
  type AdminDashboardData,
} from "@/lib/settings.server";

export const SETTINGS_QUERY_KEY = ["admin", "settings"] as const;
export const AUDIT_LOGS_QUERY_KEY = ["admin", "audit_logs"] as const;
export const SLOT_RATES_QUERY_KEY = ["admin", "slot_rates"] as const;
export const DASHBOARD_STATS_QUERY_KEY = ["admin", "dashboard_stats"] as const;

export type { PricingSettingsRow, AdminAuditLogRow, AdminDashboardData };

export interface SlotRates {
  standard_rate_paise: number;
  ev_rate_paise: number;
  accessible_rate_paise: number;
}


export function useAdminSettings() {
  return useQuery({
    queryKey: [...SETTINGS_QUERY_KEY],
    queryFn: async () => {
      const res = await adminGetSettings();
      return res.settings;
    },
    staleTime: 1000 * 60,
  });
}

export function useAdminUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      gst_bps: number;
      hold_minutes: number;
      min_hours: number;
      max_hours: number;
      max_advance_days: number;
      refund_full_hours: number;
      refund_partial_minutes: number;
      partial_refund_bps: number;
      exit_grace_minutes: number;
      reason: string;
    }) => {
      const res = await adminUpdateSettings({ data: params });
      return res.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
    },
  });
}

export function useAdminAuditLogs(limit: number = 50) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_QUERY_KEY, limit],
    queryFn: async () => {
      const res = await adminListAuditLogs({ data: { limit } });
      return res.logs;
    },
    staleTime: 1000 * 15,
  });
}

export function useAdminSlotRates() {
  return useQuery({
    queryKey: [...SLOT_RATES_QUERY_KEY],
    queryFn: async () => {
      const res = await adminGetSlotRates();
      return res.rates as SlotRates;
    },
    staleTime: 1000 * 60,
  });
}

export function useAdminUpdateSlotRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      standard_rate_paise: number;
      ev_rate_paise: number;
      accessible_rate_paise: number;
      reason: string;
    }) => {
      const res = await adminUpdateSlotRates({ data: params });
      return res.rates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SLOT_RATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_STATS_QUERY_KEY });
    },
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: [...DASHBOARD_STATS_QUERY_KEY],
    queryFn: async () => {
      const res = await adminGetDashboardStats();
      return res.dashboard;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 60, // 60s fallback sync for dashboard stats and occupancy
  });
}
