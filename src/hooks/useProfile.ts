import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  updateProfile,
  listRecentBookings,
  type ProfileData,
  type UpdateProfileInput,
} from "@/lib/profile.server";

export type { ProfileData, UpdateProfileInput };

export const PROFILE_QUERY_KEY = ["profile"] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async () => {
      const res = await getProfile();
      return res.profile;
    },
    staleTime: 1000 * 30,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const res = await updateProfile({ data: input });
      return res.profile;
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, updatedProfile);
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
      queryClient.invalidateQueries({ queryKey: ["user_profile"] });
    },
  });
}

export function useRecentBookings() {
  return useQuery({
    queryKey: ["profile", "recent_bookings"],
    queryFn: async () => {
      const res = await listRecentBookings();
      return res.bookings;
    },
    staleTime: 1000 * 15,
  });
}
