import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleType = "car" | "suv" | "bike" | "ev";
export type ConnectorType = "CCS2" | "Type2" | "CHAdeMO" | "Bharat_AC001" | "Bharat_DC001";

// ── Shared Helper: Create Per-Request Scoped Supabase Client ──
async function getScopedClient(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Response("Service configuration missing", { status: 500 });
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false },
  });
}

// ── 1. listVehicles ──────────────────────────────────────────
const listVehiclesSchema = z
  .object({
    includeArchived: z.boolean().default(false),
  })
  .default({ includeArchived: false });

export const listVehicles = createServerFn({ method: "GET" })
  .validator((params?: Partial<z.infer<typeof listVehiclesSchema>>) =>
    listVehiclesSchema.parse(params ?? {}),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    let query = client
      .from("vehicles")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (!data.includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data: vehicles, error } = await query;
    if (error) {
      console.error("[listVehicles] Query error:", error.message);
      throw new Error("Failed to load vehicles.");
    }

    return { vehicles: vehicles ?? [] };
  });

// ── 2. createVehicle ─────────────────────────────────────────
const createVehicleSchema = z
  .object({
    plate_number: z
      .string()
      .trim()
      .min(6, "Plate number must be at least 6 characters")
      .max(12, "Plate number cannot exceed 12 characters")
      .regex(/^[A-Za-z0-9\s-]+$/, "Plate number can only contain letters and numbers"),
    vehicle_type: z.enum(["car", "suv", "bike", "ev"]),
    make: z.string().trim().max(50, "Make cannot exceed 50 characters").optional().nullable(),
    model: z.string().trim().max(50, "Model cannot exceed 50 characters").optional().nullable(),
    color: z.string().trim().max(30, "Color cannot exceed 30 characters").optional().nullable(),
    is_ev: z.boolean().default(false),
    connector_type: z
      .enum(["CCS2", "Type2", "CHAdeMO", "Bharat_AC001", "Bharat_DC001"])
      .optional()
      .nullable(),
    is_default: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    const isEv = val.is_ev || val.vehicle_type === "ev";
    if (isEv && !val.connector_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector type is required for electric vehicles",
        path: ["connector_type"],
      });
    }
    if (!isEv && val.connector_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector type is only applicable for electric vehicles",
        path: ["connector_type"],
      });
    }
  });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const createVehicle = createServerFn({ method: "POST" })
  .validator((params: CreateVehicleInput) => createVehicleSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    const normalizedPlate = data.plate_number.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const isEv = data.is_ev || data.vehicle_type === "ev";

    const { data: newVehicle, error } = await client
      .from("vehicles")
      .insert({
        user_id: authUser.user.id,
        plate_number: normalizedPlate,
        vehicle_type: data.vehicle_type,
        make: data.make?.trim() || null,
        model: data.model?.trim() || null,
        color: data.color?.trim() || null,
        is_ev: isEv,
        connector_type: isEv && data.connector_type ? data.connector_type : null,
        is_default: false,
      })
      .select()
      .maybeSingle();

    if (error || !newVehicle) {
      if (!error && !newVehicle) {
        console.error("[createVehicle] Insert returned no data without error (RLS restriction or missing row)");
        throw new Error("Vehicle registration failed unexpectedly. Please verify your permissions and try again.");
      }
      console.error("[createVehicle] Database error:", error?.code, error?.message);
      if (error?.code === "23505" || error?.message?.includes("plate")) {
        throw new Error("A vehicle with this plate number is already registered to your account.");
      }
      if (error?.code === "P0001" || error?.message?.includes("limit")) {
        throw new Error(
          "Active vehicle limit reached. You can register a maximum of 5 active vehicles.",
        );
      }
      throw new Error("Failed to register vehicle. Please check the details and try again.");
    }

    if (data.is_default && newVehicle) {
      const { data: defaultedVehicle, error: defaultError } = await client.rpc(
        "set_default_vehicle",
        {
          p_vehicle_id: newVehicle.id,
        },
      );
      if (defaultError) {
        console.error("[createVehicle] set_default_vehicle error:", defaultError.message);
      }
      return { vehicle: defaultedVehicle ?? newVehicle };
    }

    return { vehicle: newVehicle };
  });

