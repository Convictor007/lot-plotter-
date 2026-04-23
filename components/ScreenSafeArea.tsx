import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type ScreenSafeAreaProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Defaults to all edges; omit sides on web split layouts if needed. */
  edges?: readonly Edge[] | Edge[];
};

/** Default edges for full-screen shells (requires `SafeAreaProvider` in `app/_layout.tsx`). */
export const DEFAULT_SCREEN_SAFE_AREA_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * Standard safe-area wrapper for full screens (`react-native-safe-area-context`’s `SafeAreaView`).
 *
 * - Root `app/_layout.tsx` must wrap the tree in `SafeAreaProvider` (already done).
 * - Prefer this for route **layouts** (`(auth)`, `(main)`). Tab/section screens sit inside and should
 *   not nest another full `ScreenSafeArea` unless they are true full-screen modals.
 * - For **React Native `Modal`**, avoid nesting this inside the modal; use `useSafeAreaInsets()` on a
 *   plain `View` overlay so insets match the window (see main `(main)/_layout` logout dialog).
 * - For edge-to-edge UI (maps, image pickers), use `useSafeAreaInsets()` and pad only the chrome you need.
 */
export function ScreenSafeArea({
  children,
  style,
  edges = DEFAULT_SCREEN_SAFE_AREA_EDGES,
}: ScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
