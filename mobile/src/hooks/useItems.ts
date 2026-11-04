import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/config/api';
import type { Item, CreateItemInput } from '@/types/api';

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => apiClient.get('/api/items').then((r) => r.data as Item[]),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) =>
      apiClient.post('/api/items', input).then((r) => r.data as Item),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['items'] }),
        qc.invalidateQueries({ queryKey: ['balances'] }),
      ]),
  });
}
