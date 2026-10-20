import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminListUsers,
  adminSetUserRole,
  adminGetUserDetail,
  type AdminUserRow,
} from "@/lib/users.server";

export const USERS_QUERY_KEY = ["admin", "users"] as const;

export type { AdminUserRow };

export function useAdminUsers(params?: {
  search?: string | undefined;
  role?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const normalizedParams = {
    search: params?.search ?? "",
    role: params?.role ?? "All",
    page: params?.page ?? 1,
    pageSize: Math.min(params?.pageSize ?? 10, 50),
  };

  return useQuery({
    queryKey: [...USERS_QUERY_KEY, normalizedParams],
    queryFn: async () => {
      const res = await adminListUsers({ data: normalizedParams });
      return res;
    },
    staleTime: 1000 * 15,
  });
}

export function useAdminSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      user_id: string;
      role: "member" | "staff" | "admin";
      reason: string;
    }) => {
      const res = await adminSetUserRole({ data: params });
      return res.profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useAdminUserDetail(userId?: string | null) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, "detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await adminGetUserDetail({ data: { user_id: userId } });
      return res;
    },
    enabled: Boolean(userId),
  });
}
