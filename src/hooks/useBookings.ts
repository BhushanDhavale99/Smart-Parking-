import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAvailability,
  quoteBooking,
  createBooking,
  listMyBookings,
  getBooking,
  getCancellationPreview,
  cancelBooking,
  adminListBookings,
  type BookingRow,
} from "@/lib/bookings.server";

export type { BookingRow };
export type BookingStatus = BookingRow["status"];

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
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 1000 * 30, // 30 seconds polling for live updates
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
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
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
    staleTime: 1000 * 20,
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
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });
}

export function useAdminBookings(params?: {
  status?: string | undefined;
  payment_status?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const normalizedParams = {
    status: params?.status ?? "All",
    payment_status: params?.payment_status ?? "All",
    search: params?.search ?? "",
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 10,
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
    staleTime: 1000 * 15,
  });
}
