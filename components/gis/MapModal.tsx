/** iAssess - GIS Map Modal. Boundary = municipality; boundaryGeoJson = barangays. */

import { Ionicons } from '@expo/vector-icons';
import React, { useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import MapView from '@/components/gis/MapView';
import ArcGISCompareMap from '@/components/gis/ArcGISCompareMap';

export type MapModalHandle = {
  /** PNG data URI of the map area (labels, polygon, compass), for PDF embed. */
  captureForPdf: () => Promise<string | null>;
};

const COLORS = {
  accent: '#3b5998',
  text: '#ffffff',
  background: '#2c2c2c',
  boundary: '#2563eb',
};

const POLYGON_COLORS = [
  '#3b5998',
  '#2563eb',
  '#16a34a',
  '#facc15', // yellow
  '#ef4444', // red
  '#d97706',
  '#9333ea',
  '#dc2626',
  '#0d9488',
  '#ca8a04',
  '#4f46e5',
  '#db2777',
];

type BoundaryCoords = [number, number][];
type BarangaysGeoJson = any;

function loadBalatanBoundary(): BoundaryCoords | null {
  try {
    const geojson = require('../../assets/balatanPolygon.geojson') as {
      type: string;
      features: Array<{ geometry: { type: string; coordinates: number[][][] } }>;
    };
    if (geojson?.features?.[0]?.geometry?.coordinates?.[0]) {
      return geojson.features[0].geometry.coordinates[0] as BoundaryCoords;
    }
  } catch {
    // ignore
  }
  return null;
}

function loadBalatanBarangays(): BarangaysGeoJson {
  try {
    const raw = require('../../assets/balatanBarangays.geojson');
    if (raw?.type === 'FeatureCollection' && Array.isArray(raw.features)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

const balatanBoundary = loadBalatanBoundary();
const balatanBarangaysGeoJson = loadBalatanBarangays();

interface MapModalProps {
  visible: boolean;
  onClose: () => void;
  center: { lat: number; lng: number };
  zoom?: number;
  polygon?: {
    coordinates: [number, number][];
    color?: string;
    fillColor?: string;
  } | null;
  area?: number;
  showAreaLabel?: boolean;
  showMapControls?: boolean;
  /** When true, show header action to export PDF using a live map screenshot. */
  exportPdfEnabled?: boolean;
  onExportPdfFromMap?: () => void | Promise<void>;
}

const MapModal = forwardRef<MapModalHandle, MapModalProps>(function MapModal(
  {
    visible,
    onClose,
    center,
    zoom = 17,
    polygon,
    area,
    showAreaLabel = true,
    showMapControls = true,
    exportPdfEnabled = false,
    onExportPdfFromMap,
  },
  ref
) {
  const mapCaptureRef = useRef<View>(null);

  useImperativeHandle(
    ref,
    () => ({
      async captureForPdf(): Promise<string | null> {
        if (!mapCaptureRef.current) return null;
        try {
          await new Promise((r) => setTimeout(r, 400));
          const uri = await captureRef(mapCaptureRef, {
            format: 'png',
            quality: 0.92,
            result: 'data-uri',
            snapshotContentContainer: false,
          });
          return typeof uri === 'string' && uri.startsWith('data:image') ? uri : null;
        } catch {
          return null;
        }
      },
    }),
    []
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showArea, setShowArea] = useState(showAreaLabel);
  const [showDistance, setShowDistance] = useState(true);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [polyColor, setPolyColor] = useState(polygon?.color || COLORS.accent);

  const latestCenterRef = React.useRef(center);
  const latestZoomRef = React.useRef(zoom);

  React.useEffect(() => {
    if (visible) {
      latestCenterRef.current = center;
      latestZoomRef.current = zoom;
    }
  }, [visible, center, zoom]);

  const handleRegionChange = (c: { lat: number; lng: number }, z: number) => {
    latestCenterRef.current = c;
    latestZoomRef.current = z;
  };

  // Update polyColor if polygon.color changes from props
  React.useEffect(() => {
    if (polygon?.color) {
      setPolyColor(polygon.color);
    }
  }, [polygon?.color]);

  const mapPolygon = polygon
    ? {
        coordinates: polygon.coordinates,
        color: polyColor,
        fillColor: polyColor,
      }
    : null;

  const mapBoundary = balatanBoundary
    ? {
        coordinates: balatanBoundary,
        color: COLORS.boundary,
        fillColor: COLORS.boundary,
      }
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'web' ? 'overFullScreen' : 'fullScreen'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={styles.iconBtn}>
              <Ionicons name="menu" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Lot Plot - GIS Map</Text>
            
            <TouchableOpacity onPress={() => setIsCompareMode(!isCompareMode)} style={styles.historicalBtn}>
              <Ionicons name={isCompareMode ? "map" : "swap-horizontal"} size={16} color={COLORS.text} style={{ marginRight: 6 }} />
              <Text style={styles.historicalBtnText}>{isCompareMode ? 'View Normal Map' : 'Historical Compare'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            {exportPdfEnabled && onExportPdfFromMap ? (
              <TouchableOpacity
                style={styles.exportPdfBtn}
                onPress={() => void Promise.resolve(onExportPdfFromMap())}
                accessibilityRole="button"
                accessibilityLabel="Export PDF with map screenshot"
              >
                <Ionicons name="document-text-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {showSettings && (
          <View style={styles.settingsDropdown}>
            <Text style={styles.settingsTitle}>Map Settings</Text>
            
            <TouchableOpacity style={styles.settingRow} onPress={() => setShowArea(!showArea)}>
              <Ionicons name={showArea ? "checkbox" : "square-outline"} size={20} color={COLORS.accent} />
              <Text style={styles.settingText}>Display Area Label (sqm)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => setShowDistance(!showDistance)}>
              <Ionicons name={showDistance ? "checkbox" : "square-outline"} size={20} color={COLORS.accent} />
              <Text style={styles.settingText}>Display Distance Labels</Text>
            </TouchableOpacity>

            <Text style={styles.settingSubtitle}>Polygon color</Text>
            <Text style={styles.settingHint}>Stroke and area label use this color.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
              <View style={styles.colorRow}>
                {POLYGON_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    accessibilityRole="button"
                    accessibilityLabel={`Polygon color ${c}`}
                    style={[
                      styles.colorBox,
                      { backgroundColor: c },
                      polyColor.toLowerCase() === c.toLowerCase() && styles.colorBoxSelected,
                    ]}
                    onPress={() => {
                      setPolyColor(c);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.mapWrapper}>
          <View ref={mapCaptureRef} style={styles.mapCaptureShell} collapsable={false}>
            {isCompareMode ? (
              <ArcGISCompareMap
                center={latestCenterRef.current}
                zoom={latestZoomRef.current}
                polygon={mapPolygon}
                showAreaLabel={showArea}
                showDistanceLabel={showDistance}
                area={area}
                onRegionChange={handleRegionChange}
              />
            ) : (
              <MapView
                center={latestCenterRef.current}
                zoom={latestZoomRef.current}
                polygon={mapPolygon}
                boundary={mapBoundary}
                boundaryGeoJson={balatanBarangaysGeoJson}
                style={styles.map}
                showControls={showMapControls}
                area={area}
                showAreaLabel={showArea}
                showDistanceLabel={showDistance}
                onRegionChange={handleRegionChange}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default MapModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingTop: Platform.OS === 'ios' ? 40 : 6,
    height: Platform.OS === 'ios' ? 70 : 40,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
    marginRight: 16,
  },
  historicalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  historicalBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exportPdfBtn: {
    padding: 6,
    marginRight: 4,
  },
  closeBtn: {
    padding: 4,
  },
  mapCaptureShell: {
    flex: 1,
    width: '100%',
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 40,
    left: 12,
    width: 280,
    backgroundColor: '#ffffff',
    padding: 16,
    zIndex: 9999,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  settingSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  colorScroll: {
    maxHeight: 52,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  colorBox: {
    width: 40,
    height: 30,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorBoxSelected: {
    borderColor: '#1f2937',
    transform: [{ scale: 1.08 }],
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    padding: 8,
  },
  map: {
    flex: 1,
    width: '100%',
    minHeight: 300,
  },
});
