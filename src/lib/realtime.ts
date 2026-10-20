/**
 * Realtime Synchronization Manager for ParkGrid
 *
 * Implements a single, authenticated Supabase Realtime connection for the app.
 *
 * Security & Reliability guarantees:
 * 1. Anonymous users receive zero subscriptions.
 * 2. Authenticates socket with current JWT (calls supabase.realtime.setAuth).
 * 3. Minimal broadcast signal: 'availability_ping' postgres_changes carries NO personal data.
 * 4. postgres_changes on 'bookings' and 'parking_sessions' is restricted by Postgres RLS:
 *    regular members only receive their own rows; admins receive all rows.
 * 5. Debounces query invalidations (~500ms) to coalesce bursts into a single refetch.
 * 6. Pauses refetches while document is hidden; triggers a single batch refetch on visibility.
 * 7. When disconnected, gracefully falls back to 60-second polling (refetchInterval).
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { AVAILABILITY_QUERY_KEY, BOOKINGS_QUERY_KEY, SLOTS_QUERY_KEY } from "@/hooks/useBookings";
import { SESSIONS_QUERY_KEY } from "@/hooks/useSessions";
import { ADMIN_PAYMENTS_QUERY_KEY } from "@/hooks/usePayments";
import { DASHBOARD_STATS_QUERY_KEY } from "@/hooks/useSettings";

export interface RealtimeSyncState {
  isLive: boolean;
  status: "disconnected" | "connecting" | "connected" | "error";
  lastEventAt: Date | null;
}

// Global connection state so any component can inspect connection status without duplicate sockets
let globalIsLive = false;
let globalStatus: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
let globalLastEventAt: Date | null = null;
const statusListeners = new Set<(state: RealtimeSyncState) => void>();

function notifyStatusListeners() {
  const state: RealtimeSyncState = {
    isLive: globalIsLive,
    status: globalStatus,
    lastEventAt: globalLastEventAt,
  };
  statusListeners.forEach((fn) => fn(state));
}

/**
 * Returns fallback polling interval: false if live socket is connected;
 * 60,000 ms (60 seconds) if disconnected or offline.
 */
export function getRealtimeRefetchInterval(isLive: boolean, fallbackMs: number = 60000): number | false {
  return isLive ? false : fallbackMs;
}

/**
 * Hook to inspect the application-wide Realtime connection status.
 */
export function useRealtimeStatus(): RealtimeSyncState {
  const [state, setState] = useState<RealtimeSyncState>({
    isLive: globalIsLive,
    status: globalStatus,
    lastEventAt: globalLastEventAt,
  });

  useEffect(() => {
    statusListeners.add(setState);
    return () => {
      statusListeners.delete(setState);
    };
  }, []);

  return state;
}

// Singleton channel reference
let activeChannel: RealtimeChannel | null = null;
let activeSessionToken: string | null = null;
let activeUserId: string | null = null;
let activeIsAdmin: boolean = false;

/**
 * Main Realtime Synchronization Hook.
 * Call this once in SiteShell (or top-level layout) to orchestrate the single app connection.
 */
