// AUTO-GENERATED from the Architect's navigation_plan -- do NOT hand-edit.
// The registry is COMPILED, not written: which screens are tabs, what each tab means,
// and which tab's back stack a pushed screen belongs to are decisions in the plan.
// To change navigation, change the plan.

import React from 'react';
import type { IconName } from '@/components/ui/Icon';
import AccountScreen from '@/screens/AccountScreen';
import HomeScreen from '@/screens/HomeScreen';
import ItemFormScreen from '@/screens/ItemFormScreen';

// Params are generated from the SAME plan (mobile/src/types/navigation.ts) and
// re-exported here, because AppNavigator.tsx imports RootStackParamList from this
// file. A bare `import type` compiles and leaves the shell unable to find it.
export type { RootStackParamList } from '@/types/navigation';
import type { RootStackParamList } from '@/types/navigation';

export type StackRoute = {
  name: keyof RootStackParamList;
  component: React.ComponentType;
  title: string;
  /** `'modal'` presents it over everything instead of pushing it. */
  presentation?: 'modal';
};

/** A bottom-tab destination and the stack of screens pushed INSIDE it. */
export type TabRoute = {
  name: keyof RootStackParamList;
  component: React.ComponentType;
  icon: IconName;
  title: string;
  screens: StackRoute[];
};

export const tabs: TabRoute[] = [
  {
    name: 'Expenses',
    component: HomeScreen,
    icon: 'list',
    title: "Expenses",
    screens: [
      { name: 'ItemForm', component: ItemFormScreen, title: "Add Expense" },
    ],
  },
  {
    name: 'Account',
    component: AccountScreen,
    icon: 'user',
    title: "Account",
    screens: [],
  },
];

/** The ROOT stack, above the tab bar -- these hide it while open. Entries carrying
  * `presentation: 'modal'` are presented over everything instead of pushed. */
export const stackScreens: StackRoute[] = [];

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
