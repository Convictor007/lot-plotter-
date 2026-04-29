import React, { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiUrl } from '@/lib/api/api-url';

const DEFAULT_LAT = 13.3167;
const DEFAULT_LNG = 123.2333;

/** Parent window receives this on web (iframe postMessage). */
export const WEB_MAP_MESSAGE_TYPE = 'iassess-map-pin';

/** Matches `/api/geocode/reverse` address payload (used to skip a second fetch on Confirm). */
export type GeocodedAddressPreview = {
  street?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
  region?: string | null;
  postal_code?: string | null;
  formatted?: string | null;
};

function buildLeafletHtml(lat: number, lng: number, pinColor: string) {
  const pin = pinColor && /^#[0-9A-Fa-f]{6}$/.test(pinColor) ? pinColor : '#3b5998';
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;}
  #map-root{position:relative;width:100%;height:100%;}
  #map{position:absolute;inset:0;}
  .pin-stack{
    position:absolute;left:50%;top:50%;z-index:1000;pointer-events:none;
    transform:translate(-50%,-100%);
    display:flex;flex-direction:column;align-items:center;margin-top:-6px;
  }
  .addr-tooltip{
    position:relative;background:${pin};color:#fff;font-size:12px;font-weight:600;
    padding:8px 14px;border-radius:10px;margin-bottom:4px;max-width:min(280px,calc(100vw - 48px));
    text-align:center;line-height:1.35;box-shadow:0 2px 10px rgba(0,0,0,.22);
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  .addr-tooltip::after{
    content:'';position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);
    border-width:7px 7px 0 7px;border-style:solid;border-color:${pin} transparent transparent transparent;
  }
  .center-pin svg{display:block;width:40px;height:48px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));}
  #basemap-bar{
    position:absolute;bottom:8px;left:50%;transform:translateX(-50%);z-index:1000;
    display:flex;flex-wrap:wrap;gap:2px 8px;justify-content:center;align-items:center;
    max-width:calc(100% - 64px);padding:0 6px;
    background:transparent;box-shadow:none;border-radius:0;
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  #basemap-bar .basemap-lbl{display:none;}
  #basemap-bar button{
    border:none;padding:4px 6px;margin:0;background:rgba(255,255,255,.86);color:#c1121f;
    font-size:11px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;
    text-decoration:none;opacity:1;border-radius:6px;
  }
  #basemap-bar button:hover{background:#fff;color:#8b0000;box-shadow:0 1px 6px rgba(0,0,0,.2);}
  #basemap-bar button.on{font-weight:800;color:#fff;background:#c1121f;text-decoration:none;}
  #basemap-bar button:active{opacity:.85;}
</style>
</head><body>
<div id="map-root">
<div id="map"></div>
<div class="pin-stack" aria-hidden="true">
  <div class="addr-tooltip">Your address is here</div>
  <div class="center-pin">
    <svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path fill="${pin}" d="M12 0C7.58 0 4 3.58 4 8c0 7 8 18 8 18s8-11 8-18c0-4.42-3.58-8-8-8z"/><circle fill="#fff" cx="12" cy="8" r="3.2"/></svg>
  </div>