export function useRealtimeSync(session: Session | null, isAdmin: boolean = false) {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationsRef = useRef<Set<string>>(new Set());
  const isHiddenRef = useRef<boolean>(
    typeof document !== "undefined" ? document.visibilityState === "hidden" : false,
  );

  // ── Debounced Batch Invalidator ──────────────────────────────
  const flushInvalidations = useCallback(() => {
    if (pendingInvalidationsRef.current.size === 0) return;

    const keysToInvalidate = new Set(pendingInvalidationsRef.current);
    pendingInvalidationsRef.current.clear();

    if (keysToInvalidate.has("availability")) {
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SLOTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    }
    if (keysToInvalidate.has("slots")) {
      queryClient.invalidateQueries({ queryKey: SLOTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    }
    if (keysToInvalidate.has("bookings")) {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      if (activeIsAdmin) {
        queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      }
    }
    if (keysToInvalidate.has("sessions")) {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (activeIsAdmin) {
        queryClient.invalidateQueries({ queryKey: ["admin", "active_sessions"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] });
      }
    }
    if (keysToInvalidate.has("payments")) {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    }
    if (keysToInvalidate.has("admin_dashboard")) {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_STATS_QUERY_KEY });
    }
    if (keysToInvalidate.has("notifications")) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [queryClient]);

  const scheduleInvalidation = useCallback(
    (keys: string[]) => {
      globalLastEventAt = new Date();
      notifyStatusListeners();

      keys.forEach((k) => pendingInvalidationsRef.current.add(k));

      // If document is currently hidden, pause execution until tab becomes visible
      if (isHiddenRef.current) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushInvalidations();
      }, 500); // 500ms debounce
    },
    [flushInvalidations],
  );

  // ── Visibility Change Listener ───────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      isHiddenRef.current = hidden;

      if (!hidden && pendingInvalidationsRef.current.size > 0) {
        // Tab became visible again — flush all accumulated changes in a single batch
        flushInvalidations();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushInvalidations]);

  // ── 1. Realtime JWT Authentication ───────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentToken = session?.access_token ?? null;
    activeSessionToken = currentToken;
    if (currentToken) {
      supabase.realtime.setAuth(currentToken);
    }
  }, [session?.access_token]);

  // ── 2. Single Realtime Channel Setup ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentToken = session?.access_token ?? null;
    const currentUserId = session?.user?.id ?? null;

    activeUserId = currentUserId;
    activeIsAdmin = isAdmin;

    // Anonymous or logged out -> clean up channel and stop
    if (!currentToken || !currentUserId) {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
      globalIsLive = false;
      globalStatus = "disconnected";
      notifyStatusListeners();
      return;
    }

    // Ensure socket auth is current
    supabase.realtime.setAuth(currentToken);

    // If channel already exists and matches current user, don't recreate
    if (activeChannel) {
      return;
    }

    globalStatus = "connecting";
    notifyStatusListeners();

    // Create single unified channel for the entire app
    const channel = supabase.channel("parkgrid_realtime_sync", {
      config: {
        broadcast: { ack: false },
        presence: { key: currentUserId },
      },
    });

    // 1. Availability Ping (Minimal, privacy-safe signal with NO user/vehicle data)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "availability_ping",
      },
      () => {
        const keys = ["availability", "slots"];
        if (activeIsAdmin) {
          keys.push("admin_dashboard");
        }
        scheduleInvalidation(keys);
      },
    );

    // 2. Bookings (Filtered by Postgres RLS: owners get their bookings; admins get all)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
      },
      (payload) => {
        const row = (payload.new as Record<string, unknown>) || (payload.old as Record<string, unknown>) || {};
        const isOwner = row["user_id"] === activeUserId;

        const keys: string[] = ["availability", "slots"];
        if (isOwner) {
          keys.push("bookings", "sessions");
        }
        if (activeIsAdmin) {
          keys.push("bookings", "payments", "sessions", "admin_dashboard");
        }
        scheduleInvalidation(keys);
      },
    );

    // 3. Parking Sessions (Filtered by Postgres RLS)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "parking_sessions",
      },
      (payload) => {
        const row = (payload.new as Record<string, unknown>) || (payload.old as Record<string, unknown>) || {};
        const isOwner = row["user_id"] === activeUserId;

        const keys: string[] = ["availability", "slots", "sessions"];
        if (isOwner) {
          keys.push("bookings");
        }
        if (activeIsAdmin) {
          keys.push("bookings", "sessions", "admin_dashboard");
        }
        scheduleInvalidation(keys);
      },
    );

    // 4. Notifications
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
      },
      (payload) => {
        const row = (payload.new as Record<string, unknown>) || {};
        if (row["user_id"] === activeUserId) {
          scheduleInvalidation(["notifications"]);
        }
      },
    );

    // Subscribe and track status
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        globalIsLive = true;
        globalStatus = "connected";
        notifyStatusListeners();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        globalIsLive = false;
        globalStatus = status === "CHANNEL_ERROR" ? "error" : "disconnected";
        notifyStatusListeners();
        if (err) {
          console.warn("[RealtimeSync] Connection status:", status, err.message);
        }
      }
    });

    activeChannel = channel;

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
      globalIsLive = false;
      globalStatus = "disconnected";
      notifyStatusListeners();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [session?.user?.id, isAdmin, scheduleInvalidation]);

  return {
    isLive: globalIsLive,
    status: globalStatus,
    lastEventAt: globalLastEventAt,
  };
}
