/**
 * iAssess - GIS Map View.
 * Credentials: GOOGLE_MAPS_API_KEY via .env → app.config.js → Constants.expoConfig.extra.
 * Web + Native: Google Maps JavaScript API (native rendered via WebView).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import gisUtils from '@/utils/gis-utils';
import { MapNorthCompassOverlay, MAP_COMPASS_CONTROL_TOP } from '@/components/gis/MapNorthCompassOverlay';

declare namespace GeoJSON {
  interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }
  interface Feature {
    type: 'Feature';
    geometry: Polygon | MultiPolygon;
    properties?: Record<string, unknown>;
  }
  interface Polygon {
    type: 'Polygon';
    coordinates: number[][][];
  }
  interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  }
}

type ExpoMapExtra = {
  googleMapsApiKey?: string;
};

const extra = Constants.expoConfig?.extra as ExpoMapExtra | undefined;

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || extra?.googleMapsApiKey || '';

const isWeb = Platform.OS === 'web';

export type MapProvider = 'google';
export type BasemapStyle = 'satellite' | 'hybrid' | 'street' | 'terrain' | 'dark' | 'light';

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  polygon?: {
    coordinates: [number, number][];
    color?: string;
    fillColor?: string;
  } | null;
  /** Optional boundary polygon (e.g. municipality) to show on the map */
  boundary?: {
    coordinates: [number, number][];
    color?: string;
    fillColor?: string;
  } | null;
  /** Optional GeoJSON FeatureCollection (e.g. barangays) to show as a layer */
  boundaryGeoJson?: GeoJSON.FeatureCollection | null;
  markers?: Array<{ id: string; lat: number; lng: number; title?: string }>;
  style?: any;
  provider?: MapProvider;
  basemap?: BasemapStyle;
  onProviderChange?: (provider: MapProvider) => void;
  onBasemapChange?: (basemap: BasemapStyle) => void;
  showControls?: boolean;
  showAreaLabel?: boolean;
  showDistanceLabel?: boolean;
  /** Lot area in m² (from traverse); used for the center label when provided */
  area?: number;
  /**
   * Increment (e.g. from parent state) to command the map to fit bounds to the lot polygon again.
   * Changing basemap does not auto-fit; use this or the in-map "fit polygon" control.
   */
  fitPolygonTrigger?: number;
  /**
   * Composite `${parentFitPolygonTrigger}|${uiBump}` — set by MapViewWithControls; drives fit when changed.
   */
  fitPolygonToken?: string;
  onRegionChange?: (center: { lat: number; lng: number }, zoom: number) => void;
}

function polygonCoordsKey(polygon: MapViewProps['polygon']): string {
  return JSON.stringify(polygon?.coordinates ?? null);
}

function googleMapTypeIdForBasemap(b: BasemapStyle): string {
  switch (b) {
    case 'satellite':
      return 'SATELLITE';
    case 'hybrid':
      return 'HYBRID';
    case 'street':
      return 'ROADMAP';
    case 'terrain':
      return 'TERRAIN';
    case 'dark':
    case 'light':
    default:
      return 'ROADMAP';
  }
}

/** Order used when cycling basemap with the minimap control. */
const BASEMAP_LAYER_SEQUENCE: BasemapStyle[] = [
  'satellite',
  'hybrid',
  'street',
  'terrain',
  'dark',
  'light',
];

function nextBasemapInSequence(current: BasemapStyle): BasemapStyle {
  const i = BASEMAP_LAYER_SEQUENCE.indexOf(current);
  const idx = i >= 0 ? i : 0;
  return BASEMAP_LAYER_SEQUENCE[(idx + 1) % BASEMAP_LAYER_SEQUENCE.length];
}

const PREVIEW_ZOOM = 11;
const PREVIEW_W = 160;
const PREVIEW_H = 100;

