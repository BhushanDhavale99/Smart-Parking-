import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  setDefaultVehicle,
  archiveVehicle,
  type VehicleRow,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from "@/lib/vehicles.server";

export type { VehicleRow, CreateVehicleInput, UpdateVehicleInput };

export const VEHICLES_QUERY_KEY = ["vehicles"] as const;

export function useVehicles(includeArchived: boolean = false) {
  return useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, { includeArchived }],
    queryFn: async () => {
      const res = await listVehicles({ data: { includeArchived } });
      return res.vehicles;
    },
    staleTime: 1000 * 30,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVehicleInput) => {
      const res = await createVehicle({ data: input });
      return res.vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateVehicleInput) => {
      const res = await updateVehicle({ data: input });
      return res.vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

export function useSetDefaultVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await setDefaultVehicle({ data: { id } });
      return res.vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

export function useArchiveVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await archiveVehicle({ data: { id } });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}
