import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  getUnreadCount,
  markNotificationsRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications.server";

export type { NotificationRow, NotificationType };

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const NOTIFICATIONS_UNREAD_COUNT_KEY = ["notifications", "unread_count"] as const;

export function useNotifications(
  filter: "all" | "unread" = "all",
  page: number = 1,
  pageSize: number = 20,
) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, { filter, page, pageSize }],
    queryFn: async () => {
      return await listNotifications({ data: { filter, page, pageSize } });
    },
    staleTime: 1000 * 10,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
    queryFn: async () => {
      const res = await getUnreadCount();
      return res.count;
    },
    staleTime: 1000 * 15,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      return await markNotificationsRead({ data: { ids } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await markAllNotificationsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_KEY, 0);
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteNotification({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY });
    },
  });
}