/** Minimap thumbnail from Google Static Maps API. */
function buildBasemapPreviewUri(
  basemap: BasemapStyle,
  center: { lat: number; lng: number }
): string {
  const { lat, lng } = center;
  const z = PREVIEW_ZOOM;

  if (GOOGLE_MAPS_API_KEY) {
    const maptype =
      basemap === 'satellite'
        ? 'satellite'
        : basemap === 'hybrid'
          ? 'hybrid'
          : basemap === 'terrain'
            ? 'terrain'
            : 'roadmap';
    const key = encodeURIComponent(GOOGLE_MAPS_API_KEY);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=${PREVIEW_W}x${PREVIEW_H}&scale=2&maptype=${maptype}&key=${key}`;
  }

  return '';
}

// Haversine distance calculation (meters)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate polygon centroid
function calculateCentroid(coordinates: [number, number][]): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;
  const n = coordinates.length - 1; // Exclude closing point
  for (let i = 0; i < n; i++) {
    sumLat += coordinates[i][1];
    sumLng += coordinates[i][0];
  }
  return { lat: sumLat / n, lng: sumLng / n };
}

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScriptOnce(apiKey: string): Promise<void> {
  if (!isWeb || typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { google?: { maps?: { Map?: unknown } } };
  if (w.google?.maps?.Map) return Promise.resolve();
  if (googleMapsScriptPromise) return googleMapsScriptPromise;
  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-iassess-gmaps="1"]');
    if (existing) {
      const check = () => {
        if ((window as unknown as { google?: { maps?: { Map?: unknown } } }).google?.maps?.Map) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      existing.addEventListener('load', check);
      existing.addEventListener('error', () => reject(new Error('Google Maps load failed')));
      check();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.iassessGmaps = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed'));
    document.head.appendChild(script);
  });
  return googleMapsScriptPromise;
}

function WebMapViewGoogle({
  center,
  zoom = 16,
  polygon,
  boundary,
  boundaryGeoJson,
  markers,
  style,
  basemap = 'satellite',
  fitPolygonToken = '0|0',
  area,
  showAreaLabel = true,
  showDistanceLabel = true,
  onRegionChange,
}: MapViewProps) {
  const [mapHeading, setMapHeading] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;
  /** Map structure: boundary, lot polygon, user markers — not label overlays */
  const structureOverlayRefs = useRef<Array<{ setMap: (m: unknown) => void }>>([]);
  const labelOverlayRefs = useRef<Array<{ setMap: (m: unknown) => void }>>([]);
  const lastFitIdRef = useRef<string | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const lotPolygonRef = useRef<any>(null);

  /** Only when coordinates change — avoids full map reset when color / label toggles change */
  const polyCoordsKey = useMemo(() => polygonCoordsKey(polygon), [polygon?.coordinates]);

  const [mapNonce, setMapNonce] = useState(0);

  function clearLabelOverlays() {
    labelOverlayRefs.current.forEach((o) => {
      try {
        o.setMap(null);
      } catch (_) {}
    });
    labelOverlayRefs.current = [];
  }

  /** Create / rebuild map when geometry or fit token changes — not when only labels or stroke color change */
  useEffect(() => {
    if (!isWeb || !mapContainerRef.current || !GOOGLE_MAPS_API_KEY) return;

    const run = async () => {
      try {
        await loadGoogleMapsScriptOnce(GOOGLE_MAPS_API_KEY);
        const g = (window as unknown as { google: { maps: any } }).google.maps;
        if (!g || !mapContainerRef.current) return;

        clearLabelOverlays();
        lotPolygonRef.current = null;

        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = '';
        }
        structureOverlayRefs.current = [];

        const mapTypeKey = googleMapTypeIdForBasemap(basemap);
        const mapTypeId = g.MapTypeId[mapTypeKey] ?? g.MapTypeId.ROADMAP;

        const map = new g.Map(mapContainerRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          mapTypeId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapInstanceRef.current = map;

        if (boundary && boundary.coordinates.length > 0) {
          const paths = boundary.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
          const poly = new g.Polygon({
            paths,
            strokeColor: boundary.color || '#2563eb',
            fillColor: boundary.fillColor || '#2563eb',
            fillOpacity: 0.08,
            strokeWeight: 2,
            map,
          });
          structureOverlayRefs.current.push(poly);
        }

        if (boundaryGeoJson && boundaryGeoJson.features?.length > 0) {
          map.data.addGeoJson(boundaryGeoJson as object);
          map.data.setStyle({
            fillColor: '#15803d',
            fillOpacity: 0.12,
            strokeColor: '#15803d',
            strokeWeight: 1.5,
          });
        }

        if (polygon && polygon.coordinates.length > 0) {
          const paths = polygon.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
          const poly = new g.Polygon({
            paths,
            strokeColor: polygon.color || '#8e1616',
            fillColor: polygon.fillColor || '#8e1616',
            fillOpacity: 0,
            strokeWeight: 2,
            map,
          });
          structureOverlayRefs.current.push(poly);
          lotPolygonRef.current = poly;

          const bounds = new g.LatLngBounds();
          polygon.coordinates.forEach((c) => bounds.extend({ lat: c[1], lng: c[0] }));
          const fitId = `${polyCoordsKey}|${fitPolygonToken}`;
          if (lastFitIdRef.current !== fitId) {
            map.fitBounds(bounds, 50);
            lastFitIdRef.current = fitId;
          }
        } else {
          const bounds = new g.LatLngBounds();
          if (boundary?.coordinates?.length) {
            boundary.coordinates.forEach((c) => bounds.extend({ lat: c[1], lng: c[0] }));
          }
          map.data.forEach((feature: { getGeometry: () => { forEachLatLng?: (fn: (ll: { lat: () => number; lng: () => number }) => void) => void } }) => {
            const geom = feature.getGeometry();
            if (geom?.forEachLatLng) {
              geom.forEachLatLng((ll) => bounds.extend(ll));
            }
          });
          const bFitId = `boundary|${JSON.stringify(boundary?.coordinates)}|${boundaryGeoJson?.features?.length ?? 0}|${fitPolygonToken}`;
          if (!bounds.isEmpty()) {
            if (lastFitIdRef.current !== bFitId) {
              try {
                map.fitBounds(bounds, 60);
                lastFitIdRef.current = bFitId;
              } catch (_) {}
            }
          }
        }

        if (markers) {
          markers.forEach((m) => {
            const mk = new g.Marker({
              position: { lat: m.lat, lng: m.lng },
              map,
              title: m.title || 'Marker',
            });
            structureOverlayRefs.current.push(mk);
          });
        }

        const pushRegion = () => {
          if (!mapInstanceRef.current) return;
          const m = mapInstanceRef.current;
          const c = m.getCenter();
          const hd = typeof m.getHeading === 'function' ? m.getHeading() : 0;
          const h = typeof hd === 'number' && !isNaN(hd) ? hd : 0;
          setMapHeading(h);
          onRegionChangeRef.current?.({ lat: c.lat(), lng: c.lng() }, m.getZoom());
        };
        map.addListener('idle', pushRegion);
        map.addListener('heading_changed', pushRegion);

        setMapNonce((n) => n + 1);
      } catch (err) {
        console.error('Google Maps load error:', err);
      }
    };

    run();
    return () => {
      clearLabelOverlays();
      structureOverlayRefs.current.forEach((o) => {
        try {
          o.setMap(null);
        } catch (_) {}
      });
      structureOverlayRefs.current = [];
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
      }
      mapInstanceRef.current = null;
      lotPolygonRef.current = null;
    };
    // basemap is applied via setMapTypeId in a separate effect — do not list basemap here or the map resets when switching layers
  }, [center.lat, center.lng, zoom, polyCoordsKey, boundary, boundaryGeoJson, markers, fitPolygonToken]);

  /** Labels + lot stroke/fill — does not recreate the map or call fitBounds (no “jump”) */
  useEffect(() => {
    if (!isWeb || !mapInstanceRef.current || !polygon?.coordinates?.length) {
      clearLabelOverlays();
      return;
    }

    const g = (window as unknown as { google: { maps: any } }).google.maps;
    const map = mapInstanceRef.current;

    clearLabelOverlays();

    if (lotPolygonRef.current) {
      lotPolygonRef.current.setOptions({
        strokeColor: polygon.color || '#8e1616',
        fillColor: polygon.fillColor || '#8e1616',
      });
    }

    if (showDistanceLabel) {
      for (let i = 0; i < polygon.coordinates.length - 1; i++) {
        const p1 = polygon.coordinates[i];
        const p2 = polygon.coordinates[i + 1];
        const dist = calculateDistance(p1[1], p1[0], p2[1], p2[0]);
        const midLat = (p1[1] + p2[1]) / 2;
        const midLng = (p1[0] + p2[0]) / 2;
        const nextCorner = i + 2 === polygon.coordinates.length ? 1 : i + 2;
        const m = new g.Marker({
          position: { lat: midLat, lng: midLng },
          map,
          label: { text: `Line ${i + 1}-${nextCorner}: ${dist.toFixed(1)}m`, color: '#ffffff', fontSize: '10px', fontWeight: 'bold' },
          icon: {
            path: g.SymbolPath.CIRCLE,
            fillOpacity: 0,
            strokeOpacity: 0,
            scale: 0,
          },
        });
        labelOverlayRefs.current.push(m);
      }
    }

    if (showAreaLabel) {
      const centroid = calculateCentroid(polygon.coordinates);
      const displayArea = area !== undefined ? area : gisUtils.calculatePolygonArea(polygon.coordinates);

      const infoWindow = new g.InfoWindow({
        content: `<div style="text-align: center; color: #333; font-family: sans-serif; padding: 4px 6px;">
                <div style="font-size: 13px; font-weight: bold; color: ${polygon.color || '#8e1616'};">${displayArea.toFixed(3)} sqm</div>
                <div style="font-size: 9px; margin-top: 4px;">Note: This cannot be used for legal purposes.</div>
              </div>`,
        position: { lat: centroid.lat, lng: centroid.lng },
        disableAutoPan: true,
      });

      infoWindow.open(map);
      labelOverlayRefs.current.push({ setMap: () => infoWindow.close() });
    }
  }, [mapNonce, polygon, showAreaLabel, showDistanceLabel, area]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      const g = (window as unknown as { google: { maps: any } }).google.maps;
      if (g) {
        const mapTypeKey = googleMapTypeIdForBasemap(basemap);
        const mapTypeId = g.MapTypeId[mapTypeKey] ?? g.MapTypeId.ROADMAP;
        mapInstanceRef.current.setMapTypeId(mapTypeId);
      }
    }
  }, [basemap]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.container, style, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
        <Text style={{ color: '#666', textAlign: 'center' }}>Set GOOGLE_MAPS_API_KEY in .env</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { position: 'relative', minHeight: 250 }]}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 12 }}
      />
      <View style={{ position: 'absolute', top: MAP_COMPASS_CONTROL_TOP, right: 10, zIndex: 20 }}>
        <MapNorthCompassOverlay
          bearingDeg={mapHeading}
          onResetNorth={() => {
            try {
              mapInstanceRef.current?.setHeading?.(0);
            } catch (_) {}
          }}
        />
      </View>
    </View>
  );
}

function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function NativeMapViewGoogleWebView({
  center,
  zoom = 16,
  polygon,
  boundary,
  boundaryGeoJson,
  markers,
  style,
  basemap = 'satellite',
  fitPolygonToken = '0|0',
  area,
  showAreaLabel = true,
  showDistanceLabel = true,
  onRegionChange,
}: MapViewProps) {
  const [mapHeading, setMapHeading] = useState(0);
  const webviewRef = useRef<WebView>(null);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;
  const mapTypeJs = googleMapTypeIdForBasemap(basemap);
  const key = GOOGLE_MAPS_API_KEY ? encodeURIComponent(GOOGLE_MAPS_API_KEY) : '';

  const polyCoordsKey = useMemo(() => polygonCoordsKey(polygon), [polygon?.coordinates]);

  const lotUiPayload = useMemo(
    () =>
      safeJsonForScript({
        strokeColor: polygon?.color || '#8e1616',
        fillColor: polygon?.fillColor || '#8e1616',
        showArea: showAreaLabel,
        showDistance: showDistanceLabel,
        area: area !== undefined && area !== null ? area : null,
      }),
    [polygon?.color, polygon?.fillColor, showAreaLabel, showDistanceLabel, area]
  );

  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.map) {
          window.map.setMapTypeId(google.maps.MapTypeId.${mapTypeJs});
        }
        true;
      `);
    }
  }, [mapTypeJs]);

  /** Update labels / colors without reloading the WebView (avoids pan/zoom reset) */
  useEffect(() => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(`
      (function() {
        try {
          var p = ${lotUiPayload};
          if (typeof window.iassessApplyLotUi === 'function') {
            window.iassessApplyLotUi(p);
          }
        } catch (e) {}
        true;
      })();
    `);
  }, [lotUiPayload]);

  const htmlContent = useMemo(() => {
    const polygonJson = safeJsonForScript(polygon || null);
    const boundaryJson = safeJsonForScript(boundary || null);
    const boundaryGeoJsonStr = safeJsonForScript(boundaryGeoJson || null);
    const markersJson = safeJsonForScript(markers || null);
    const initialUi = safeJsonForScript({
      strokeColor: polygon?.color || '#8e1616',
      fillColor: polygon?.fillColor || '#8e1616',
      showArea: showAreaLabel,
      showDistance: showDistanceLabel,
      area: area !== undefined && area !== null ? area : null,
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body { margin: 0; padding: 0; background: #f3f6f9; }
          #map-shell { position: relative; width: 100%; height: 100vh; }
          #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map-shell">
        <div id="map"></div>
        </div>
        <script>
          function calcDist(lat1, lon1, lat2, lon2) {
            var R = 6371000;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          }
          function calcArea(coords) {
            if (!coords || coords.length < 3) return 0;
            var area = 0;
            for (var i = 0; i < coords.length - 1; i++) {
              area += (coords[i][0] * coords[i+1][1]) - (coords[i+1][0] * coords[i][1]);
            }
            area = Math.abs(area) / 2;
            var mLat = 110574;
            var mLng = 111320 * Math.cos(12 * Math.PI / 180);
            return area * mLat * mLng;
          }
          function calcCentroid(coords) {
            var lat = 0, lng = 0, n = coords.length - 1;
            for (var i = 0; i < n; i++) { lat += coords[i][1]; lng += coords[i][0]; }
            return { lat: lat/n, lng: lng/n };
          }
          window.iassessApplyLotUi = function(opts) {
            var g = google.maps;
            var map = window.map;
            if (!map || !window.iassessLotPolygon || !window.iassessPolygonCoords) return;
            var coords = window.iassessPolygonCoords;
            window.iassessLotPolygon.setOptions({
              strokeColor: opts.strokeColor || '#8e1616',
              fillColor: opts.fillColor || '#8e1616'
            });
            (window.iassessLabelMarkers || []).forEach(function(m) { m.setMap(null); });
            window.iassessLabelMarkers = [];
            if (window.iassessAreaInfo) {
              try { window.iassessAreaInfo.close(); } catch (e) {}
              window.iassessAreaInfo = null;
            }
            if (opts.showDistance) {
              for (var i = 0; i < coords.length - 1; i++) {
                var p1 = coords[i];
                var p2 = coords[i+1];
                var dist = calcDist(p1[1], p1[0], p2[1], p2[0]);
                var midLat = (p1[1] + p2[1]) / 2;
                var midLng = (p1[0] + p2[0]) / 2;
                var nextCorner = i + 2 === coords.length ? 1 : i + 2;
                var mk = new g.Marker({
                  position: { lat: midLat, lng: midLng },
                  map: map,
                  label: { text: 'Line ' + (i + 1) + '-' + nextCorner + ': ' + dist.toFixed(1) + 'm', color: '#ffffff', fontSize: '10px', fontWeight: 'bold' },
                  icon: { path: g.SymbolPath.CIRCLE, fillOpacity: 0, strokeOpacity: 0, scale: 0 }
                });
                window.iassessLabelMarkers.push(mk);
              }
            }
            if (opts.showArea) {
              var centroid = calcCentroid(coords);
              var displayArea = opts.area != null ? opts.area : calcArea(coords);
              var polyColor = opts.strokeColor || '#8e1616';
              var infoWindow = new g.InfoWindow({
                content: '<div style="text-align: center; color: #333; font-family: sans-serif; padding: 4px 6px; margin: 0; overflow: hidden;">' +
                  '<div style="font-size: 13px; font-weight: bold; color: ' + polyColor + '; line-height: 1.2;">' + displayArea.toFixed(3) + ' sqm</div>' +
                  '<div style="font-size: 9px; margin-top: 4px; line-height: 1.1;">Note: This cannot be used for legal purposes.</div>' +
                '</div>',
                position: { lat: centroid.lat, lng: centroid.lng },
                disableAutoPan: true
              });
              infoWindow.open(map);
              window.iassessAreaInfo = infoWindow;
            }
          };
          function initMap() {
            var g = google.maps;
            window.map = new g.Map(document.getElementById('map'), {
              center: { lat: ${center.lat}, lng: ${center.lng} },
              zoom: ${zoom},
              mapTypeId: g.MapTypeId.${mapTypeJs},
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false
            });
            var map = window.map;
            var polygonData = ${polygonJson};
            var boundaryData = ${boundaryJson};
            var boundaryGeoJsonData = ${boundaryGeoJsonStr};
            var markersData = ${markersJson};

            if (boundaryData && boundaryData.coordinates.length > 0) {
              var bpaths = boundaryData.coordinates.map(function(c) { return { lat: c[1], lng: c[0] }; });
              new g.Polygon({
                paths: bpaths,
                strokeColor: boundaryData.color || '#2563eb',
                fillColor: boundaryData.fillColor || '#2563eb',
                fillOpacity: 0.08,
                strokeWeight: 2,
                map: map
              });
            }
            if (boundaryGeoJsonData && boundaryGeoJsonData.features) {
              map.data.addGeoJson(boundaryGeoJsonData);
              map.data.setStyle({
                fillColor: '#15803d',
                fillOpacity: 0.12,
                strokeColor: '#15803d',
                strokeWeight: 1.5
              });
            }
            if (polygonData && polygonData.coordinates.length > 0) {
              var paths = polygonData.coordinates.map(function(c) { return { lat: c[1], lng: c[0] }; });
              var lotPoly = new g.Polygon({
                paths: paths,
                strokeColor: polygonData.color || '#8e1616',
                fillColor: polygonData.fillColor || '#8e1616',
                fillOpacity: 0,
                strokeWeight: 2,
                map: map
              });
              window.iassessLotPolygon = lotPoly;
              window.iassessPolygonCoords = polygonData.coordinates;
              window.iassessLabelMarkers = [];
              window.iassessAreaInfo = null;
              var bounds = new g.LatLngBounds();
              polygonData.coordinates.forEach(function(c) { bounds.extend({ lat: c[1], lng: c[0] }); });
              var polyKeyStr = JSON.stringify(polygonData.coordinates || null);
              var fitId = polyKeyStr + '|' + ${JSON.stringify(fitPolygonToken)};
              var prevFit = sessionStorage.getItem('iassess_poly_fit');
              if (prevFit !== fitId) {
                map.fitBounds(bounds, 50);
                sessionStorage.setItem('iassess_poly_fit', fitId);
              }
              window.iassessApplyLotUi(${initialUi});
            } else {
              window.iassessLotPolygon = null;
              window.iassessPolygonCoords = null;
              var bb = new g.LatLngBounds();
              if (boundaryData && boundaryData.coordinates.length) {
                boundaryData.coordinates.forEach(function(c) { bb.extend({ lat: c[1], lng: c[0] }); });
              }
              map.data.forEach(function(feature) {
                var geom = feature.getGeometry();
                if (geom && geom.forEachLatLng) {
                  geom.forEachLatLng(function(ll) { bb.extend(ll); });
                }
              });
              var bFitId = 'boundary|' + JSON.stringify(boundaryData && boundaryData.coordinates) + '|' + (boundaryGeoJsonData && boundaryGeoJsonData.features ? boundaryGeoJsonData.features.length : 0) + '|' + ${JSON.stringify(fitPolygonToken)};
              var prevBFit = sessionStorage.getItem('iassess_boundary_fit');
              if (!bb.isEmpty() && prevBFit !== bFitId) {
                map.fitBounds(bb, 60);
                sessionStorage.setItem('iassess_boundary_fit', bFitId);
              }
            }
            if (markersData && markersData.length) {
              markersData.forEach(function(m) {
                new g.Marker({ position: { lat: m.lat, lng: m.lng }, map: map, title: m.title || 'Marker' });
              });
            }

            function iassessPostRegion() {
              var c = map.getCenter();
              var hd = typeof map.getHeading === 'function' ? map.getHeading() : 0;
              if (hd == null || isNaN(hd)) hd = 0;
              var msg = { type: 'REGION_CHANGE', center: { lat: c.lat(), lng: c.lng() }, zoom: map.getZoom(), heading: hd };
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(msg));
              }
            }
            map.addListener('idle', iassessPostRegion);
            map.addListener('heading_changed', iassessPostRegion);
          }
        </script>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap"></script>
      </body>
      </html>
    `;
  }, [center.lat, center.lng, zoom, polyCoordsKey, boundary, boundaryGeoJson, markers, fitPolygonToken, key, mapTypeJs]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.container, style, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
        <Text style={{ color: '#666', textAlign: 'center' }}>Set GOOGLE_MAPS_API_KEY in .env</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { position: 'relative' }]}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'REGION_CHANGE') {
              if (typeof data.heading === 'number' && !isNaN(data.heading)) {
                setMapHeading(data.heading);
              }
              onRegionChangeRef.current?.(data.center, data.zoom);
            }
          } catch (e) {}
        }}
        onLoadEnd={() => {
          webviewRef.current?.injectJavaScript(`
            (function() {
              try {
                var p = ${lotUiPayload};
                if (typeof window.iassessApplyLotUi === 'function') {
                  window.iassessApplyLotUi(p);
                }
              } catch (e) {}
              true;
            })();
          `);
        }}
      />
      <View style={styles.compassOverlay}>
        <MapNorthCompassOverlay
          bearingDeg={mapHeading}
          onResetNorth={() => {
            webviewRef.current?.injectJavaScript(`
              try {
                if (window.map && typeof window.map.setHeading === 'function') {
                  window.map.setHeading(0);
                }
              } catch (e) {}
              true;
            `);
          }}
        />
      </View>
    </View>
  );
}

function NativeMapViewWebView(props: MapViewProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.container, props.style, { justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: '#666', textAlign: 'center' }}>
          Native map uses Google Maps. Set GOOGLE_MAPS_API_KEY in .env (Maps JavaScript API).
        </Text>
      </View>
    );
  }
  return <NativeMapViewGoogleWebView {...props} />;
}

function WebMapView(props: MapViewProps) {
  if (GOOGLE_MAPS_API_KEY) {
    return <WebMapViewGoogle {...props} />;
  }
  return (
    <View style={[styles.container, props.style, { justifyContent: 'center', padding: 16 }]}>
      <Text style={{ color: '#666', textAlign: 'center' }}>Set GOOGLE_MAPS_API_KEY in .env</Text>
    </View>
  );
}

function BasemapMinimapPreview({
  basemap,
  mapCenter,
  onCycleBasemap,
}: {
  basemap: BasemapStyle;
  mapCenter: { lat: number; lng: number };
  onCycleBasemap: () => void;
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const previewUri = useMemo(
    () => buildBasemapPreviewUri(basemap, mapCenter),
    [basemap, mapCenter]
  );

  useEffect(() => {
    setImgLoading(true);
    setImgError(false);
  }, [previewUri]);

  const nextLabel = nextBasemapInSequence(basemap);
  const basemapLabel = basemap.charAt(0).toUpperCase() + basemap.slice(1);
  const showImage = Boolean(previewUri) && !imgError;

  return (
    <TouchableOpacity
      style={selectorStyles.minimapTouchable}
      onPress={onCycleBasemap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Basemap ${basemapLabel}. Tap to switch to ${nextLabel}.`}
    >
      <View style={selectorStyles.minimapFrame}>
        {showImage ? (
          <Image
            source={{ uri: previewUri! }}
            style={selectorStyles.minimapImage}
            resizeMode="cover"
            onLoadStart={() => setImgLoading(true)}
            onLoad={() => setImgLoading(false)}
            onError={() => {
              setImgLoading(false);
              setImgError(true);
            }}
          />
        ) : (
          <View style={[selectorStyles.minimapImage, selectorStyles.minimapPlaceholder]}>
            <Ionicons name="map-outline" size={28} color="#8e1616" />
          </View>
        )}
        {showImage && imgLoading ? (
          <View style={selectorStyles.minimapLoadingOverlay}>
            <ActivityIndicator size="small" color="#8e1616" />
          </View>
        ) : null}
        <View style={selectorStyles.minimapBadge} pointerEvents="none">
          <Ionicons name="layers-outline" size={14} color="#fff" />
        </View>
        <View style={selectorStyles.minimapCaption} pointerEvents="none">
          <Text style={selectorStyles.minimapCaptionText} numberOfLines={1}>
            {basemapLabel}
          </Text>
          <Text style={selectorStyles.minimapHint} numberOfLines={1}>
            Tap → {nextLabel.charAt(0).toUpperCase() + nextLabel.slice(1)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Minimap in bottom-right; tap cycles basemap style. */
function BasemapSelector({
  mapCenter,
  currentBasemap,
  onBasemapChange,
  hasPolygon,
  onFitPolygon,
}: {
  mapCenter: { lat: number; lng: number };
  currentBasemap: BasemapStyle;
  onBasemapChange?: (basemap: BasemapStyle) => void;
  hasPolygon: boolean;
  onFitPolygon: () => void;
}) {
  const insets = useSafeAreaInsets();

  const cycleBasemap = () => {
    onBasemapChange?.(nextBasemapInSequence(currentBasemap));
  };

  return (
    <View
      style={[
        selectorStyles.container,
        { bottom: 12 + insets.bottom, right: 12 + insets.right },
      ]}
    >
      <View style={selectorStyles.minimapColumn}>
        {hasPolygon ? (
          <TouchableOpacity
            style={selectorStyles.fitPolygonBtn}
            onPress={onFitPolygon}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Fit map to lot polygon"
          >
            <Ionicons name="scan-outline" size={22} color="#333" />
          </TouchableOpacity>
        ) : null}
        <BasemapMinimapPreview
          basemap={currentBasemap}
          mapCenter={mapCenter}
          onCycleBasemap={cycleBasemap}
        />
      </View>
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  minimapColumn: {
    alignItems: 'flex-end',
  },
  fitPolygonBtn: {
    marginBottom: 8,
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  minimapTouchable: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  minimapFrame: {
    width: 132,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#dde4ee',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  minimapImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  minimapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8edf4',
  },
  minimapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  minimapBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(142, 22, 22, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimapCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  minimapCaptionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  minimapHint: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
    marginTop: 1,
  },
});

function MapViewWithControls(props: MapViewProps) {
  const [basemap, setBasemap] = useState<BasemapStyle>(props.basemap || 'satellite');
  const [fitBump, setFitBump] = useState(0);

  const hasPolygon = Boolean(props.polygon?.coordinates?.length);
  const fitPolygonToken = `${props.fitPolygonTrigger ?? 0}|${fitBump}`;

  useEffect(() => {
    if (props.basemap) setBasemap(props.basemap);
  }, [props.basemap]);

  const handleBasemapChange = (newBasemap: BasemapStyle) => {
    setBasemap(newBasemap);
    props.onBasemapChange?.(newBasemap);
  };

  return (
    <View style={[styles.container, props.style]}>
      {isWeb ? (
        <WebMapView
          {...props}
          provider="google"
          basemap={basemap}
          fitPolygonToken={fitPolygonToken}
          area={props.area}
          showAreaLabel={props.showAreaLabel}
          showDistanceLabel={props.showDistanceLabel}
          onRegionChange={props.onRegionChange}
        />
      ) : (
        <NativeMapViewWebView
          {...props}
          provider="google"
          basemap={basemap}
          fitPolygonToken={fitPolygonToken}
          area={props.area}
          showAreaLabel={props.showAreaLabel}
          showDistanceLabel={props.showDistanceLabel}
          onRegionChange={props.onRegionChange}
        />
      )}
      {(props.showControls ?? true) && (
        <BasemapSelector
          mapCenter={props.center}
          currentBasemap={basemap}
          onBasemapChange={handleBasemapChange}
          hasPolygon={hasPolygon}
          onFitPolygon={() => setFitBump((n) => n + 1)}
        />
      )}
    </View>
  );
}

export const MapView: React.FC<MapViewProps> = (props) => {
  return <MapViewWithControls {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  compassOverlay: {
    position: 'absolute',
    top: MAP_COMPASS_CONTROL_TOP,
    right: 10,
    zIndex: 20,
  },
  map: {
    width: '100%',
    height: '100%',
    minHeight: 300,
    borderRadius: 12,
  },
});

export default MapView;