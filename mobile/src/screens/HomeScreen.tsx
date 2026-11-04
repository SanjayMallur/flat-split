import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { Display, Eyebrow, Figure, IconButton, LedgerRow, TallyButton, TallyTopBar } from '@/components/pack';
import { useTheme } from '@/theme/ThemeProvider';
import { useItems } from '@/hooks/useItems';
import { useFlatmates, useEnsureFlatmate } from '@/hooks/useFlatmates';
import { useBalances } from '@/hooks/useBalances';
import type { Flatmate } from '@/types/api';
import type { RootStackParamList } from '@/types/navigation';

type BalanceFields = {
  flatmate_id?: string;
  email?: string;
  balance_cents?: number;
  net_cents?: number;
  amount_cents?: number;
  status?: string;
};

function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local.replace(/\b\w/g, (letter) => letter.toUpperCase()) || email;
}

function money(cents: number, signed = false): string {
  const amount = Math.abs(cents) / 100;
  const value = amount.toLocaleString('en-IN', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${signed ? (cents > 0 ? '+' : cents < 0 ? '−' : '') : ''}₹${value}`;
}

function balanceFor(flatmate: Flatmate, balances: BalanceFields[]): number {
  const entry = balances.find((balance) =>
    balance.flatmate_id === flatmate.id || balance.email === flatmate.email,
  );
  return entry?.balance_cents ?? entry?.net_cents ?? entry?.amount_cents ?? 0;
}

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useTheme();
  const enrollmentStarted = React.useRef(false);
  const [enrollmentReady, setEnrollmentReady] = React.useState(false);
  const enrollment = useEnsureFlatmate();
  const {
    data: flatmates,
    isLoading: flatmatesLoading,
    error: flatmatesError,
    refetch: refetchFlatmates,
  } = useFlatmates();
  const {
    data: expenses,
    isLoading: expensesLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useItems();
  const {
    data: balanceData,
    isLoading: balancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useBalances();

  React.useEffect(() => {
    if (enrollmentStarted.current) return;
    enrollmentStarted.current = true;
    void enrollment.mutateAsync().then(async () => {
      await Promise.all([refetchFlatmates(), refetchExpenses(), refetchBalances()]);
      setEnrollmentReady(true);
    }).catch(() => setEnrollmentReady(true));
  }, [enrollment.mutateAsync, refetchFlatmates, refetchExpenses, refetchBalances]);

  const retry = () => {
    if (enrollment.error) {
      void enrollment.mutateAsync().then(async () => {
        await Promise.all([refetchFlatmates(), refetchExpenses(), refetchBalances()]);
      }).catch(() => {});
      return;
    }
    void Promise.all([refetchFlatmates(), refetchExpenses(), refetchBalances()]);
  };

  if (!enrollmentReady || flatmatesLoading || expensesLoading || balancesLoading) {
    return <LoadingState message="Opening the shared flat…" />;
  }
  if (enrollment.error || flatmatesError || expensesError || balancesError) {
    return <ErrorState message="Couldn't load the shared expenses." onRetry={retry} />;
  }

  const roster = flatmates ?? [];
  const records = expenses ?? [];
  const balances = (balanceData ?? []) as BalanceFields[];
  const payerNames = new Map(roster.map((person) => [person.id, nameFromEmail(person.email)]));
  const openForm = () => navigation.navigate('ItemForm');

  return (
    <Screen header={false}>
      <TallyTopBar
        eyebrow="SHARED FLAT"
        title="Flatmate Expenses"
        right={<IconButton icon="plus" label="Add expense" onPress={openForm} size={44} />}
      />

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.palette.border }}>
        <Display size={22}>Balances</Display>
        <Eyebrow>NET OWED</Eyebrow>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', flexGrow: 1, borderBottomWidth: 1, borderBottomColor: t.palette.border }}>
          {roster.map((person, index) => {
            const cents = records.length === 0 ? 0 : balanceFor(person, balances);
            return (
              <View key={person.id} style={{ flexGrow: 1, minWidth: 108, paddingVertical: 12, paddingLeft: index === 0 ? 0 : 12, paddingRight: 12, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: t.palette.border }}>
                <Eyebrow>{nameFromEmail(person.email).toUpperCase()}</Eyebrow>
                <View style={{ marginTop: 4 }}>
                  <Figure value={money(cents, true)} size="lg" ink={cents < 0 ? 'accent' : 'text'} />
                </View>
                <Text style={[t.typography.caption, { color: t.palette.textMuted, marginTop: 2 }]}>
                  {cents > 0 ? 'Owes' : cents < 0 ? 'Gets back' : 'Settled'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.palette.border }}>
        <Display size={22}>Expenses</Display>
        <Eyebrow>{`${records.length} ${records.length === 1 ? 'RECORD' : 'RECORDS'}`}</Eyebrow>
      </View>
      {records.length === 0 ? (
        <View style={{ minHeight: 190 }}>
          <EmptyState title="No expenses yet" hint="Add the first shared expense to start tracking balances." />
        </View>
      ) : (
        <View>
          {records.map((expense, index) => {
            const payer = payerNames.get(expense.payer_id) ?? 'a flatmate';
            const category = expense.category.charAt(0).toUpperCase() + expense.category.slice(1);
            return (
              <LedgerRow
                key={expense.id}
                letter={payer.charAt(0).toUpperCase()}
                name={category}
                meta={`Paid by ${payer}`}
                amount={money(expense.amount_cents)}
                last={index === records.length - 1}
              />
            );
          })}
        </View>
      )}
      <View style={{ marginTop: 20 }}>
        <TallyButton label="Add Expense" onPress={openForm} />
      </View>
    </Screen>
  );
}
