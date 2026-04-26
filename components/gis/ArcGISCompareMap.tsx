import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapNorthCompassOverlay, MAP_COMPASS_CONTROL_TOP } from '@/components/gis/MapNorthCompassOverlay';

interface ArcGISCompareMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  polygon?: {
    coordinates: [number, number][];
    color?: string;
  } | null;
  area?: number;
  showAreaLabel?: boolean;
  showDistanceLabel?: boolean;
  onRegionChange?: (center: { lat: number; lng: number }, zoom: number) => void;
}

const isWeb = Platform.OS === 'web';

// A selection of Esri Wayback Imagery releases
const WAYBACK_VERSIONS = [
  { id: '27982', date: '2025-04-24' },
  { id: '12428', date: '2024-06-06' },
  { id: '47963', date: '2023-06-29' },
  { id: '45441', date: '2022-08-31' },
  { id: '13534', date: '2021-06-30' },
  { id: '11135', date: '2020-06-10' },
  { id: '645', date: '2019-06-26' },
  { id: '11334', date: '2018-06-27' },
  { id: '10', date: '2014-02-20' },
];

export default function ArcGISCompareMap({ center, zoom = 17, polygon, area, showAreaLabel = true, showDistanceLabel = true, onRegionChange }: ArcGISCompareMapProps) {
  const [leftIdx, setLeftIdx] = useState(0); // Newest
  const [rightIdx, setRightIdx] = useState(3); // Older
  const [uiVisible, setUiVisible] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  /** ArcGIS MapView.rotation (deg clockwise); drives north compass like Google heading. */
  const [mapRotation, setMapRotation] = useState(0);

  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;

  const resetNorth = useCallback(() => {
    if (isWeb && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'RESET_NORTH' }, '*');
    } else {
      webviewRef.current?.injectJavaScript(
        `try{if(typeof window.iassessResetNorth==='function'){window.iassessResetNorth();}}catch(e){}true;`
      );
    }
  }, [isWeb]);

  const leftVersion = WAYBACK_VERSIONS[leftIdx];
  const rightVersion = WAYBACK_VERSIONS[rightIdx];

  // Send message to update layers without reloading the whole map
  useEffect(() => {
    const payload = {
      type: 'UPDATE_LAYERS',
      leftId: leftVersion.id,
      rightId: rightVersion.id,
      leftDate: leftVersion.date,
      rightDate: rightVersion.date
    };

    if (isWeb && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(payload, '*');
    } else if (!isWeb && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.setCompareLayers) {
          window.setCompareLayers('${leftVersion.id}', '${rightVersion.id}', '${leftVersion.date}', '${rightVersion.date}');
        }
        true;
      `);
    }
  }, [leftIdx, rightIdx, leftVersion, rightVersion]);

  // Send message to toggle reference labels
  useEffect(() => {
    const payload = {
      type: 'TOGGLE_LABELS',
      show: showLabels
    };

    if (isWeb && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(payload, '*');
    } else if (!isWeb && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.toggleLabels) {
          window.toggleLabels(${showLabels});
        }
        true;
      `);
    }
  }, [showLabels]);

  // Toggle polygon overlays (distance/area labels) without rebuilding the map HTML.
  useEffect(() => {
    const payload = {
      type: 'TOGGLE_OVERLAYS',
      showDistance: showDistanceLabel,
      showArea: showAreaLabel,
    };

    if (isWeb && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(payload, '*');
    } else if (!isWeb && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.setOverlayVisibility) {
          window.setOverlayVisibility(${showDistanceLabel}, ${showAreaLabel});
        }
        true;
      `);
    }
  }, [showDistanceLabel, showAreaLabel]);

  useEffect(() => {
    if (!isWeb) return;
    const listener = (event: MessageEvent) => {
      if (event.source === iframeRef.current?.contentWindow) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'REGION_CHANGE') {
            if (typeof data.rotation === 'number' && !isNaN(data.rotation)) {
              setMapRotation(data.rotation);
            }
            onRegionChangeRef.current?.(data.center, data.zoom);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        // Send initial state once the map is fully ready
        if (webviewRef.current) {
          webviewRef.current.injectJavaScript(`
            if (window.setCompareLayers) {
              window.setCompareLayers('${leftVersion.id}', '${rightVersion.id}', '${leftVersion.date}', '${rightVersion.date}');
            }
            true;
          `);
        }
      } else if (data.type === 'REGION_CHANGE') {
        if (typeof data.rotation === 'number' && !isNaN(data.rotation)) {
          setMapRotation(data.rotation);
        }
        onRegionChangeRef.current?.(data.center, data.zoom);
      }
    } catch (e) {}
  };

  const htmlContent = useMemo(() => {
    const polyStr = JSON.stringify(polygon || null);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>ArcGIS Swipe</title>
        <link rel="stylesheet" href="https://js.arcgis.com/4.28/esri/themes/light/main.css">
        <script src="https://js.arcgis.com/4.28/"></script>
        <style>
          html, body, #viewDiv { padding: 0; margin: 0; height: 100%; width: 100%; background: #1e1e1e; }
          .year-label {
            position: absolute;
            top: 20px;
            padding: 6px 10px;
            background: rgba(0,0,0,0.65);
            color: white;
            font-family: sans-serif;
            font-size: 12px;
            font-weight: bold;
            border-radius: 4px;
            z-index: 99;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          #label-left { left: 20px; }
          #label-right { right: 20px; }
          #fitLotPolygonBtn {
            display: none;
            position: absolute;
            bottom: 52px;
            right: 12px;
            z-index: 120;
            padding: 10px 14px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #fff;
            background: #3b5998;
            border: none;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            cursor: pointer;
          }
          #fitLotPolygonBtn:active { opacity: 0.88; }
          #loading {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: white; font-family: sans-serif; font-size: 14px; z-index: 90;
          }
        </style>
      </head>
      <body>
        <div id="loading">Loading Map Imagery...</div>
        <div id="viewDiv"></div>
        <button type="button" id="fitLotPolygonBtn">Locate</button>
        <div id="label-left" class="year-label"></div>
        <div id="label-right" class="year-label"></div>
        <script>
          window.onerror = function(msg, url, line) {
            var errDiv = document.createElement('div');
            errDiv.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:white; padding:20px; border:2px solid red; z-index:9999; color:black; max-width:80%; word-wrap:break-word; font-family:sans-serif;';
            errDiv.innerHTML = '<b>Map Error:</b><br>' + msg + '<br>Line: ' + line;
            document.body.appendChild(errDiv);
          };

          window.addEventListener("message", function(event) {
            var data = event.data;
            if (data && data.type === "UPDATE_LAYERS" && window.setCompareLayers) {
              window.setCompareLayers(data.leftId, data.rightId, data.leftDate, data.rightDate);
            }
            if (data && data.type === "TOGGLE_LABELS" && window.toggleLabels) {
              window.toggleLabels(data.show);
            }
            if (data && data.type === "TOGGLE_OVERLAYS" && window.setOverlayVisibility) {
              window.setOverlayVisibility(data.showDistance, data.showArea);
            }
            if (data && data.type === "RESET_NORTH" && typeof window.iassessResetNorth === "function") {
              window.iassessResetNorth();
            }
          });

          require([
            "esri/Map",
            "esri/views/MapView",
            "esri/layers/WebTileLayer",
            "esri/widgets/Swipe",
            "esri/Graphic",
            "esri/layers/GraphicsLayer",
            "esri/geometry/Polygon",
            "esri/symbols/TextSymbol",
            "esri/geometry/Point"
          ], function(Map, MapView, WebTileLayer, Swipe, Graphic, GraphicsLayer, Polygon, TextSymbol, Point) {
            
            window.esriWebTileLayer = WebTileLayer;

            // We initialize with empty strings or default, then immediately call setCompareLayers 
            // via the postMessage from React Native to set the actual initial layers.
            var layerLeft = new WebTileLayer({
              urlTemplate: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/27982/{level}/{row}/{col}",
              title: "Left"
            });

            var layerRight = new WebTileLayer({
              urlTemplate: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/45441/{level}/{row}/{col}",
              title: "Right"
            });

            var roadsLayer = new WebTileLayer({
              urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{level}/{row}/{col}",
              title: "Roads",
              visible: ${showLabels}
            });

            var labelsLayer = new WebTileLayer({
              urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{level}/{row}/{col}",
              title: "Labels",
              visible: ${showLabels}
            });

            var map = new Map({
              layers: [layerLeft, layerRight, roadsLayer, labelsLayer]
            });

            var view = new MapView({
              container: "viewDiv",
              map: map,
              center: [${center.lng}, ${center.lat}],
              zoom: ${zoom}
            });

            view.when(function() {
              document.getElementById('loading').style.display = 'none';
            });

            var swipe = new Swipe({
              leadingLayers: [layerLeft],
              trailingLayers: [layerRight],
              position: 50,
              view: view
            });

            view.ui.add(swipe);
            view.ui.remove("zoom");
            view.ui.remove("attribution");

            window.iassessResetNorth = function() {
              if (view) view.rotation = 0;
            };

            window.map = map;
            window.swipe = swipe;
            window.leftLayer = layerLeft;
            window.rightLayer = layerRight;
            window.roadsLayer = roadsLayer;
            window.labelsLayer = labelsLayer;

            window.toggleLabels = function(show) {
              if (window.roadsLayer) window.roadsLayer.visible = show;
              if (window.labelsLayer) window.labelsLayer.visible = show;
            };

            window.distanceGraphics = [];
            window.areaGraphics = [];
            window.setOverlayVisibility = function(showDist, showArea) {
              if (window.distanceGraphics) {
                window.distanceGraphics.forEach(function(g) { g.visible = !!showDist; });
              }
              if (window.areaGraphics) {
                window.areaGraphics.forEach(function(g) { g.visible = !!showArea; });
              }
            };

            window.setCompareLayers = function(lId, rId, lDate, rDate) {
              if (!window.map || !window.swipe) return;

              // Create new layers
              var newLeft = new window.esriWebTileLayer({ urlTemplate: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/" + lId + "/{level}/{row}/{col}" });
              var newRight = new window.esriWebTileLayer({ urlTemplate: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/" + rId + "/{level}/{row}/{col}" });

              // Add new layers BEFORE removing old ones to prevent flashing
              window.map.addMany([newLeft, newRight], 0);

              // Update swipe widget to point to the new layers
              window.swipe.leadingLayers = [newLeft];
              window.swipe.trailingLayers = [newRight];

              // Remove the old layers
              if (window.leftLayer && window.rightLayer) {
                window.map.removeMany([window.leftLayer, window.rightLayer]);
              }

              // Force the swipe widget to re-render immediately
              window.swipe.scheduleRender();

              // Update references
              window.leftLayer = newLeft;
              window.rightLayer = newRight;

              document.getElementById('label-left').innerText = lDate;
              document.getElementById('label-right').innerText = rDate;
            };

            // Notify React Native that the map is ready to receive the initial layers
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
            } else {
              window.parent.postMessage({ type: 'MAP_READY' }, '*');
            }

            var polyData = ${polyStr};
            var showDist = ${showDistanceLabel};
            var showArea = ${showAreaLabel};
            var polyArea = ${area !== undefined && area !== null ? area : 'null'};

            function iassessPostArcRegion() {
              var rot = view.rotation != null && !isNaN(view.rotation) ? view.rotation : 0;
              var msg = {
                type: 'REGION_CHANGE',
                center: { lat: view.center.latitude, lng: view.center.longitude },
                zoom: view.zoom,
                rotation: rot
              };
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(msg));
              } else {
                window.parent.postMessage(msg, '*');
              }
            }
            view.watch("extent", iassessPostArcRegion);
            view.watch("rotation", iassessPostArcRegion);

            function calcDist(lat1, lon1, lat2, lon2) {
              var R = 6371000;
              var dLat = (lat2 - lat1) * Math.PI / 180;
              var dLon = (lon2 - lon1) * Math.PI / 180;
              var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
              return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
            function calcCentroid(coords) {
              var lat = 0, lng = 0, n = coords.length - 1;
              for (var i = 0; i < n; i++) { lat += coords[i][1]; lng += coords[i][0]; }
              return { lat: lat/n, lng: lng/n };
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

            /** Match line-label sizing; when zoomed out (~>20 ft per pixel) bump font so labels stay readable. */
            function refreshOverlayLabelSizes() {
              if (!view) return;
              var distList = window.distanceGraphics || [];
              var areaList = window.areaGraphics || [];
              if (!distList.length && !areaList.length) return;
              var mpp = view.resolution;
              if (mpp == null || !(mpp > 0) || !isFinite(mpp)) return;
              var ftPerPx = mpp * 3.28084;
              var linePt = 10;
              if (ftPerPx > 20) {
                var bump = Math.min(12, Math.round((ftPerPx - 20) / 6));
                linePt = 10 + bump;
              }
              var areaPt = linePt + 1;
              distList.forEach(function(g) {
                if (!g || !g.symbol) return;
                var sym = g.symbol;
                g.symbol = new TextSymbol({
                  text: sym.text,
                  color: sym.color,
                  haloColor: sym.haloColor || "white",
                  haloSize: sym.haloSize != null ? sym.haloSize : 1,
                  font: { size: linePt, weight: "bold" },
                });
              });
              areaList.forEach(function(g) {
                if (!g || !g.symbol) return;
                var sym = g.symbol;
                g.symbol = new TextSymbol({
                  text: sym.text,
                  color: sym.color,
                  haloColor: sym.haloColor || "white",
                  haloSize: sym.haloSize != null ? sym.haloSize : 2,
                  font: { size: areaPt, weight: "bold" },
                });
              });
            }

            window.fitLotPolygonToView = function() {
              if (!view || !window._lotPolygonGeom) return;
              view
                .goTo({ target: window._lotPolygonGeom, padding: 60 })
                .catch(function(err) {
                  if (err && err.name !== "AbortError") {
                  }
                });
            };
            var fitLotBtn = document.getElementById("fitLotPolygonBtn");
            if (fitLotBtn) {
              fitLotBtn.addEventListener("click", function() {
                window.fitLotPolygonToView();
              });
            }

            if (polyData && polyData.coordinates && polyData.coordinates.length > 0) {
              var graphicsLayer = new GraphicsLayer();
              map.add(graphicsLayer);

              var rings = polyData.coordinates.map(function(c) { return [c[0], c[1]]; });
              
              var polygonGraphic = new Graphic({
                geometry: new Polygon({
                  rings: [rings]
                }),
                symbol: {
                  type: "simple-fill",
                  color: [142, 22, 22, 0.0],
                  outline: {
                    color: polyData.color || "#8e1616",
                    width: 2
                  }
                }
              });
              graphicsLayer.add(polygonGraphic);

              window._lotPolygonGeom = polygonGraphic.geometry;
              if (fitLotBtn) fitLotBtn.style.display = "block";

              var coords = polyData.coordinates;
              if (showDist) {
                var polyColorForLabels = polyData.color || "#8e1616";
                for (var i = 0; i < coords.length - 1; i++) {
                  var p1 = coords[i];
                  var p2 = coords[i+1];
                  var dist = calcDist(p1[1], p1[0], p2[1], p2[0]);
                  var midLat = (p1[1] + p2[1]) / 2;
                  var midLng = (p1[0] + p2[0]) / 2;
                  var nextCorner = i + 2 === coords.length ? 1 : i + 2;

                  var textGraphic = new Graphic({
                    geometry: new Point({ longitude: midLng, latitude: midLat }),
                    symbol: new TextSymbol({
                      text: "Line " + (i + 1) + "-" + nextCorner + ": " + dist.toFixed(1) + "m",
                      color: polyColorForLabels,
                      haloColor: "white",
                      haloSize: 1,
                      font: { size: 10, weight: "bold" },
                    }),
                  });
                  graphicsLayer.add(textGraphic);
                  window.distanceGraphics.push(textGraphic);
                }
              }

              if (showArea) {
                var centroid = calcCentroid(coords);
                var displayArea = polyArea !== null ? polyArea : calcArea(coords);
                var polyColor = polyData.color || "#8e1616";
                var areaTextGraphic = new Graphic({
                  geometry: new Point({ longitude: centroid.lng, latitude: centroid.lat }),
                  symbol: new TextSymbol({
                    text: displayArea.toFixed(3) + " sqm",
                    color: polyColor,
                    haloColor: "white",
                    haloSize: 2,
                    font: { size: 11, weight: "bold" },
                  }),
                });
                graphicsLayer.add(areaTextGraphic);
                window.areaGraphics.push(areaTextGraphic);
              }

              window.setOverlayVisibility(showDist, showArea);

              view.when(function() {
                refreshOverlayLabelSizes();
              });
              view.watch("zoom", function() {
                refreshOverlayLabelSizes();
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  }, [center.lat, center.lng, zoom, polygon?.coordinates, polygon?.color, area]);

  return (
    <View style={styles.container}>
      {isWeb ? (
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      ) : (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'https://arcgis.com' }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          onMessage={handleMessage}
        />
      )}

      <View style={styles.compassOverlay}>
        <MapNorthCompassOverlay bearingDeg={mapRotation} onResetNorth={resetNorth} />
      </View>

      {/* UI Overlays */}
      <TouchableOpacity 
        style={styles.labelsBtn} 
        onPress={() => setShowLabels(!showLabels)}
      >
        <Ionicons name={showLabels ? "checkbox" : "square-outline"} size={16} color="#fff" />
        <Text style={styles.labelsBtnText}>Reference label overlay</Text>
      </TouchableOpacity>

      {uiVisible ? (
        <>
          <View style={[styles.sidebar, styles.sidebarLeft]}>
            <Text style={styles.sidebarTitle}>Left Selection</Text>
            <Text style={styles.sidebarSubtitle}>{leftVersion.date}</Text>
            <View style={styles.scrollListContainer}>
              <ScrollView 
                style={styles.scrollList} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {WAYBACK_VERSIONS.map((v, i) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.dateBtn, leftIdx === i && styles.dateBtnSelected]}
                    onPress={() => setLeftIdx(i)}
                  >
                    <Text style={[styles.dateText, leftIdx === i && styles.dateTextSelected]}>{v.date}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={[styles.sidebar, styles.sidebarRight]}>
            <Text style={styles.sidebarTitle}>Right Selection</Text>
            <Text style={styles.sidebarSubtitle}>{rightVersion.date}</Text>
            <View style={styles.scrollListContainer}>
              <ScrollView 
                style={styles.scrollList} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {WAYBACK_VERSIONS.map((v, i) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.dateBtn, rightIdx === i && styles.dateBtnSelected]}
                    onPress={() => setRightIdx(i)}
                  >
                    <Text style={[styles.dateText, rightIdx === i && styles.dateTextSelected]}>{v.date}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </>
      ) : null}

      <TouchableOpacity 
        style={styles.toggleBtn} 
        onPress={() => setUiVisible(!uiVisible)}
      >
        <Text style={styles.toggleBtnText}>{uiVisible ? 'Hide Dates' : 'Show Dates'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
    position: 'relative',
  },
  compassOverlay: {
    position: 'absolute',
    top: MAP_COMPASS_CONTROL_TOP,
    right: 10,
    zIndex: 200,
  },
  sidebar: {
    position: 'absolute',
    top: 60,
    bottom: 20,
    width: 140,
    backgroundColor: 'rgba(15, 23, 42, 0.9)', // Dark slate
    borderRadius: 8,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    zIndex: 100, // Ensure it's above the map
  },
  sidebarLeft: {
    left: 10,
  },
  sidebarRight: {
    right: 10,
  },
  sidebarTitle: {
    color: '#94a3b8', // Slate 400
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  sidebarSubtitle: {
    color: '#38bdf8', // Blue 500
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollListContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 4, // Add border radius to match the inner items
  },
  scrollList: {
    flex: 1,
  },
  dateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  dateBtnSelected: {
    backgroundColor: '#2563eb', // Blue 600
  },
  dateText: {
    color: '#cbd5e1', // Slate 300
    fontSize: 13,
    textAlign: 'center',
  },
  dateTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  toggleBtn: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100, // Ensure it's above the map
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  labelsBtn: {
    position: 'absolute',
    top: MAP_COMPASS_CONTROL_TOP,
    right: 66,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    zIndex: 100,
  },
  labelsBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});