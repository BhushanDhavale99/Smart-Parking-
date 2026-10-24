import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getAvailability,
  quoteBooking,
  createBooking,
  listMyBookings,
  getBooking,
  getCancellationPreview,
  cancelBooking,
  adminListBookings,
  adminGetBooking,
  adminOverrideBooking,
  type BookingRow,
} from "@/lib/bookings.server";
import {
  listSlots,
  getFacilitySummary,
  type ListSlotsInput,
  type ParkingSlotWithOccupancy,
} from "@/lib/parking.server";
import { SESSIONS_QUERY_KEY } from "./useSessions";
import { PAYMENTS_QUERY_KEY } from "./usePayments";

export type { BookingRow };
export type BookingStatus = BookingRow["status"];
export type { ParkingSlotWithOccupancy };

export type AdminBookingRow = BookingRow & {
  parking_slots?: {
    id: string;
    code: string;
    level_code: string;
    zone: string;
    slot_type: string;
  } | null;
  vehicles?: {
    id: string;
    plate_number: string;
    vehicle_type: string;
    make: string | null;
    model: string | null;
  } | null;
  profiles?: { full_name: string | null; phone: string | null } | null;
};

export type MyBookingRow = BookingRow & {
  parking_slots?: {
    id: string;
    code: string;
    level_code: string;
    zone: string;
    slot_type: string;
  } | null;
  vehicles?: {
    id: string;
    plate_number: string;
    vehicle_type: string;
    make: string | null;
    model: string | null;
  } | null;
};

export const BOOKINGS_QUERY_KEY = ["bookings"] as const;
export const AVAILABILITY_QUERY_KEY = ["availability"] as const;
export const SLOTS_QUERY_KEY = ["slots"] as const;

/**
 * Invalidate all interdependent parking, slot, booking, session, and administrative queries.
 * Called whenever a booking is created, confirmed, paid, cancelled, or overridden.
 */
export const FACILITY_SUMMARY_QUERY_KEY = ["facility-summary"] as const;

export function invalidateBookingRelatedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: SLOTS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: FACILITY_SUMMARY_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["admin"] });
}

export function useFacilitySummary() {
  return useQuery({
    queryKey: FACILITY_SUMMARY_QUERY_KEY,
    queryFn: async () => {
      const res = await getFacilitySummary();
      return res;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30, // 30s live fallback (Realtime pushes updates instantly)
  });
}

export function useParkingSlots(params: Partial<ListSlotsInput> = {}) {
  return useQuery({
    queryKey: [...SLOTS_QUERY_KEY, params],
    queryFn: async () => {
      const res = await listSlots({ data: params });
      return res as {
        slots: ParkingSlotWithOccupancy[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 60, // 60s fallback polling (realtime push is primary)
  });
}

export function useAvailability(
  params: {
    start_at: string;
    end_at: string;
    level?: string | null;
    zone?: string | null;
    slot_type?: string | null;
  },
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [...AVAILABILITY_QUERY_KEY, params],
    queryFn: async () => {
      const res = await getAvailability({ data: params });
      return res.availability;
    },
    enabled: Boolean(enabled && params.start_at && params.end_at),
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 60, // 60s fallback polling
  });
}

export function useQuoteBooking(
  params: {
    slot_id?: string;
    start_at?: string;
    end_at?: string;
  } | null,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["booking_quote", params],
    queryFn: async () => {
      if (!params?.slot_id || !params?.start_at || !params?.end_at) return null;
      const res = await quoteBooking({
        data: {
          slot_id: params.slot_id,
          start_at: params.start_at,
          end_at: params.end_at,
        },
      });
      return res.quote;
    },
    enabled: Boolean(enabled && params?.slot_id && params?.start_at && params?.end_at),
    staleTime: 1000 * 30,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      slot_id: string;
      vehicle_id: string;
      start_at: string;
      end_at: string;
    }) => {
      const res = await createBooking({ data: params });
      return res.booking;
    },
    onSuccess: () => {
      invalidateBookingRelatedQueries(queryClient);
    },
  });
}

export function useListMyBookings(
  statusTab: "Upcoming" | "Active" | "Completed" | "Cancelled",
  page: number = 1,
  pageSize: number = 10,
) {
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, "my", { statusTab, page, pageSize }],
    queryFn: async () => {
      const res = await listMyBookings({ data: { statusTab, page, pageSize } });
      return res as {
        bookings: MyBookingRow[];
        totalCount: number;
        page: number;
        pageSize: number;
      };
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 60, // 60s fallback polling
  });
}

export function useGetBooking(id?: string | null, reference?: string | null) {
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, "detail", { id, reference }],
    queryFn: async () => {
      const res = await getBooking({
        data: {
          id: id || undefined,
          reference: reference || undefined,
        },
      });
      return res.booking as MyBookingRow;
    },
    enabled: Boolean(id || reference),
    staleTime: 1000 * 30,
  });
}

export function useCancellationPreview(booking_id?: string | null) {
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, "cancellation_preview", booking_id],
    queryFn: async () => {
      if (!booking_id) return null;
      const res = await getCancellationPreview({ data: { booking_id } });
      return res.preview;
    },
    enabled: Boolean(booking_id),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { booking_id: string; reason?: string | null }) => {
      const res = await cancelBooking({ data: params });
      return res.booking;
    },
    onSuccess: () => {
      invalidateBookingRelatedQueries(queryClient);
    },
  });
}

export function useAdminBookings(params?: {
  status?: string | undefined;
  payment_status?: string | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const normalizedParams = {
    status: params?.status ?? "All",
    payment_status: params?.payment_status ?? "All",
    search: params?.search ?? "",
    dateFrom: params?.dateFrom,
    dateTo: params?.dateTo,
    page: params?.page ?? 1,
    pageSize: Math.min(params?.pageSize ?? 10, 50),
  };
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, "admin", normalizedParams],
    queryFn: async () => {
      const res = await adminListBookings({ data: normalizedParams });
      return res as unknown as {
        bookings: AdminBookingRow[];
        totalCount: number;
        totalPages: number;
        page: number;
        pageSize: number;
      };
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 60, // 60s fallback sync for admin bookings
  });
}

export function useAdminBookingDetail(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, "admin_detail", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await adminGetBooking({ data: { booking_id: bookingId } });
      return res.booking;
    },
    enabled: Boolean(bookingId),
  });
}

export function useAdminOverrideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      booking_id: string;
      action: "cancel_full_refund" | "cancel_by_policy" | "cancel_no_refund" | "mark_no_show";
      reason: string;
    }) => {
      const res = await adminOverrideBooking({ data: params });
      return res.booking;
    },
    onSuccess: () => {
      invalidateBookingRelatedQueries(queryClient);
    },
  });
}