</div>
<div id="basemap-bar" aria-label="Map style"></div>
</div>
<script>
(function(){
  var lat=${lat}, lng=${lng};
  var mapEl=document.getElementById('map');
  var map=L.map(mapEl,{zoomControl:true}).setView([lat,lng],17);

  var streets=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19, attribution:'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
  });
  var hybrid=L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
      maxZoom:19, attribution:'Tiles &copy; Esri'
    }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{
      maxZoom:19, opacity:0.95, attribution:'Labels &copy; Esri'
    })
  ]);
  var light=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd', maxZoom:20, attribution:'&copy; OpenStreetMap &copy; CARTO'
  });
  var dark=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd', maxZoom:20, attribution:'&copy; OpenStreetMap &copy; CARTO'
  });

  var modes={ streets:streets, satellite:satellite, hybrid:hybrid, light:light, dark:dark };
  var current=streets;
  streets.addTo(map);

  var bar=document.getElementById('basemap-bar');
  var specs=[
    ['streets','Map'],
    ['satellite','Satellite'],
    ['hybrid','Hybrid'],
    ['light','Light'],
    ['dark','Dark']
  ];
  specs.forEach(function(s){
    var b=document.createElement('button');
    b.type='button';
    b.textContent=s[1];
    b.setAttribute('data-mode',s[0]);
    if(s[0]==='streets') b.className='on';
    b.onclick=function(){
      if(current===modes[s[0]]) return;
      map.removeLayer(current);
      current=modes[s[0]];
      current.addTo(map);
      bar.querySelectorAll('button').forEach(function(el){ el.classList.toggle('on', el.getAttribute('data-mode')===s[0]); });
    };
    bar.appendChild(b);
  });

  function send(){
    var c=map.getCenter();
    var payload={lat:c.lat,lng:c.lng};
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }else if(window.parent&&window.parent!==window){
      window.parent.postMessage(Object.assign({type:'${WEB_MAP_MESSAGE_TYPE}'},payload),'*');
    }
  }
  map.on('moveend',send);
  map.on('zoomend',send);
  map.whenReady(function(){ setTimeout(send,120); });

  window.iassessLocateMe=function(){
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(
      function(pos){
        map.setView([pos.coords.latitude,pos.coords.longitude],17);
        setTimeout(send,200);
      },
      function(){},
      {enableHighAccuracy:true,maximumAge:60000,timeout:15000}
    );
  };
})();
</script></body></html>`;
}

function buildMapboxHtml(lat: number, lng: number, pinColor: string, token: string) {
  const pin = pinColor && /^#[0-9A-Fa-f]{6}$/.test(pinColor) ? pinColor : '#3b5998';
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" rel="stylesheet"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js"></script>
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;}
  #map-root{position:relative;width:100%;height:100%;}
  #map{position:absolute;inset:0;}
  .pin-stack{position:absolute;left:50%;top:50%;z-index:1000;pointer-events:none;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;margin-top:-6px;}
  .addr-tooltip{position:relative;background:${pin};color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:10px;margin-bottom:4px;max-width:min(280px,calc(100vw - 48px));text-align:center;line-height:1.35;box-shadow:0 2px 10px rgba(0,0,0,.22);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  .addr-tooltip::after{content:'';position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);border-width:7px 7px 0 7px;border-style:solid;border-color:${pin} transparent transparent transparent;}
  .center-pin svg{display:block;width:40px;height:48px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));}
  #basemap-bar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);z-index:1000;display:flex;flex-wrap:wrap;gap:2px 8px;justify-content:center;align-items:center;max-width:calc(100% - 64px);padding:0 6px;background:transparent;border-radius:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  #basemap-bar button{border:none;padding:4px 6px;margin:0;background:rgba(255,255,255,.86);color:#c1121f;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;opacity:1;border-radius:6px;}
  #basemap-bar button:hover{background:#fff;color:#8b0000;box-shadow:0 1px 6px rgba(0,0,0,.2);}
  #basemap-bar button.on{font-weight:800;color:#fff;background:#c1121f;text-decoration:none;}
</style>
</head><body>
<div id="map-root"><div id="map"></div>
<div class="pin-stack" aria-hidden="true"><div class="addr-tooltip">Your address is here</div><div class="center-pin"><svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path fill="${pin}" d="M12 0C7.58 0 4 3.58 4 8c0 7 8 18 8 18s8-11 8-18c0-4.42-3.58-8-8-8z"/><circle fill="#fff" cx="12" cy="8" r="3.2"/></svg></div></div>
<div id="basemap-bar" aria-label="Map style"></div></div>
<script>
(function(){
  mapboxgl.accessToken=${JSON.stringify(token)};
  var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/streets-v12',center:[${lng},${lat}],zoom:17});
  map.addControl(new mapboxgl.NavigationControl(),'top-left');
  var bar=document.getElementById('basemap-bar');
  var styles={streets:'mapbox://styles/mapbox/streets-v12',satellite:'mapbox://styles/mapbox/satellite-v9',hybrid:'mapbox://styles/mapbox/satellite-streets-v12',light:'mapbox://styles/mapbox/light-v11',dark:'mapbox://styles/mapbox/dark-v11'};
  [['streets','Map'],['satellite','Satellite'],['hybrid','Hybrid'],['light','Light'],['dark','Dark']].forEach(function(s){
    var b=document.createElement('button');b.type='button';b.textContent=s[1];b.setAttribute('data-mode',s[0]);if(s[0]==='streets') b.className='on';
    b.onclick=function(){ map.setStyle(styles[s[0]]); bar.querySelectorAll('button').forEach(function(el){ el.classList.toggle('on', el.getAttribute('data-mode')===s[0]); }); };
    bar.appendChild(b);
  });
  function send(){ var c=map.getCenter(); var payload={lat:c.lat,lng:c.lng}; if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } else if(window.parent&&window.parent!==window){ window.parent.postMessage(Object.assign({type:'${WEB_MAP_MESSAGE_TYPE}'},payload),'*'); } }
  map.on('moveend',send); map.on('zoomend',send); map.on('load',function(){ setTimeout(send,120); });
  window.iassessLocateMe=function(){ if(!navigator.geolocation)return; navigator.geolocation.getCurrentPosition(function(pos){ map.flyTo({center:[pos.coords.longitude,pos.coords.latitude],zoom:17}); setTimeout(send,250); },function(){},{enableHighAccuracy:true,maximumAge:60000,timeout:15000}); };
})();
</script></body></html>`;
}

