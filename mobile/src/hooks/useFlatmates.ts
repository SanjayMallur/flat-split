import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/config/api';
import type { Flatmate } from '@/types/api';

export const useFlatmates = () =>
  useQuery({
    queryKey: ['flatmates'],
    queryFn: () => apiClient.get('/api/flatmates').then((response) => response.data as Flatmate[]),
  });

export const useEnsureFlatmate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post('/api/flatmates/enroll').then((response) => response.data as Flatmate),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['flatmates'] }),
        queryClient.invalidateQueries({ queryKey: ['balances'] }),
      ]);
    },
  });
};
