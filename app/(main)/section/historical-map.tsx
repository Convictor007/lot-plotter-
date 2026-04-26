import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ArcGISCompareMap from '@/components/gis/ArcGISCompareMap';

import { useTheme } from '@/contexts/ThemeContext';

// Default center for Balatan, Camarines Sur
const DEFAULT_CENTER = { lat: 13.3155, lng: 123.2328 };

export default function HistoricalMapScreen() {
  const { width } = useWindowDimensions();
  const isWeb = width > 768;
  const { colors } = useTheme();

  // Keep initial map position stable to avoid reloading map container on every pan/zoom.
  // ArcGISCompareMap handles navigation internally.
  const initialCenter = DEFAULT_CENTER;
  const initialZoom = 16;
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
      <View style={styles.content}>
        {/* Map Container */}
        <View style={styles.mapContainer}>
          <ArcGISCompareMap 
            center={initialCenter}
            zoom={initialZoom}
            showAreaLabel={false}
            showDistanceLabel={false}
          />
        </View>

        {/* Info Panel / Controls */}
        <View style={[
          styles.infoPanel, 
          { backgroundColor: colors.cardBg, borderTopColor: colors.border },
          isWeb && [styles.infoPanelWeb, { borderLeftColor: colors.border }],
          !isPanelExpanded && (isWeb ? styles.infoPanelWebCollapsed : styles.infoPanelMobileCollapsed)
        ]}>
          {/* Collapse/Expand Toggle Button */}
          <TouchableOpacity 
            style={[styles.toggleBtn, isWeb ? styles.toggleBtnWeb : styles.toggleBtnMobile]} 
            onPress={() => setIsPanelExpanded(!isPanelExpanded)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={isPanelExpanded 
                ? (isWeb ? "chevron-forward" : "chevron-down") 
                : (isWeb ? "chevron-back" : "chevron-up")} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>

          {isPanelExpanded && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle" size={24} color="#3b5998" />
                <Text style={[styles.infoTitle, { color: colors.text }]}>How to use</Text>
              </View>
              
              <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  <Text style={[styles.boldText, { color: colors.text }]}>1. Swipe to Compare</Text>{'\n'}
                  Drag the vertical slider in the middle of the map left and right. This allows you to visually compare historical satellite imagery of the same location.
                </Text>
                
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  <Text style={[styles.boldText, { color: colors.text }]}>2. Change the Years</Text>{'\n'}
                  Use the <Text style={[styles.boldText, { color: colors.text }]}>Left Selection</Text> and <Text style={[styles.boldText, { color: colors.text }]}>Right Selection</Text> menus on the map to change the specific years being compared (from 2014 up to 2025).
                </Text>

                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  <Text style={[styles.boldText, { color: colors.text }]}>3. Navigate the Map</Text>{'\n'}
                  Pan (drag) and zoom (scroll or pinch) to explore different areas of the municipality. The map will automatically load the high-resolution imagery for the selected years.
                </Text>

                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  <Text style={[styles.boldText, { color: colors.text }]}>4. Reference Labels</Text>{'\n'}
                  You can toggle the "Reference label overlay" button at the top right of the map to show or hide road names and landmarks to help you navigate.
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: -20, // Negative margin to counteract the 20px padding from the main layout
    overflow: 'visible',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'visible',
  },
  mapContainer: {
    flex: 1,
    minHeight: 400, // Ensure it has height on mobile
    zIndex: 0,
  },
  infoPanel: {
    borderTopWidth: 1,
    padding: 16,
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  /** `height: 0` clipped the absolutely positioned chevron on Android; keep a minimal box + overflow visible. */
  infoPanelMobileCollapsed: {
    padding: 0,
    borderTopWidth: 0,
    minHeight: 8,
    overflow: 'visible',
  },
  infoPanelWeb: {
    borderTopWidth: 0,
    borderLeftWidth: 1,
    width: 350,
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 5,
    transition: 'transform 0.3s ease-in-out', // Smooth slide for web
  },
  infoPanelWebCollapsed: {
    transform: [{ translateX: 350 }], // Slide off-screen to the right
  },
  toggleBtn: {
    position: 'absolute',
    backgroundColor: '#3b5998', // Keep primary color
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 24,
  },
  toggleBtnWeb: {
    left: -28, // Stick out to the left of the panel
    top: 20,
    width: 28,
    height: 48,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleBtnMobile: {
    top: -28, // Stick out to the top of the panel
    right: 20,
    width: 48,
    height: 28,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  infoCard: {
    flex: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  infoScroll: {
    flex: 1,
    marginTop: 8,
  },
});