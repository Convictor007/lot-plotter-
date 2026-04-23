import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type ScreenSafeAreaProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Defaults to all edges; omit sides on web split layouts if needed. */
  edges?: readonly Edge[] | Edge[];
};

const DEFAULT_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * Standard safe-area wrapper for full screens (uses react-native-safe-area-context).
 * Prefer this over ad-hoc `useSafeAreaInsets` padding unless you need full-bleed backgrounds.
 */
export function ScreenSafeArea({
  children,
  style,
  edges = DEFAULT_EDGES,
}: ScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
