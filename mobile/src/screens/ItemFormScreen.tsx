import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Badge, EmptyState, ErrorState, ListItem, LoadingState, Screen, TextField } from '@/components/ui';
import { Radio } from '@/components/ui/kit';
import { AmountPad, CategoryChips, Eyebrow, Figure, TallyButton, TallyTopBar } from '@/components/pack';
import { useTheme } from '@/theme/ThemeProvider';
import { useFlatmates } from '@/hooks/useFlatmates';
import { useCreateItem } from '@/hooks/useItems';

const categories = ['Rent', 'Groceries', 'Bills'];

function amountInCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function displayedAmount(value: string): string {
  if (!value) return '₹0.00';
  const [whole, fraction] = value.split('.');
  return `₹${whole || '0'}.${(fraction ?? '').padEnd(2, '0')}`;
}

export default function ItemFormScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const { data: flatmates, isLoading, error: flatmatesError, refetch } = useFlatmates();
  const create = useCreateItem();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState('');
  const [description, setDescription] = useState('');
  const [amountError, setAmountError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [payerError, setPayerError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const submit = () => {
    if (create.isPending) return;
    const cents = amountInCents(amount);
    const selectedCategory = category.toLowerCase();
    const validCategory = ['rent', 'groceries', 'bills'].includes(selectedCategory);
    const validPayer = Boolean(flatmates?.some((flatmate) => flatmate.id === payerId));
    setAmountError(cents === null);
    setCategoryError(!validCategory);
    setPayerError(!validPayer);
    setSaveError(false);
    if (cents === null || !validCategory || !validPayer) return;

    create.mutate(
      { amount_cents: cents, category: selectedCategory, payer_id: payerId },
      {
        onSuccess: () => nav.goBack(),
        onError: () => setSaveError(true),
      },
    );
  };

  if (isLoading) return <Screen header={false}><LoadingState message="Loading flatmates…" /></Screen>;
  if (flatmatesError) return <Screen header={false}><ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen header={false}>
      <TallyTopBar eyebrow="FLATMATE EXPENSES" title="Add expense" onBack={() => nav.goBack()} />

      <View style={{ alignItems: 'center', marginTop: t.spacing.xl, marginBottom: t.spacing.xxl }}>
        <Eyebrow>AMOUNT</Eyebrow>
        <View style={{ marginTop: t.spacing.sm }}>
          <Figure value={displayedAmount(amount)} size="hero" ink="accent" />
        </View>
        {amountError ? <Badge label="Enter an amount greater than zero" tone="danger" /> : null}
      </View>

      <View>
        <View style={{ marginBottom: t.spacing.sm }}><Eyebrow>CATEGORY</Eyebrow></View>
        <CategoryChips
          options={categories}
          value={category}
          onChange={(next) => { setCategory(next); setCategoryError(false); }}
        />
        {categoryError ? <Badge label="Choose rent, groceries, or bills" tone="danger" /> : null}
      </View>

      <View style={{ marginTop: t.spacing.xl }}>
        <Eyebrow>PAID BY</Eyebrow>
        <View style={{ marginTop: t.spacing.sm }}>
          {flatmates?.length ? flatmates.map((flatmate) => (
            <ListItem
              key={flatmate.id}
              title={flatmate.email}
              onPress={() => { setPayerId(flatmate.id); setPayerError(false); }}
              trailing={
                <Radio
                  isSelected={payerId === flatmate.id}
                  onSelectedChange={() => { setPayerId(flatmate.id); setPayerError(false); }}
                />
              }
            />
          )) : <EmptyState title="No flatmates yet" hint="A flatmate must join before an expense can be saved." />}
        </View>
        {payerError ? <Badge label="Choose a flatmate who paid" tone="danger" /> : null}
      </View>

      <View style={{ marginTop: t.spacing.xl }}>
        <TextField
          label="DESCRIPTION"
          value={description}
          onChangeText={setDescription}
          placeholder="What was it for?"
        />
      </View>

      <View style={{ marginTop: t.spacing.xl }}>
        <AmountPad value={amount} onChange={(next) => { setAmount(next); setAmountError(false); }} />
      </View>

      <View style={{ marginTop: t.spacing.xl }}>
        {saveError ? <Badge label="Could not save. Please try again." tone="danger" /> : null}
        <TallyButton label={create.isPending ? 'Saving expense…' : 'Save expense'} icon="check" onPress={submit} />
      </View>
    </Screen>
  );
}
