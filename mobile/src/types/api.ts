// AUTO-GENERATED from the backend contract (required_collections[].fields).
// Single source of truth for API resource shapes — do NOT hand-edit; RNDev imports
// these instead of re-typing responses. Regenerated from the contract every run.

export type Flatmate = {
  id: string;
  user_id: string;
  email: string;
  flat_key: string;
  created_at: string;
};
export type CreateFlatmateInput = Omit<Flatmate, 'id' | 'user_id' | 'email' | 'flat_key' | 'created_at'>;

export type Item = {
  id: string;
  amount_cents: number;
  category: string;
  payer_id: string;
  created_by: string;
  flat_key: string;
  created_at: string;
};
export type CreateItemInput = Omit<Item, 'id' | 'created_by' | 'flat_key' | 'created_at'>;
