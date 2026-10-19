export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: "member" | "admin" | "staff";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "member" | "admin" | "staff";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "member" | "admin" | "staff";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parking_levels: {
        Row: {
          code: "B2" | "B1" | "G1" | "L1" | "L2";
          name: string;
          sort_order: number;
          allows_heavy: boolean;
        };
        Insert: {
          code: "B2" | "B1" | "G1" | "L1" | "L2";
          name: string;
          sort_order: number;
          allows_heavy?: boolean;
        };
        Update: {
          code?: "B2" | "B1" | "G1" | "L1" | "L2";
          name?: string;
          sort_order?: number;
          allows_heavy?: boolean;
        };
        Relationships: [];
      };
      parking_slots: {
        Row: {
          id: string;
          code: string;
          level_code: "B2" | "B1" | "G1" | "L1" | "L2";
          zone: "A" | "B" | "EV";
          bay_number: number;
          slot_type: "standard" | "ev" | "accessible";
          has_ev_charger: boolean;
          hourly_rate_paise: number;
          admin_status: "active" | "maintenance" | "blocked";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          level_code: "B2" | "B1" | "G1" | "L1" | "L2";
          zone: "A" | "B" | "EV";
          bay_number: number;
          slot_type: "standard" | "ev" | "accessible";
          has_ev_charger?: boolean;
          hourly_rate_paise: number;
          admin_status?: "active" | "maintenance" | "blocked";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          level_code?: "B2" | "B1" | "G1" | "L1" | "L2";
          zone?: "A" | "B" | "EV";
          bay_number?: number;
          slot_type?: "standard" | "ev" | "accessible";
          has_ev_charger?: boolean;
          hourly_rate_paise?: number;
          admin_status?: "active" | "maintenance" | "blocked";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parking_slots_level_code_fkey";
            columns: ["level_code"];
            isOneToOne: false;
            referencedRelation: "parking_levels";
            referencedColumns: ["code"];
          },
        ];
      };
      vehicles: {
        Row: {
          id: string;
          user_id: string;
          plate_number: string;
          vehicle_type: "car" | "suv" | "bike" | "ev";
          make: string | null;
          model: string | null;
          color: string | null;
          is_ev: boolean;
          connector_type: "CCS2" | "Type2" | "CHAdeMO" | "Bharat_AC001" | "Bharat_DC001" | null;
          is_default: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          plate_number: string;
          vehicle_type: "car" | "suv" | "bike" | "ev";
          make?: string | null;
          model?: string | null;
          color?: string | null;
          is_ev?: boolean;
          connector_type?: "CCS2" | "Type2" | "CHAdeMO" | "Bharat_AC001" | "Bharat_DC001" | null;
          is_default?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plate_number?: string;
          vehicle_type?: "car" | "suv" | "bike" | "ev";
          make?: string | null;
          model?: string | null;
          color?: string | null;
          is_ev?: boolean;
          connector_type?: "CCS2" | "Type2" | "CHAdeMO" | "Bharat_AC001" | "Bharat_DC001" | null;
          is_default?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_settings: {
        Row: {
          id: boolean;
          gst_bps: number;
          exit_grace_minutes: number;
          hold_minutes: number;
          min_hours: number;
          max_hours: number;
          max_advance_days: number;
          refund_full_hours: number;
          refund_partial_minutes: number;
          partial_refund_bps: number;
          payment_mode: "mock" | "razorpay";
          max_payment_attempts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          gst_bps?: number;
          exit_grace_minutes?: number;
          hold_minutes?: number;
          min_hours?: number;
          max_hours?: number;
          max_advance_days?: number;
          refund_full_hours?: number;
          refund_partial_minutes?: number;
          partial_refund_bps?: number;
          payment_mode?: "mock" | "razorpay";
          max_payment_attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          gst_bps?: number;
          exit_grace_minutes?: number;
          hold_minutes?: number;
          min_hours?: number;
          max_hours?: number;
          max_advance_days?: number;
          refund_full_hours?: number;
          refund_partial_minutes?: number;
          partial_refund_bps?: number;
          payment_mode?: "mock" | "razorpay";
          max_payment_attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          reference: string;
          user_id: string;
          slot_id: string;
          vehicle_id: string;
          plate_snapshot: string;
          vehicle_type_snapshot: string;
          start_at: string;
          end_at: string;
          during: string;
          hours: number;
          hourly_rate_paise: number;
          base_paise: number;
          gst_paise: number;
          total_paise: number;
          status:
            "reserved" | "confirmed" | "active" | "completed" | "cancelled" | "no_show" | "expired";
          payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
          hold_expires_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          refund_paise: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference: string;
          user_id: string;
          slot_id: string;
          vehicle_id: string;
          plate_snapshot: string;
          vehicle_type_snapshot: string;
          start_at: string;
          end_at: string;
          during?: string;
          hours: number;
          hourly_rate_paise: number;
          base_paise: number;
          gst_paise: number;
          total_paise: number;
          status?:
            "reserved" | "confirmed" | "active" | "completed" | "cancelled" | "no_show" | "expired";
          payment_status?: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
          hold_expires_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          refund_paise?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          user_id?: string;
          slot_id?: string;
          vehicle_id?: string;
          plate_snapshot?: string;
          vehicle_type_snapshot?: string;
          start_at?: string;
          end_at?: string;
          during?: string;
          hours?: number;
          hourly_rate_paise?: number;
          base_paise?: number;
          gst_paise?: number;
          total_paise?: number;
          status?:
            "reserved" | "confirmed" | "active" | "completed" | "cancelled" | "no_show" | "expired";
          payment_status?: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
          hold_expires_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          refund_paise?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "parking_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          user_id: string;
          provider: string;
          provider_ref: string | null;
          method: "upi" | "card" | "netbanking" | "wallet";
          amount_paise: number;
          base_paise: number;
          gst_paise: number;
          currency: string;
          status: "succeeded" | "failed" | "refunded" | "partially_refunded";
          failure_reason: string | null;
          receipt_number: string | null;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          user_id: string;
          provider?: string;
          provider_ref?: string | null;
          method: "upi" | "card" | "netbanking" | "wallet";
          amount_paise: number;
          base_paise: number;
          gst_paise: number;
          currency?: string;
          status: "succeeded" | "failed" | "refunded" | "partially_refunded";
          failure_reason?: string | null;
          receipt_number?: string | null;
          idempotency_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          user_id?: string;
          provider?: string;
          provider_ref?: string | null;
          method?: "upi" | "card" | "netbanking" | "wallet";
          amount_paise?: number;
          base_paise?: number;
          gst_paise?: number;
          currency?: string;
          status?: "succeeded" | "failed" | "refunded" | "partially_refunded";
          failure_reason?: string | null;
          receipt_number?: string | null;
          idempotency_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_refunds: {
        Row: {
          id: string;
          payment_id: string;
          booking_id: string;
          amount_paise: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          booking_id: string;
          amount_paise: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          booking_id?: string;
          amount_paise?: number;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_refunds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      parking_sessions: {
        Row: {
          id: string;
          booking_id: string;
          user_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at: string | null;
          ended_by_admin: boolean;
          duration_minutes: number | null;
          status: "active" | "completed" | "auto_ended" | "cancelled";
          auto_ended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          user_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at?: string | null;
          ended_by_admin?: boolean;
          duration_minutes?: number | null;
          status?: "active" | "completed" | "auto_ended" | "cancelled";
          auto_ended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          user_id?: string;
          started_at?: string;
          booked_end_at?: string;
          ended_at?: string | null;
          ended_by_admin?: boolean;
          duration_minutes?: number | null;
          status?: "active" | "completed" | "auto_ended" | "cancelled";
          auto_ended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parking_sessions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parking_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      overstay_charges: {
        Row: {
          id: string;
          session_id: string;
          booking_id: string;
          user_id: string;
          overstay_minutes: number;
          base_paise: number;
          gst_paise: number;
          total_paise: number;
          provider_ref: string | null;
          receipt_number: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          booking_id: string;
          user_id: string;
          overstay_minutes: number;
          base_paise: number;
          gst_paise: number;
          total_paise: number;
          provider_ref?: string | null;
          receipt_number?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          booking_id?: string;
          user_id?: string;
          overstay_minutes?: number;
          base_paise?: number;
          gst_paise?: number;
          total_paise?: number;
          provider_ref?: string | null;
          receipt_number?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "overstay_charges_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "parking_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "overstay_charges_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          message: string | null;
          type: string;
          is_read: boolean;
          read: boolean;
          metadata: Json;
          link: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          body?: string | null;
          message?: string | null;
          type?: string;
          is_read?: boolean;
          read?: boolean;
          metadata?: Json;
          link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          message?: string | null;
          type?: string;
          is_read?: boolean;
          read?: boolean;
          metadata?: Json;
          link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_default_vehicle: {
        Args: {
          p_vehicle_id: string;
        };
        Returns: Database["public"]["Tables"]["vehicles"]["Row"];
      };
      expire_stale_holds: {
        Args: Record<string, never>;
        Returns: void;
      };
      generate_booking_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
      quote_booking: {
        Args: {
          p_slot_id: string;
          p_start: string;
          p_end: string;
        };
        Returns: {
          hours: number;
          hourly_rate_paise: number;
          base_paise: number;
          gst_paise: number;
          total_paise: number;
        }[];
      };
      slot_availability: {
        Args: {
          p_start: string;
          p_end: string;
          p_level?: string | null;
          p_zone?: string | null;
          p_slot_type?: string | null;
        };
        Returns: {
          slot_id: string;
          is_available: boolean;
        }[];
      };
      create_booking: {
        Args: {
          p_slot_id: string;
          p_vehicle_id: string;
          p_start: string;
          p_end: string;
        };
        Returns: Database["public"]["Tables"]["bookings"]["Row"];
      };
      cancellation_preview: {
        Args: {
          p_booking_id: string;
        };
        Returns: {
          booking_id: string;
          total_paise: number;
          refund_paise: number;
          refund_percentage: number;
          payment_status: string;
        }[];
      };
      cancel_booking: {
        Args: {
          p_booking_id: string;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["bookings"]["Row"];
      };
      generate_receipt_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      pay_for_booking: {
        Args: {
          p_booking_id: string;
          p_method: string;
          p_idempotency_key: string;
          p_test_scenario?: string | null;
        };
        Returns: Json;
      };
      get_active_session: {
        Args: {
          p_booking_id?: string | null;
        };
        Returns: {
          session_id: string;
          booking_id: string;
          user_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at: string | null;
          status: string;
          auto_ended: boolean;
          ended_by_admin: boolean;
          duration_minutes: number | null;
          is_active: boolean;
          elapsed_seconds: number;
          seconds_remaining: number;
          overstay_seconds: number;
          overstay_paise_so_far: number;
        }[];
      };
      end_session: {
        Args: {
          p_session_id: string;
        };
        Returns: {
          session_id: string;
          booking_id: string;
          ended_at: string;
          duration_minutes: number;
          overstay_minutes: number;
          overstay_total_paise: number;
        }[];
      };
      list_my_sessions: {
        Args: {
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          session_id: string;
          booking_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at: string | null;
          status: string;
          auto_ended: boolean;
          duration_minutes: number | null;
          booking_reference: string;
          slot_code: string;
          level_code: string;
          plate_snapshot: string;
          overstay_total_paise: number;
          total_count: number;
        }[];
      };
      get_session: {
        Args: {
          p_session_id: string;
        };
        Returns: {
          session_id: string;
          booking_id: string;
          user_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at: string | null;
          status: string;
          auto_ended: boolean;
          ended_by_admin: boolean;
          duration_minutes: number | null;
          booking_reference: string;
          slot_code: string;
          level_code: string;
          plate_snapshot: string;
          overstay_total_paise: number;
        }[];
      };
      admin_list_sessions: {
        Args: {
          p_status?: string | null;
          p_search?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          session_id: string;
          booking_id: string;
          user_id: string;
          started_at: string;
          booked_end_at: string;
          ended_at: string | null;
          status: string;
          auto_ended: boolean;
          ended_by_admin: boolean;
          duration_minutes: number | null;
          booking_reference: string;
          slot_code: string;
          level_code: string;
          plate_snapshot: string;
          user_full_name: string | null;
          overstay_total_paise: number;
          total_count: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
