import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type PaymentRefundRow = Database["public"]["Tables"]["payment_refunds"]["Row"];

export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet";
export type TestScenario = "success" | "decline" | "insufficient_funds" | "timeout";

export interface CreatePaymentParams {
  bookingId: string;
  method: PaymentMethod;
  idempotencyKey: string;
  testScenario?: TestScenario;
}

export interface PaymentResult {
  payment: PaymentRow;
  booking: BookingRow;
}

export interface WebhookResult {
  handled: boolean;
  event: string;
  details?: unknown;
}

/**
 * Universal payment provider interface designed for swappable gateways.
 * A real gateway (Razorpay) can plug into this interface without altering booking logic.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(
    client: SupabaseClient<Database>,
    params: CreatePaymentParams,
  ): Promise<PaymentResult>;
  handleWebhook?(payload: unknown, signature?: string): Promise<WebhookResult>;
}

/**
 * MockPaymentProvider
 * Executes simulated payment transactions directly in Postgres using the atomic
 * pay_for_booking RPC.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createPayment(
    client: SupabaseClient<Database>,
    params: CreatePaymentParams,
  ): Promise<PaymentResult> {
    const { data, error } = await client.rpc("pay_for_booking", {
      p_booking_id: params.bookingId,
      p_method: params.method,
      p_idempotency_key: params.idempotencyKey,
      p_test_scenario: params.testScenario ?? "success",
    });

    if (error) {
      throw new Error(error.message || "Mock payment processing failed.");
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response received from payment processor.");
    }

    const payload = data as { payment: PaymentRow; booking: BookingRow };
    return {
      payment: payload.payment,
      booking: payload.booking,
    };
  }

  async handleWebhook(payload: unknown, _signature?: string): Promise<WebhookResult> {
    console.info("[MockPaymentProvider] Received mock webhook:", payload);
    return {
      handled: true,
      event: "mock.payment.processed",
      details: payload,
    };
  }
}

/*
 * ============================================================================
 * FUTURE GATEWAY INTEGRATION: RAZORPAY
 * ============================================================================
 * To connect live Razorpay payments without altering booking logic:
 *
 * 1. Implement RazorpayPaymentProvider implements PaymentProvider:
 *    - createPayment:
 *        a. Fetches booking row to get server-verified amount (booking.total_paise).
 *        b. Calls Razorpay API: razorpay.orders.create({ amount, currency: "INR", receipt: booking.reference }).
 *        c. Returns gateway order metadata for client Razorpay checkout modal.
 *    - handleWebhook:
 *        a. Validates HMAC SHA256 signature using RAZORPAY_WEBHOOK_SECRET.
 *        b. On 'order.paid' / 'payment.captured', updates payment status to 'succeeded',
 *           confirms booking, and records receipt.
 *
 * 2. In getPaymentProvider(mode), return new RazorpayPaymentProvider() when mode === 'razorpay'.
 * ============================================================================
 */

export function getPaymentProvider(mode: "mock" | "razorpay" = "mock"): PaymentProvider {
  if (mode === "mock") {
    return new MockPaymentProvider();
  }

  if (mode === "razorpay") {
    throw new Error(
      "Razorpay gateway provider is not yet activated. Set payment_mode to 'mock' in pricing settings.",
    );
  }

  throw new Error(`Unsupported payment provider mode: "${mode}"`);
}
