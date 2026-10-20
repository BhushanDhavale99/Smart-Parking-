import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationType = "booking" | "payment" | "session" | "system" | "info";

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

// ── 1. listNotifications ──────────────────────────────────────
const listNotificationsSchema = z.object({
  filter: z.enum(["all", "unread"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const listNotifications = createServerFn({ method: "GET" })
  .validator((params?: unknown) => listNotificationsSchema.parse(params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    let query = client
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", authUser.user.id)
      .order("created_at", { ascending: false });

    if (data.filter === "unread") {
      query = query.eq("is_read", false);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    query = query.range(from, to);

    const { data: rows, count, error } = await query;

    if (error) {
      console.error("[listNotifications] Error:", error.message);
      throw new Error("Failed to load notifications.");
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / data.pageSize));

    return {
      notifications: (rows ?? []) as NotificationRow[],
      totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages,
    };
  });

// ── 2. getUnreadCount ─────────────────────────────────────────
export const getUnreadCount = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireUser } = await import("@/lib/auth.server");
  const authUser = await requireUser(request);

  const client = await getScopedClient(request);

  // Try RPC first (defined in new migration)
  const { data: rpcCount, error: rpcError } = await client.rpc("unread_notification_count");

  if (!rpcError && typeof rpcCount === "number") {
    return { count: rpcCount };
  }

  // Fallback to direct count query
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authUser.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[getUnreadCount] Error:", error.message);
    return { count: 0 };
  }

  return { count: count ?? 0 };
});

// ── 3. markNotificationsRead ──────────────────────────────────
const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const markNotificationsRead = createServerFn({ method: "POST" })
  .validator((params: unknown) => markNotificationsReadSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    // Try RPC
    const { data: count, error: rpcError } = await client.rpc("mark_notifications_read", {
      p_ids: data.ids,
    });

    if (!rpcError) {
      return { success: true, count: typeof count === "number" ? count : data.ids.length };
    }

    // Fallback: direct update
    const { error } = await client
      .from("notifications")
      .update({ is_read: true, read: true })
      .eq("user_id", authUser.user.id)
      .in("id", data.ids);

    if (error) {
      console.error("[markNotificationsRead] Error:", error.message);
      throw new Error("Failed to mark notifications as read.");
    }

    return { success: true, count: data.ids.length };
  });

// ── 4. markAllNotificationsRead ───────────────────────────────
export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireUser } = await import("@/lib/auth.server");
  const authUser = await requireUser(request);

  const client = await getScopedClient(request);

  // Try RPC
  const { data: count, error: rpcError } = await client.rpc("mark_all_notifications_read");

  if (!rpcError) {
    return { success: true, count: typeof count === "number" ? count : 0 };
  }

  // Fallback: direct update
  const { error } = await client
    .from("notifications")
    .update({ is_read: true, read: true })
    .eq("user_id", authUser.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[markAllNotificationsRead] Error:", error.message);
    throw new Error("Failed to mark all notifications as read.");
  }

  return { success: true, count: 0 };
});

// ── 5. deleteNotification ─────────────────────────────────────
const deleteNotificationSchema = z.object({
  id: z.string().uuid(),
});

export const deleteNotification = createServerFn({ method: "POST" })
  .validator((params: unknown) => deleteNotificationSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    const { error } = await client
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", authUser.user.id);

    if (error) {
      console.error("[deleteNotification] Error:", error.message);
      throw new Error("Failed to delete notification.");
    }

    return { success: true };
  });
