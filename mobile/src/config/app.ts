/**
 * FROZEN. The app's display name, shown in the top app bar (see `AppHeader`).
 *
 * The pipeline patches `APP_NAME` to the real product name at scaffold time
 * (WorkspaceAdapter.apply_app_name), the same generate-once-import-everywhere
 * pattern as the accent. RNDev/screens NEVER edit this — import it, don't retype it.
 */
export const APP_NAME = "Flat Split";

/**
 * FROZEN. Use the PLATFORM's own navigation header on PUSHED screens, while top-level
 * (tab) screens keep the kit's `AppHeader`.
 *
 * The split is the point, and each half is where that header actually wins:
 *
 *   pushed screen  -> the platform header. Real back with the swipe/predictive gesture, the
 *                     title placed by platform convention (left beside the chevron on
 *                     Android, centred on iOS), the header cross-fade between screens, and
 *                     on iOS the back control carrying the previous screen's name.
 *   top-level tab  -> `AppHeader`. Keeps the 28px app-name/title presence, which the
 *                     platform header replaces with a ~17-20px toolbar title on Android.
 *
 * Two runs decided this rather than taste. On the S23 (2026-09-11) the large title did NOT
 * collapse, because `headerLargeTitleEnabled` is `@platform ios` — so the collapsing title
 * the platform header was wanted for does not exist on the device this generator is aimed
 * at. Then reading Rork's exported apps (2026-09-12, 7 repos of 1,862) found they made the
 * same split: a hand-drawn `View` header with `paddingTop: insets.top` on top-level screens,
 * and `<Stack screenOptions={{ headerBackTitle: "Back" }}>` for pushed ones.
 *
 * Owner call 2026-09-12 (D12 c). Flag-gated so the whole thing reverts in one edit.
 */
export const NATIVE_HEADER = true;