// ── 3. updateVehicle ─────────────────────────────────────────
const updateVehicleSchema = z
  .object({
    id: z.string().uuid(),
    plate_number: z
      .string()
      .trim()
      .min(6, "Plate number must be at least 6 characters")
      .max(12, "Plate number cannot exceed 12 characters")
      .regex(/^[A-Za-z0-9\s-]+$/, "Plate number can only contain letters and numbers"),
    vehicle_type: z.enum(["car", "suv", "bike", "ev"]),
    make: z.string().trim().max(50, "Make cannot exceed 50 characters").optional().nullable(),
    model: z.string().trim().max(50, "Model cannot exceed 50 characters").optional().nullable(),
    color: z.string().trim().max(30, "Color cannot exceed 30 characters").optional().nullable(),
    is_ev: z.boolean().default(false),
    connector_type: z
      .enum(["CCS2", "Type2", "CHAdeMO", "Bharat_AC001", "Bharat_DC001"])
      .optional()
      .nullable(),
    is_default: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    const isEv = val.is_ev || val.vehicle_type === "ev";
    if (isEv && !val.connector_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector type is required for electric vehicles",
        path: ["connector_type"],
      });
    }
    if (!isEv && val.connector_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector type is only applicable for electric vehicles",
        path: ["connector_type"],
      });
    }
  });

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const updateVehicle = createServerFn({ method: "POST" })
  .validator((params: UpdateVehicleInput) => updateVehicleSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    const normalizedPlate = data.plate_number.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const isEv = data.is_ev || data.vehicle_type === "ev";

    const { data: updatedVehicle, error } = await client
      .from("vehicles")
      .update({
        plate_number: normalizedPlate,
        vehicle_type: data.vehicle_type,
        make: data.make?.trim() || null,
        model: data.model?.trim() || null,
        color: data.color?.trim() || null,
        is_ev: isEv,
        connector_type: isEv && data.connector_type ? data.connector_type : null,
      })
      .eq("id", data.id)
      .eq("user_id", authUser.user.id)
      .is("archived_at", null)
      .select()
      .maybeSingle();

    if (error || !updatedVehicle) {
      if (!error && !updatedVehicle) {
        console.error("[updateVehicle] Update returned no data without error");
        throw new Error("Vehicle not found, already archived, or access denied.");
      }
      console.error("[updateVehicle] Database error:", error?.code, error?.message);
      if (error?.code === "23505" || error?.message.includes("plate")) {
        throw new Error("A vehicle with this plate number is already registered to your account.");
      }
      throw new Error("Vehicle not found or could not be updated.");
    }

    if (data.is_default && !updatedVehicle.is_default) {
      const { data: defaultedVehicle, error: defaultError } = await client.rpc(
        "set_default_vehicle",
        {
          p_vehicle_id: updatedVehicle.id,
        },
      );
      if (defaultError) {
        console.error("[updateVehicle] set_default_vehicle error:", defaultError.message);
      }
      return { vehicle: defaultedVehicle ?? updatedVehicle };
    }

    return { vehicle: updatedVehicle };
  });

// ── 4. setDefaultVehicle ─────────────────────────────────────
const setDefaultVehicleSchema = z.object({
  id: z.string().uuid(),
});

export const setDefaultVehicle = createServerFn({ method: "POST" })
  .validator((params: { id: string }) => setDefaultVehicleSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: vehicle, error } = await client.rpc("set_default_vehicle", {
      p_vehicle_id: data.id,
    });

    if (error || !vehicle) {
      if (!error && !vehicle) {
        console.error("[setDefaultVehicle] RPC returned no data without error");
        throw new Error("Vehicle not found, already archived, or access denied.");
      }
      console.error("[setDefaultVehicle] RPC error:", error?.message);
      throw new Error("Vehicle not found or could not be set as default.");
    }

    return { vehicle };
  });

// ── 5. archiveVehicle ────────────────────────────────────────
const archiveVehicleSchema = z.object({
  id: z.string().uuid(),
});

export const archiveVehicle = createServerFn({ method: "POST" })
  .validator((params: { id: string }) => archiveVehicleSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    const { data: archived, error } = await client
      .from("vehicles")
      .update({
        archived_at: new Date().toISOString(),
        is_default: false,
      })
      .eq("id", data.id)
      .eq("user_id", authUser.user.id)
      .is("archived_at", null)
      .select()
      .maybeSingle();

    if (error || !archived) {
      if (!error && !archived) {
        console.error("[archiveVehicle] Archive returned no data without error");
        throw new Error("Vehicle not found, already archived, or access denied.");
      }
      console.error("[archiveVehicle] Error:", error?.message);
      throw new Error("Vehicle not found or already archived.");
    }

    return { success: true, id: archived.id };
  });
