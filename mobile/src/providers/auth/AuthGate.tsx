import React from 'react';
import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth/AuthProvider';
import { AuthGateScreen } from '@/screens/AuthGateScreen';

/**
 * FROZEN capability module — auth-gate. A hard sign-in wall: until somebody is authenticated,
 * this renders the sign-in screen INSTEAD of the app, so no generated screen can ever be
 * reached by an anonymous user.
 *
 * Registered by the TemplateMutationCompiler INSIDE `AuthProvider` (auth-roles is earlier in
 * the registry, and the compiler nests providers in registration order), which is required
 * rather than incidental: this component calls `useAuth`, and `useAuth` throws outside its
 * provider. `test_the_gate_is_nested_inside_the_auth_provider` pins the ordering.
 *
 * A separate module from auth-roles rather than a second provider on it, because a module's
 * seam detection is all-or-nothing: adding a second ProviderRegistration to auth-roles would
 * make every EXISTING workspace fail both the content and the seam check at once, and stop
 * being upgradeable at all. See `docs/` and the module docstring in template_mutation_compiler.
 *
 * Selecting this is a product decision the Architect makes — an app whose content is public
 * until you act on it (browse listings, read recipes) wants auth-roles WITHOUT this.
 *
 * WHILE THE STORED SESSION IS BEING RESTORED THIS SHOWS NEITHER. `isAuthenticated` is false
 * until the keystore read and the `GET /api/auth/me` that validates it have both come back —
 * a network round trip, not a frame, and longer still on a hosted backend that cold-starts.
 * Rendering the wall through that window puts a sign-in form in front of someone who IS signed
 * in and invites them to type a password they do not need. Worse, typing it there used to race
 * the in-flight restore.
 *
 * `isRestoring` is read DEFENSIVELY rather than destructured, because auth-roles ships it on a
 * different branch of this lane: a hard reference does not type-check against a workspace whose
 * AuthProvider predates it, and this file is frozen, so a generated app could not patch around
 * that. Absent, this behaves exactly as it did before — the flag can only ever suppress the
 * wall, never show one.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const isRestoring = (auth as { isRestoring?: boolean }).isRestoring === true;

  if (isRestoring) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!auth.isAuthenticated) {
    return <AuthGateScreen />;
  }
  return <>{children}</>;
}
