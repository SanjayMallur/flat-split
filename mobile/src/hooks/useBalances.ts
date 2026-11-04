import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/config/api';

export type Balance = {
  flatmate_id: string;
  email: string;
  balance_cents: number;
  status: 'owed' | 'owed_to' | 'settled';
};

export const useBalances = () =>
  useQuery({
    queryKey: ['balances'],
    queryFn: () => apiClient.get('/api/balances').then((response) => response.data as Balance[]),
  });
