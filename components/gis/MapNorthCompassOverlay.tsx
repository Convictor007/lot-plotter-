import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

/** Top inset from map edge (2× previous 10px). */
export const MAP_COMPASS_CONTROL_TOP = 20;

/** Google Maps compass red (north). */
const COMPASS_RED = '#EA4335';

type Props = {
  /**
   * Map rotation clockwise from north (degrees).
   * Google Maps: `map.getHeading()`. ArcGIS MapView: `view.rotation`.
   */
  bearingDeg: number;
  /** Tap to reset map rotation to north (Google `setHeading(0)`, ArcGIS `rotation = 0`). */
  onResetNorth?: () => void;
};

/**
 * Google Maps–style compass: circular translucent control, red (north) / white (south) needle.
 * PDF export still uses static art in `lot-pdf-map`.
 */
export function MapNorthCompassOverlay({ bearingDeg, onResetNorth }: Props) {
  const h = Number.isFinite(bearingDeg) ? bearingDeg : 0;
  return (
    <Pressable
      onPress={() => onResetNorth?.()}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityRole="button"
      accessibilityLabel="Compass. Tap to face north."
      accessibilityHint="Resets map rotation so north is up."
    >
      <View style={[styles.needle, { transform: [{ rotate: `${-h}deg` }] }]}>
        <View style={styles.needleNorth} />
        <View style={styles.needleSouth} />
      </View>
    </Pressable>
  );
}

const FAB = 50;
const HALF_W = 6.5;

const styles = StyleSheet.create({
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: 'rgba(48, 48, 48, 0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  fabPressed: {
    backgroundColor: 'rgba(38, 38, 38, 0.88)',
    opacity: 0.92,
  },
  needle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Triangle pointing up — north */
  needleNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: HALF_W,
    borderRightWidth: HALF_W,
    borderBottomWidth: 17,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COMPASS_RED,
  },
  /** Triangle pointing down — south */
  needleSouth: {
    width: 0,
    height: 0,
    marginTop: -1.5,
    borderLeftWidth: HALF_W,
    borderRightWidth: HALF_W,
    borderTopWidth: 17,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});
