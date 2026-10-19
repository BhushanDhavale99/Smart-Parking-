import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  payBooking,
  getReceipt,
  listMyPayments,
  adminListPayments,
  adminGetPayment,
  type PaymentRow,
  type PaymentRefundRow,
} from "@/lib/payments.server";
import type { PaymentMethod, TestScenario } from "@/lib/payments/provider";

export const PAYMENTS_QUERY_KEY = ["payments"] as const;
export const ADMIN_PAYMENTS_QUERY_KEY = ["admin", "payments"] as const;
export const BOOKINGS_QUERY_KEY = ["bookings"] as const;
export const AVAILABILITY_QUERY_KEY = ["slot_availability"] as const;

export type { PaymentRow, PaymentRefundRow };

export function usePayBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      booking_id: string;
      method: PaymentMethod;
      idempotency_key: string;
      test_scenario?: TestScenario;
      testScenario?: TestScenario;
    }) => {
      const res = await payBooking({
        data: {
          booking_id: params.booking_id,
          method: params.method,
          idempotency_key: params.idempotency_key,
          test_scenario: params.test_scenario ?? params.testScenario ?? "success",
        },
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}

export function useGetReceipt(params: {
  booking_id?: string | undefined;
  payment_id?: string | undefined;
  receipt_number?: string | undefined;
}) {
  return useQuery({
    queryKey: [...PAYMENTS_QUERY_KEY, "receipt", params],
    queryFn: async () => {
      const payload: { booking_id?: string; payment_id?: string; receipt_number?: string } = {};
      if (params.booking_id) payload.booking_id = params.booking_id;
      if (params.payment_id) payload.payment_id = params.payment_id;
      if (params.receipt_number) payload.receipt_number = params.receipt_number;

      const res = await getReceipt({ data: payload });
      return res.payment;
    },
    enabled: Boolean(params.booking_id || params.payment_id || params.receipt_number),
  });
}

export function useListMyPayments(page: number = 1, pageSize: number = 10) {
  return useQuery({
    queryKey: [...PAYMENTS_QUERY_KEY, "my", { page, pageSize }],
    queryFn: async () => {
      return await listMyPayments({ data: { page, pageSize } });
    },
  });
}

export interface AdminPaymentsFilter {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: "all" | "succeeded" | "failed" | "refunded" | "partially_refunded" | undefined;
  method?: "all" | "upi" | "card" | "netbanking" | "wallet" | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export function useAdminListPayments(filters: AdminPaymentsFilter = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 15;
  const status = filters.status ?? "all";
  const method = filters.method ?? "all";
  const search = filters.search ?? "";
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;

  return useQuery({
    queryKey: [
      ...ADMIN_PAYMENTS_QUERY_KEY,
      { page, pageSize, status, method, search, dateFrom, dateTo },
    ],
    queryFn: async () => {
      const payload: {
        page: number;
        pageSize: number;
        status: "all" | "succeeded" | "failed" | "refunded" | "partially_refunded";
        method: "all" | "upi" | "card" | "netbanking" | "wallet";
        search: string;
        dateFrom?: string;
        dateTo?: string;
      } = {
        page,
        pageSize,
        status,
        method,
        search,
      };
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;

      return await adminListPayments({ data: payload });
    },
  });
}

export function useAdminGetPayment(paymentId?: string | undefined) {
  return useQuery({
    queryKey: [...ADMIN_PAYMENTS_QUERY_KEY, "detail", paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      const res = await adminGetPayment({ data: { payment_id: paymentId } });
      return res.payment;
    },
    enabled: Boolean(paymentId),
  });
}
