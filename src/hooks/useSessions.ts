import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getActiveSession,
  endSession,
  listMySessions,
  getSession,
  adminListSessions,
} from "@/lib/sessions.server";
import { BOOKINGS_QUERY_KEY } from "./useBookings";

export const SESSIONS_QUERY_KEY = ["sessions"] as const;

export type ActiveSessionData = {
  sessionId: string;
  bookingId: string;
  userId: string;
  startedAt: string;
  bookedEndAt: string;
  endedAt: string | null;
  status: string;
  autoEnded: boolean;
  endedByAdmin: boolean;
  durationMinutes: number | null;
  isActive: boolean;
  elapsedSeconds: number;
  secondsRemaining: number;
  overstaySeconds: number;
  overstayPaiseSoFar: number;
  elapsed: number;
  remaining: number;
};

export type MySessionRow = {
  sessionId: string;
  bookingId: string;
  startedAt: string;
  bookedEndAt: string;
  endedAt: string | null;
  status: string;
  autoEnded: boolean;
  durationMinutes: number | null;
  bookingReference: string;
  slotCode: string;
  levelCode: string;
  plateSnapshot: string;
  overstayTotalPaise: number;
};

export type AdminSessionRow = {
  sessionId: string;
  bookingId: string;
  userId: string;
  startedAt: string;
  bookedEndAt: string;
  endedAt: string | null;
  status: string;
  autoEnded: boolean;
  endedByAdmin: boolean;
  durationMinutes: number | null;
  bookingReference: string;
  slotCode: string;
  levelCode: string;
  plateSnapshot: string;
  userFullName: string | null;
  overstayTotalPaise: number;
};

export function useActiveSession(bookingId?: string | null) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "active", bookingId ?? "current"],
    queryFn: async () => {
      const res = await getActiveSession({
        data: { booking_id: bookingId ?? undefined },
      });
      return (res.session as ActiveSessionData | null) ?? null;
    },
    refetchInterval: 1000 * 15, // poll every 15s to keep active timer / overstay fresh
    staleTime: 1000 * 10,
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { sessionId: string }) => {
      const res = await endSession({
        data: { session_id: params.sessionId },
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });
}

export function useListMySessions(status?: string | null, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "my", { status, page, pageSize }],
    queryFn: async () => {
      const res = await listMySessions({
        data: { status: status || undefined, page, pageSize },
      });
      return res as {
        sessions: MySessionRow[];
        totalCount: number;
        totalPages: number;
        page: number;
        pageSize: number;
      };
    },
    staleTime: 1000 * 20,
  });
}

export function useGetSession(sessionId?: string | null) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "detail", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await getSession({
        data: { session_id: sessionId },
      });
      return res.session;
    },
    enabled: Boolean(sessionId),
    staleTime: 1000 * 30,
  });
}

export function useAdminSessions(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "admin", params],
    queryFn: async () => {
      const res = await adminListSessions({
        data: {
          status: params.status ?? "All",
          search: params.search ?? "",
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 10,
        },
      });
      return res as {
        sessions: AdminSessionRow[];
        totalCount: number;
        totalPages: number;
        page: number;
        pageSize: number;
      };
    },
    staleTime: 1000 * 15,
  });
}