function buildGoogleHtml(lat: number, lng: number, pinColor: string, key: string) {
  const pin = pinColor && /^#[0-9A-Fa-f]{6}$/.test(pinColor) ? pinColor : '#3b5998';
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
html,body,#map-root,#map{margin:0;padding:0;height:100%;width:100%} #map-root{position:relative}
.pin-stack{position:absolute;left:50%;top:50%;z-index:1000;pointer-events:none;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;margin-top:-6px}
.addr-tooltip{position:relative;background:${pin};color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:10px;margin-bottom:4px;max-width:min(280px,calc(100vw - 48px));text-align:center;line-height:1.35;box-shadow:0 2px 10px rgba(0,0,0,.22);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.addr-tooltip::after{content:'';position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);border-width:7px 7px 0 7px;border-style:solid;border-color:${pin} transparent transparent transparent}
.center-pin svg{display:block;width:40px;height:48px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
#basemap-bar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);z-index:1000;display:flex;gap:8px;max-width:calc(100% - 64px);font-family:system-ui}
#basemap-bar button{border:none;padding:4px 6px;background:rgba(255,255,255,.86);color:#c1121f;font-size:11px;font-weight:700;opacity:1;border-radius:6px}
#basemap-bar button:hover{background:#fff;color:#8b0000;box-shadow:0 1px 6px rgba(0,0,0,.2)}
#basemap-bar button.on{font-weight:800;color:#fff;background:#c1121f;text-decoration:none}
</style></head><body>
<div id="map-root"><div id="map"></div>
<div class="pin-stack" aria-hidden="true"><div class="addr-tooltip">Your address is here</div><div class="center-pin"><svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path fill="${pin}" d="M12 0C7.58 0 4 3.58 4 8c0 7 8 18 8 18s8-11 8-18c0-4.42-3.58-8-8-8z"/><circle fill="#fff" cx="12" cy="8" r="3.2"/></svg></div></div>
<div id="basemap-bar"></div></div>
<script>
var map;
function send(){ if(!map) return; var c=map.getCenter(); var payload={lat:c.lat(),lng:c.lng()}; if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));} else if(window.parent&&window.parent!==window){window.parent.postMessage(Object.assign({type:'${WEB_MAP_MESSAGE_TYPE}'},payload),'*');} }
function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{center:{lat:${lat},lng:${lng}},zoom:17,mapTypeId:'roadmap',streetViewControl:false,fullscreenControl:false});
  map.addListener('idle',send);
  var bar=document.getElementById('basemap-bar');
  [['roadmap','Map'],['satellite','Satellite'],['hybrid','Hybrid'],['terrain','Terrain']].forEach(function(s){
    var b=document.createElement('button'); b.textContent=s[1]; b.className=s[0]==='roadmap'?'on':'';
    b.onclick=function(){ map.setMapTypeId(s[0]); bar.querySelectorAll('button').forEach(function(el){el.classList.remove('on')}); b.classList.add('on'); };
    bar.appendChild(b);
  });
  setTimeout(send,120);
}
window.iassessLocateMe=function(){ if(!navigator.geolocation||!map)return; navigator.geolocation.getCurrentPosition(function(pos){ map.panTo({lat:pos.coords.latitude,lng:pos.coords.longitude}); map.setZoom(17); setTimeout(send,250); },function(){},{enableHighAccuracy:true,maximumAge:60000,timeout:15000}); };
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initMap"></script>
</body></html>`;
}

function buildMapHtml(
  lat: number,
  lng: number,
  pinColor: string,
  googleApiKey?: string | null,
  mapboxToken?: string | null
) {
  const g = (googleApiKey || '').trim();
  if (g) return buildGoogleHtml(lat, lng, pinColor, g);
  const m = (mapboxToken || '').trim();
  if (m) return buildMapboxHtml(lat, lng, pinColor, m);
  return buildLeafletHtml(lat, lng, pinColor);
}

export type AddressMapPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Latest center + optional geocode preview (avoids duplicate reverse call on confirm when fresh). */
  onConfirm: (lat: number, lng: number, preview: GeocodedAddressPreview | null) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  colors: {
    cardBg: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    contentBg: string;
  };
};

const PIN_EPS = 1e-5;

function pinsMatch(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return Math.abs(a.lat - b.lat) < PIN_EPS && Math.abs(a.lng - b.lng) < PIN_EPS;
}

function applyPinPayload(
  raw: unknown,
  setDraftLat: (n: number) => void,
  setDraftLng: (n: number) => void
) {
  try {
    let p: { lat?: number; lng?: number };
    if (typeof raw === 'string') {
      p = JSON.parse(raw) as { lat?: number; lng?: number };
    } else if (raw && typeof raw === 'object' && 'lat' in raw) {
      p = raw as { lat?: number; lng?: number };
    } else {
      return;
    }
    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      setDraftLat(p.lat);
      setDraftLng(p.lng);
    }
  } catch {
    //
  }
}

/** One-line address like Shopee card (Nominatim `formatted` first). */
function formatAddressCardLine(addr: GeocodedAddressPreview): string {
  if (addr.formatted?.trim()) return addr.formatted.trim();
  const parts = [addr.street, addr.barangay, addr.municipality, addr.province, addr.region].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export function AddressMapPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
  colors,
}: AddressMapPickerModalProps) {
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /** Floating address card: stays readable, does not span full screen width. */
  const addressCardMaxW = Math.min(440, Math.max(200, winW - 20));

  const startLat = Number.isFinite(initialLat as number) ? (initialLat as number) : DEFAULT_LAT;
  const startLng = Number.isFinite(initialLng as number) ? (initialLng as number) : DEFAULT_LNG;
  const googleApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  const mapboxToken = (
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    ''
  ).trim();

  const [draftLat, setDraftLat] = useState(startLat);
  const [draftLng, setDraftLng] = useState(startLng);
  const [mapReady, setMapReady] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const resolvedRef = useRef<{ lat: number; lng: number; address: GeocodedAddressPreview } | null>(null);
  const webRef = useRef<WebView | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftLat(startLat);
      setDraftLng(startLng);
      setMapReady(false);
      setPreviewText(null);
      setGeocodeError(null);
      resolvedRef.current = null;
    }
  }, [visible, startLat, startLng]);

  const html = useMemo(
    () => buildMapHtml(startLat, startLng, colors.primary, googleApiKey, mapboxToken),
    [startLat, startLng, colors.primary, googleApiKey, mapboxToken]
  );

  const onMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    applyPinPayload(e.nativeEvent.data, setDraftLat, setDraftLng);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !visible) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data && typeof data === 'object' && data.type === WEB_MAP_MESSAGE_TYPE) {
        applyPinPayload(data, setDraftLat, setDraftLng);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setGeocodeBusy(true);
      setGeocodeError(null);
      try {
        const res = await fetch(
          apiUrl(`/api/geocode/reverse?lat=${encodeURIComponent(draftLat)}&lng=${encodeURIComponent(draftLng)}`),
          { signal: ac.signal }
        );
        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          address?: GeocodedAddressPreview;
        };
        if (!res.ok || !data.success || !data.address) {
          throw new Error(data.message || 'Could not resolve this spot.');
        }
        const addr = data.address;
        setPreviewText(formatAddressCardLine(addr));
        resolvedRef.current = { lat: draftLat, lng: draftLng, address: addr };
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setPreviewText(null);
        resolvedRef.current = null;
        setGeocodeError(e instanceof Error ? e.message : 'Address lookup failed.');
      } finally {
        setGeocodeBusy(false);
      }
    }, 480);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [visible, draftLat, draftLng]);

  const handleMyLocation = useCallback(() => {
    if (Platform.OS === 'web') {
      const w = iframeRef.current?.contentWindow as (Window & { iassessLocateMe?: () => void }) | undefined;
      w?.iassessLocateMe?.();
      return;
    }
    webRef.current?.injectJavaScript(
      '(function(){try{if(window.iassessLocateMe)window.iassessLocateMe();}catch(e){}})();true;'
    );
  }, []);

  const handleConfirm = () => {
    const snap = resolvedRef.current;
    const finalCache =
      snap && pinsMatch(snap, { lat: draftLat, lng: draftLng }) && snap.address.municipality && snap.address.province
        ? snap.address
        : null;
    onConfirm(draftLat, draftLng, finalCache);
    onClose();
  };

  const mapFrame =
    Platform.OS === 'web' ? (
      createElement('iframe', {
        ref: (el: HTMLIFrameElement | null) => {
          iframeRef.current = el;
        },
        key: `${visible}-${startLat}-${startLng}`,
        srcDoc: html,
        title: 'Address map',
        style: {
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#e5e5e5',
        },
        onLoad: () => setMapReady(true),
      })
    ) : (
      <WebView
        ref={webRef}
        key={`${visible}-${startLat}-${startLng}`}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        onLoadEnd={() => setMapReady(true)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
      />
    );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: colors.contentBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Edit Address</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.mapWrap}>
            {!mapReady ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}
            {mapFrame}

            <View style={styles.floatingCardWrap} pointerEvents="box-none">
              <View
                style={[
                  styles.floatingCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    maxWidth: addressCardMaxW,
                  },
                ]}
              >
                <Text style={[styles.floatingCardLabel, { color: colors.textMuted }]}>Your Address Input</Text>
                {geocodeBusy ? (
                  <View style={styles.cardLoadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.cardLoadingText, { color: colors.textMuted }]}>Fetching address…</Text>
                  </View>
                ) : geocodeError ? (
                  <Text style={[styles.floatingCardAddress, { color: colors.textMuted }]}>{geocodeError}</Text>
                ) : previewText ? (
                  <Text style={[styles.floatingCardAddress, { color: colors.text }]} selectable>
                    {previewText}
                  </Text>
                ) : (
                  <Text style={[styles.floatingCardPlaceholder, { color: colors.textMuted }]}>
                    Move the map — your address will appear here
                  </Text>
                )}
                <Text style={[styles.floatingCardHint, { color: colors.textMuted }]}>
                  Pan or zoom, then Confirm. Save your profile afterward.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.locateFab, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={handleMyLocation}
              accessibilityLabel="Use my location"
            >
              <Ionicons name="locate" size={24} color={colors.primary} />
            </Pressable>
          </View>

          <View
            style={[
              styles.confirmBtnBar,
              {
                backgroundColor: colors.contentBg,
                borderTopColor: colors.border,
                paddingBottom: Math.max(8, insets.bottom + 6),
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }, geocodeBusy && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={geocodeBusy}
              activeOpacity={0.9}
            >
              <Text style={styles.confirmBtnText}>{geocodeBusy ? 'Fetching address...' : 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  mapWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: 0,
    position: 'relative',
  },
  webview: { flex: 1, backgroundColor: '#e5e5e5' },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  floatingCardWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 5,
    alignItems: 'flex-start',
  },
  floatingCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 3,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    minWidth: 120,
  },
  floatingCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  floatingCardAddress: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    flexShrink: 1,
  },
  floatingCardPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  floatingCardHint: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  cardLoadingRow: { flexDirection: 'row', alignItems: 'center' },
  cardLoadingText: { fontSize: 14, marginLeft: 8 },
  locateFab: {
    position: 'absolute',
    bottom: 48,
    right: 8,
    zIndex: 6,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  confirmBtnBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  confirmBtnDisabled: { opacity: 0.6 },
});
