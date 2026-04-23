/** iAssess - GIS Lot Plotter. CSV format: NS | Deg | Min | EW | Distance */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapModal from '@/components/gis/MapModal';
import { ScanReviewModal } from '@/components/ScanReviewModal';
import gisUtils from '@/utils/gis-utils';
import tiepointsService, { TiePoint, findBestTiePointMatch } from '@/services/tiepoints.service';
import { parseLotCsv } from '@/utils/csv-utils';
import type { ParsedCorner, ScanReviewMeta } from '@/utils/ocr-utils';
import { scanLandTitleImage } from '@/utils/ocr-utils';
import {
  isLotExportable,
  shareLotCsv,
  shareLotPdf,
  type LotCornerRow,
  type LotPolygonExport,
  type LotTieContext,
} from '@/utils/lot-export';

import { useTheme } from '@/contexts/ThemeContext';

// Remove fixed constants since we are using dynamic dropdowns
// const FIXED_PROVINCE = 'CAMARINES SUR';
// const FIXED_MUNICIPALITY = 'BALATAN';

interface Corner {
  id: string;
  line: number;
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
}

export default function LotPlotterScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');

  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');

  const [tiePoints, setTiePoints] = useState<TiePoint[]>([]);
  const [selectedTiePoint, setSelectedTiePoint] = useState<TiePoint | null>(null);

  /** Full-screen picker: province | municipality | tiepoint */
  const [pickerMode, setPickerMode] = useState<'province' | 'municipality' | 'tiepoint' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [csvFile, setCsvFile] = useState<string | null>(null);
  const [csvSectionExpanded, setCsvSectionExpanded] = useState(true);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [scanReviewVisible, setScanReviewVisible] = useState(false);
  const [reviewCorners, setReviewCorners] = useState<ParsedCorner[]>([]);
  const [reviewMeta, setReviewMeta] = useState<ScanReviewMeta | null>(null);
  const [pendingScanLabel, setPendingScanLabel] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  /** Monument / BLLM text extracted from the last successful AI scan (for cross-check with map tie point). */
  const [documentTieFromScan, setDocumentTieFromScan] = useState<string | null>(null);
  /** After scan apply: user-visible hint for catalog tie auto-match (or manual pick reminder). */
  const [autoTieMatchHint, setAutoTieMatchHint] = useState<string | null>(null);
  /** Best catalog tie for current review modal (from document text). */
  const [reviewCatalogMatch, setReviewCatalogMatch] = useState<TiePoint | null>(null);
  /**
   * When applying scan: select province/municipality/tie from catalog to match document wording.
   * Consumed inside location `useEffect`s so we do not overwrite with default municipality.
   */
  const pendingScanLocationRef = useRef<{
    province: string;
    municipality: string;
    tieId: string;
  } | null>(null);

  const [corners, setCorners] = useState<Corner[]>([]);
  const [polygon, setPolygon] = useState<any>(null);
  const [center, setCenter] = useState({ lat: 13.3155, lng: 123.2328 });
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const provs = tiepointsService.getProvinces();
    setProvinces(provs);
    if (provs.length > 0) {
      const defaultProv = provs.includes('CAMARINES SUR') ? 'CAMARINES SUR' : provs[0];
      setSelectedProvince(defaultProv);
    }
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const muns = tiepointsService.getMunicipalities(selectedProvince);
      setMunicipalities(muns);
      const pending = pendingScanLocationRef.current;
      if (pending && pending.province === selectedProvince && muns.includes(pending.municipality)) {
        setSelectedMunicipality(pending.municipality);
      } else if (muns.length > 0) {
        const defaultMun = selectedProvince === 'CAMARINES SUR' && muns.includes('BALATAN') ? 'BALATAN' : muns[0];
        setSelectedMunicipality(defaultMun);
      } else {
        setSelectedMunicipality('');
      }
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedProvince && selectedMunicipality) {
      const tps = tiepointsService.getTiePointsByLocation(selectedProvince, selectedMunicipality);
      setTiePoints(tps);
      const pending = pendingScanLocationRef.current;
      if (
        pending &&
        pending.province === selectedProvince &&
        pending.municipality === selectedMunicipality
      ) {
        const tp = tps.find((t) => t.id === pending.tieId) ?? null;
        pendingScanLocationRef.current = null;
        if (tp) {
          setSelectedTiePoint(tp);
          setCenter({ lat: tp.lat, lng: tp.lon });
          return;
        }
      }
      if (tps.length > 0) {
        setSelectedTiePoint(tps[0]);
        setCenter({ lat: tps[0].lat, lng: tps[0].lon });
      } else {
        setSelectedTiePoint(null);
      }
    }
  }, [selectedProvince, selectedMunicipality]);

  const handleTiePointSelect = (tiePoint: TiePoint) => {
    setSelectedTiePoint(tiePoint);
    setPickerMode(null);
    setPickerSearch('');
    setCenter({ lat: tiePoint.lat, lng: tiePoint.lon });
  };

  const openPicker = (mode: 'province' | 'municipality' | 'tiepoint') => {
    setPickerSearch('');
    setPickerMode(mode);
  };

  const closePicker = () => {
    setPickerMode(null);
    setPickerSearch('');
  };

  const filteredProvinces = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return provinces;
    return provinces.filter((p) => p.toLowerCase().includes(q));
  }, [provinces, pickerSearch]);

  const filteredMunicipalities = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return municipalities;
    return municipalities.filter((m) => m.toLowerCase().includes(q));
  }, [municipalities, pickerSearch]);

  const filteredTiePoints = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return tiePoints;
    return tiePoints.filter(
      (tp) =>
        tp.name.toLowerCase().includes(q) ||
        String(tp.zone).includes(q) ||
        String(tp.x).includes(q) ||
        String(tp.y).includes(q)
    );
  }, [tiePoints, pickerSearch]);

  const formatBearing = (ns: string, deg: string, min: string, ew: string): string => {
    const d = deg.padStart(2, '0');
    const m = min.padStart(2, '0');
    return `${ns} ${d}° ${m}' ${ew}`;
  };

  const addCorner = () => {
    const newCorner: Corner = {
      id: `corner-${Date.now()}`,
      line: corners.length + 1,
      ns: 'N',
      deg: '',
      min: '',
      ew: 'E',
      distance: '',
    };

    const updatedCorners = [...corners, newCorner];
    setCorners(updatedCorners);
    generatePolygon(updatedCorners);
  };

  const generatePolygon = (cornerPoints: Corner[], tieForComputation?: TiePoint | null) => {
    if (cornerPoints.length < 3) {
      setPolygon(null);
      return;
    }

    const tp = tieForComputation ?? selectedTiePoint;
    const originLat = tp != null ? tp.lat : center.lat;
    const originLng = tp != null ? tp.lon : center.lng;

    try {
      const boundaries = cornerPoints.map((corner) => ({
        id: corner.id,
        bearing: formatBearing(corner.ns, corner.deg, corner.min, corner.ew),
        distance: parseFloat(corner.distance) || 0,
        isTiePoint: corner.line === 1,
      }));

      const coordinates = gisUtils.generateLotPolygonFromTraverse(
        originLat,
        originLng,
        boundaries,
        tp?.x,
        tp?.y,
        tp?.zone
      );

      const { area, perimeter } = gisUtils.calculateLotAreaAndPerimeter(boundaries);
      const closureCheck = gisUtils.checkClosureError(
        boundaries,
        originLat,
        originLng,
        tp?.x,
        tp?.y,
        tp?.zone
      );

      setPolygon({
        coordinates,
        area,
        perimeter,
        isValid: closureCheck.isAcceptable,
        closureError: closureCheck.error,
      });
    } catch (error) {
      console.error('Error generating polygon:', error);
    }
  };

  const deleteCorner = (id: string) => {
    const updated = corners.filter((c) => c.id !== id).map((c, idx) => ({
      ...c,
      line: idx + 1,
    }));
    setCorners(updated);
    generatePolygon(updated);
  };

  const updateCorner = (
    id: string,
    patch: Partial<Pick<Corner, 'ns' | 'deg' | 'min' | 'ew' | 'distance'>>
  ) => {
    setCorners((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      generatePolygon(next);
      return next;
    });
  };

  const handleChooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileAsset = result.assets[0];
        setCsvFile(fileAsset.name);
        
        try {
          const parsed = await parseLotCsv(fileAsset.uri, (fileAsset as any).file);
          if (parsed.length > 0) {
            setDocumentTieFromScan(null);
            setAutoTieMatchHint(null);
            const newCorners = parsed.map((p, idx) => ({
              id: `csv-${Date.now()}-${idx}`,
              line: idx + 1,
              ns: p.ns,
              deg: p.deg,
              min: p.min,
              ew: p.ew,
              distance: p.distance,
            }));
            setCorners(newCorners);
            generatePolygon(newCorners);
            Alert.alert('Success', `Imported ${parsed.length} corners from CSV.`);
          } else {
            Alert.alert('No Data Found', 'Could not extract any valid corners from the CSV.');
          }
        } catch (parseErr) {
          Alert.alert('Parse Error', 'Failed to parse the CSV file.');
        }
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const applyReviewedCorners = (
    extractedCorners: ParsedCorner[],
    sourceFileLabel: string | null,
    tieFromDocument?: string | null
  ) => {
    if (extractedCorners.length === 0) return;
    const newCorners = extractedCorners.map((p, idx) => ({
      id: `ocr-${Date.now()}-${idx}`,
      line: idx + 1,
      ns: p.ns,
      deg: p.deg,
      min: p.min,
      ew: p.ew,
      distance: p.distance,
    }));
    const t = tieFromDocument?.trim();
    setDocumentTieFromScan(t && t.length > 0 ? t : null);

    const matched = t ? findBestTiePointMatch(t) : null;
    if (matched) {
      pendingScanLocationRef.current = {
        province: matched.province,
        municipality: matched.municipality,
        tieId: matched.id,
      };
      setSelectedProvince(matched.province);
      setSelectedMunicipality(matched.municipality);
      const sameLoc =
        selectedProvince === matched.province && selectedMunicipality === matched.municipality;
      if (sameLoc) {
        const tps = tiepointsService.getTiePointsByLocation(matched.province, matched.municipality);
        const tp = tps.find((x) => x.id === matched.id) ?? null;
        pendingScanLocationRef.current = null;
        if (tp) {
          setSelectedTiePoint(tp);
          setCenter({ lat: tp.lat, lng: tp.lon });
        }
      }
      setAutoTieMatchHint(
        `Catalog tie applied: ${matched.name}\n${matched.province} · ${matched.municipality}`
      );
    } else if (t) {
      pendingScanLocationRef.current = null;
      setAutoTieMatchHint(
        'No catalog match for the document tie — choose Province, Municipality, and Tie Point manually.'
      );
    } else {
      pendingScanLocationRef.current = null;
      setAutoTieMatchHint(null);
    }

    setCorners(newCorners);
    generatePolygon(newCorners, matched ?? undefined);
    if (sourceFileLabel) {
      setCsvFile(sourceFileLabel);
    }
  };

  const processOcrImage = async (uri: string) => {
    setIsOcrProcessing(true);
    try {
      const { corners: extractedCorners, meta } = await scanLandTitleImage(uri);

      if (extractedCorners.length > 0) {
        const uriParts = uri.split('/');
        const fileName = uriParts[uriParts.length - 1] || 'Scanned_Title.jpg';
        setPendingScanLabel(`OCR_Result_${fileName}`);
        setReviewCorners(extractedCorners);
        setReviewMeta(meta);
        const docTie = meta.tiePointReference?.trim();
        setReviewCatalogMatch(docTie ? findBestTiePointMatch(docTie) : null);
        setScanReviewVisible(true);
      } else {
        Alert.alert('No Data Found', 'Could not detect any survey lines in the image. Please try a clearer image or add manually.');
      }
    } catch (error: any) {
      Alert.alert('Scan Error', error.message || 'Failed to process the image.');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleCamera = async () => {
    setScanModalVisible(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Camera access is needed to scan land titles.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      processOcrImage(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    setScanModalVisible(false);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Photo gallery access is needed to upload land titles.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      processOcrImage(result.assets[0].uri);
    }
  };

  /** Recompute lot geometry from current tie point + corners (no separate Done button). */
  const handleDone = () => {
    if (corners.length < 3) {
      Alert.alert('Error', 'Add at least 3 survey lines (MON→C1 plus lot lines).');
      return;
    }
    generatePolygon(corners);
  };

  const exportCornerRows: LotCornerRow[] = useMemo(
    () =>
      corners.map((c) => ({
        line: c.line,
        ns: c.ns,
        deg: c.deg,
        min: c.min,
        ew: c.ew,
        distance: c.distance,
      })),
    [corners]
  );

  const lotPolygonForExport: LotPolygonExport | null = useMemo(() => {
    if (!polygon?.coordinates?.length) return null;
    return {
      coordinates: polygon.coordinates,
      area: polygon.area,
      perimeter: polygon.perimeter,
      isValid: polygon.isValid,
      closureError: polygon.closureError,
    };
  }, [polygon]);

  const canExportLot = useMemo(
    () => isLotExportable(exportCornerRows, lotPolygonForExport),
    [exportCornerRows, lotPolygonForExport]
  );

  const tieForExport: LotTieContext = useMemo(() => {
    if (!selectedTiePoint) return null;
    return {
      name: selectedTiePoint.name,
      province: selectedTiePoint.province,
      municipality: selectedTiePoint.municipality,
      lat: selectedTiePoint.lat,
      lon: selectedTiePoint.lon,
      zone: selectedTiePoint.zone,
      x: selectedTiePoint.x,
      y: selectedTiePoint.y,
    };
  }, [selectedTiePoint]);

  const closeExportModal = () => setExportModalVisible(false);

  const handleExport = () => {
    if (!canExportLot || !lotPolygonForExport) {
      Alert.alert(
        'Cannot export yet',
        'Enter bearings (deg/min, N/S, E/W) and a positive distance (meters) for every survey line, with at least three lines, so the lot boundary can be computed.'
      );
      return;
    }
    setExportModalVisible(true);
  };

  const runExportPdf = () => {
    const rows = exportCornerRows;
    const poly = lotPolygonForExport;
    if (!poly) return;
    closeExportModal();
    void shareLotPdf(rows, poly, tieForExport, documentTieFromScan).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Export failed', msg);
    });
  };

  const runExportCsv = () => {
    closeExportModal();
    void shareLotCsv(exportCornerRows).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Export failed', msg);
    });
  };

  const handleNew = () => {
    setCorners([]);
    setPolygon(null);
    setCsvFile(null);
    setDocumentTieFromScan(null);
    setAutoTieMatchHint(null);
    setReviewCatalogMatch(null);
    pendingScanLocationRef.current = null;
    setShowMap(false);
  };

  const mapPolygon = polygon
    ? {
        coordinates: polygon.coordinates,
        color: '#3b5998',
        fillColor: '#3b5998',
      }
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Lot Plotter</Text>
        <Text style={styles.subtitle}>Map and plot property boundaries.</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.sectionHeaderGray, { backgroundColor: colors.contentBg, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tie Point</Text>
          </View>

          <View style={styles.tiePointRow}>
            <View style={styles.tiePointCol}>
              <TouchableOpacity
                style={[styles.selectRowFull, { backgroundColor: colors.contentBg, borderColor: colors.border }]}
                onPress={() => openPicker('province')}
                activeOpacity={0.7}
              >
                <Text style={[styles.whiteDropdownText, { color: colors.text }]} numberOfLines={2}>
                  {selectedProvince || 'Select Province'}
                </Text>
                <Ionicons name="expand-outline" size={20} color="#3b5998" />
              </TouchableOpacity>
              <Text style={styles.tiePointLabel}>Province</Text>
            </View>
            <View style={styles.tiePointCol}>
              <TouchableOpacity
                style={[styles.selectRowFull, { backgroundColor: colors.contentBg, borderColor: colors.border }, municipalities.length === 0 && styles.disabled]}
                onPress={() => municipalities.length && openPicker('municipality')}
                disabled={!municipalities.length}
                activeOpacity={0.7}
              >
                <Text style={[styles.whiteDropdownText, { color: colors.text }]} numberOfLines={2}>
                  {selectedMunicipality || 'Select Municipality'}
                </Text>
                <Ionicons name="expand-outline" size={20} color="#3b5998" />
              </TouchableOpacity>
              <Text style={styles.tiePointLabel}>Municipality</Text>
            </View>
          </View>

          <View style={styles.tiePointNameRow}>
            <View style={styles.tiePointNameCol}>
              <TouchableOpacity
                style={[
                  styles.selectRowFull,
                  styles.selectRowTiePoint,
                  { backgroundColor: colors.contentBg, borderColor: colors.border },
                  tiePoints.length === 0 && styles.disabled,
                ]}
                onPress={() => tiePoints.length && openPicker('tiepoint')}
                disabled={!tiePoints.length}
                activeOpacity={0.7}
              >
                <View style={styles.tiePointNameTextWrap}>
                  <Text
                    style={[styles.tiePointNameText, { color: colors.text }]}
                    selectable
                  >
                    {selectedTiePoint ? selectedTiePoint.name : 'Select Tie Point'}
                  </Text>
                </View>
                <Ionicons name="expand-outline" size={20} color="#3b5998" style={styles.tiePointExpandIcon} />
              </TouchableOpacity>
              <Text style={[styles.tiePointLabel, { color: colors.textMuted }]}>Tie Point Name</Text>
            </View>
          </View>

          {selectedTiePoint && (
            <View style={[styles.tpDetailsContainer, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
              <View style={[styles.tpGridRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>Lat</Text>
                <Text
                  style={[styles.tpGridVal, { color: colors.text }]}
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {selectedTiePoint.lat.toFixed(6)}
                </Text>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>Lon</Text>
                <Text
                  style={[styles.tpGridVal, { color: colors.text }]}
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {selectedTiePoint.lon.toFixed(6)}
                </Text>
              </View>
              <View style={[styles.tpGridRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>Zone</Text>
                <Text style={[styles.tpGridVal, { color: colors.text }]} selectable>
                  {String(selectedTiePoint.zone)}
                </Text>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>—</Text>
                <Text style={[styles.tpGridVal, { color: colors.textMuted }]}>—</Text>
              </View>
              <View style={[styles.tpGridRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>E</Text>
                <Text
                  style={[styles.tpGridVal, { color: colors.text }]}
                  selectable
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {selectedTiePoint.x}
                </Text>
                <Text style={[styles.tpGridLbl, { color: colors.textMuted }]}>N</Text>
                <Text
                  style={[styles.tpGridVal, { color: colors.text }]}
                  selectable
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {selectedTiePoint.y}
                </Text>
              </View>
              <View style={[styles.tpGridRow, styles.tpGridRowLast, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tpGridFoot, { color: colors.textMuted }]} numberOfLines={2}>
                  PRS92 / TM · E/N in meters
                </Text>
              </View>
            </View>
          )}

          {documentTieFromScan ? (
            <View style={[styles.docTieBanner, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
              <Text style={[styles.docTieBannerLabel, { color: colors.textMuted }]}>Tie from scanned document</Text>
              <Text style={[styles.docTieBannerText, { color: colors.text }]}>{documentTieFromScan}</Text>
              <Text style={[styles.docTieBannerHint, { color: colors.textMuted }]}>
                Match this to the map tie point above when possible. Line 1 in the table is from this monument to corner 1.
              </Text>
            </View>
          ) : null}

          {autoTieMatchHint ? (
            <View
              style={[
                styles.autoTieHintBanner,
                {
                  backgroundColor: colors.contentBg,
                  borderColor: autoTieMatchHint.startsWith('Catalog') ? colors.success : colors.warning,
                },
              ]}
            >
              <Ionicons
                name={autoTieMatchHint.startsWith('Catalog') ? 'checkmark-circle' : 'alert-circle-outline'}
                size={20}
                color={autoTieMatchHint.startsWith('Catalog') ? colors.success : colors.warning}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.autoTieHintText, { color: colors.text }]}>{autoTieMatchHint}</Text>
            </View>
          ) : null}
        </View>

        {/* CSV Upload Section - Dropdown */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeaderMaroon}
            onPress={() => setCsvSectionExpanded(!csvSectionExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.csvDropdownHeader}>
              <Text style={styles.sectionTitleOnMaroon}>Upload / Scan Land Title</Text>
              <Text style={styles.viewFormatTextOnMaroon}>(CSV or Image)</Text>
            </View>
            <Ionicons
              name={csvSectionExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={'#fff'}
            />
          </TouchableOpacity>

          {csvSectionExpanded && (
            <>
              <View style={styles.uploadRow}>
                <TouchableOpacity style={[styles.chooseFileBtn, { backgroundColor: colors.cardBg }]} onPress={() => setScanModalVisible(true)} disabled={isOcrProcessing}>
                  <Ionicons name="cloud-upload-outline" size={14} color="#3b5998" style={{ marginRight: 4 }} />
                  <Text style={styles.chooseFileBtnText}>Upload File</Text>
                </TouchableOpacity>

                {isOcrProcessing && <ActivityIndicator size="small" color="#3b5998" />}

                {csvFile && !isOcrProcessing ? (
                  <View style={styles.fileNameContainer}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>
                      {csvFile}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setCsvFile(null);
                        setCorners([]);
                        setPolygon(null);
                        setDocumentTieFromScan(null);
                        setAutoTieMatchHint(null);
                      }}
                      style={styles.clearFileBtn}
                    >
                      <Ionicons name="close-circle" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>
                    {isOcrProcessing ? 'Analyzing Image...' : 'No file chosen'}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Data Table Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.dataTableSectionHeader, { backgroundColor: colors.contentBg, borderBottomColor: colors.border }]}>
            <Text style={[styles.dataTableSectionHeaderText, { color: colors.text }]}>Tie Point to Corner 1</Text>
          </View>

          {/* Wrap table in horizontal scroll so it never squishes on small screens */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ minWidth: 320, flex: 1 }}>
              {/* Table Header Row */}
              <View style={[styles.dataTableHeader, { backgroundColor: colors.contentBg, borderBottomColor: colors.border }]}>
                <View style={styles.colLine}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>Line</Text></View>
                <View style={styles.colDir}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>NS</Text></View>
                <View style={styles.colDegMin}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>Deg</Text></View>
                <View style={styles.colDegMin}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>Min</Text></View>
                <View style={styles.colDir}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>EW</Text></View>
                <View style={styles.colDist}><Text style={[styles.dataTableHeaderText, { color: colors.text }]}>Distance</Text></View>
                <View style={styles.colDel}><Text style={styles.dataTableHeaderText}></Text></View>
              </View>

              {/* Existing corners */}
              {corners.map((corner) => (
                <View key={corner.id} style={[styles.dataTableRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.colLine}>
                    <Text style={[styles.dataTableCell, { color: colors.text }]}>{corner.line}</Text>
                  </View>
                  
                  <View style={styles.colDir}>
                    <View style={[styles.directionToggle, { backgroundColor: colors.contentBg }]}>
                      <TouchableOpacity
                        style={[styles.dirBtn, corner.ns === 'N' && styles.dirBtnActive]}
                        onPress={() => updateCorner(corner.id, { ns: 'N' })}
                      >
                        <Text style={[styles.dirBtnText, corner.ns === 'N' && styles.dirBtnTextActive]}>N</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dirBtn, corner.ns === 'S' && styles.dirBtnActive]}
                        onPress={() => updateCorner(corner.id, { ns: 'S' })}
                      >
                        <Text style={[styles.dirBtnText, corner.ns === 'S' && styles.dirBtnTextActive]}>S</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.colDegMin}>
                    <TextInput
                      style={[styles.tableInput, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={corner.deg}
                      onChangeText={(t) => updateCorner(corner.id, { deg: t.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>

                  <View style={styles.colDegMin}>
                    <TextInput
                      style={[styles.tableInput, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={corner.min}
                      onChangeText={(t) => updateCorner(corner.id, { min: t.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>

                  <View style={styles.colDir}>
                    <View style={[styles.directionToggle, { backgroundColor: colors.contentBg }]}>
                      <TouchableOpacity
                        style={[styles.dirBtn, corner.ew === 'E' && styles.dirBtnActive]}
                        onPress={() => updateCorner(corner.id, { ew: 'E' })}
                      >
                        <Text style={[styles.dirBtnText, corner.ew === 'E' && styles.dirBtnTextActive]}>E</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dirBtn, corner.ew === 'W' && styles.dirBtnActive]}
                        onPress={() => updateCorner(corner.id, { ew: 'W' })}
                      >
                        <Text style={[styles.dirBtnText, corner.ew === 'W' && styles.dirBtnTextActive]}>W</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.colDist}>
                    <TextInput
                      style={[styles.tableInput, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      value={corner.distance}
                      onChangeText={(t) => updateCorner(corner.id, { distance: t.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.colDel}>
                    <TouchableOpacity onPress={() => deleteCorner(corner.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.deleteX}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity style={styles.yellowBtn} onPress={addCorner}>
              <Text style={styles.yellowBtnText}>Add Corner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.yellowBtn, corners.length < 3 && styles.btnDisabled]}
              onPress={() => {
                handleDone();
                setShowMap(true);
              }}
              disabled={corners.length < 3}
            >
              <Text style={styles.yellowBtnText}>View Map</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity
              style={[styles.yellowBtn, !canExportLot && styles.btnDisabled]}
              onPress={handleExport}
              disabled={!canExportLot}
            >
              <Text style={styles.yellowBtnText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.newBtn} onPress={handleNew}>
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen province / municipality / tie point pickers */}
      <Modal
        visible={pickerMode !== null}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
        onRequestClose={closePicker}
        statusBarTranslucent
      >
        <View style={[styles.pickerModalRoot, { paddingTop: insets.top, backgroundColor: colors.contentBg }]}>
          <View style={[styles.pickerHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              {pickerMode === 'province' && 'Select Province'}
              {pickerMode === 'municipality' && 'Select Municipality'}
              {pickerMode === 'tiepoint' && 'Select Tie Point'}
            </Text>
            <TouchableOpacity onPress={closePicker} style={styles.pickerCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.pickerSearch, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]}
            placeholder="Search…"
            placeholderTextColor={colors.textMuted}
            value={pickerSearch}
            onChangeText={setPickerSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {pickerMode === 'province' && (
            <FlatList
              style={styles.pickerList}
              data={filteredProvinces}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRow, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }, selectedProvince === item && styles.pickerRowSelected]}
                  onPress={() => {
                    setSelectedProvince(item);
                    closePicker();
                  }}
                >
                  <Text style={[styles.pickerRowText, { color: colors.text }, selectedProvince === item && styles.pickerRowTextSelected]}>{item}</Text>
                  {selectedProvince === item && <Ionicons name="checkmark-circle" size={22} color="#3b5998" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>No provinces match your search.</Text>}
            />
          )}
          {pickerMode === 'municipality' && (
            <FlatList
              style={styles.pickerList}
              data={filteredMunicipalities}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRow, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }, selectedMunicipality === item && styles.pickerRowSelected]}
                  onPress={() => {
                    setSelectedMunicipality(item);
                    closePicker();
                  }}
                >
                  <Text style={[styles.pickerRowText, { color: colors.text }, selectedMunicipality === item && styles.pickerRowTextSelected]}>{item}</Text>
                  {selectedMunicipality === item && <Ionicons name="checkmark-circle" size={22} color="#3b5998" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>No municipalities match your search.</Text>}
            />
          )}
          {pickerMode === 'tiepoint' && (
            <FlatList
              style={styles.pickerList}
              data={filteredTiePoints}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRowTie, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }, selectedTiePoint?.id === item.id && styles.pickerRowSelected]}
                  onPress={() => handleTiePointSelect(item)}
                >
                  <View style={styles.pickerTieTextBlock}>
                    <Text style={[styles.pickerRowText, { color: colors.text }, selectedTiePoint?.id === item.id && styles.pickerRowTextSelected]} numberOfLines={3}>
                      {item.name}
                    </Text>
                    <Text style={styles.pickerTieSub}>
                      Lat {item.lat.toFixed(6)} · Lon {item.lon.toFixed(6)} · Zone {item.zone} · X {item.x} · Y {item.y}
                    </Text>
                  </View>
                  {selectedTiePoint?.id === item.id && <Ionicons name="checkmark-circle" size={22} color="#3b5998" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>No tie points match your search.</Text>}
            />
          )}
        </View>
      </Modal>

      {/* GIS Map Modal - opened via View Map */}
      <MapModal
        visible={showMap && !!polygon}
        onClose={() => setShowMap(false)}
        center={center}
        zoom={17}
        polygon={mapPolygon}
        area={polygon?.area}
        showAreaLabel={true}
      />

      <ScanReviewModal
        visible={scanReviewVisible}
        corners={reviewCorners}
        meta={reviewMeta}
        catalogMatch={reviewCatalogMatch}
        onDismiss={() => {
          setScanReviewVisible(false);
          setReviewCorners([]);
          setReviewMeta(null);
          setReviewCatalogMatch(null);
          setPendingScanLabel(null);
        }}
        onApply={(finalCorners) => {
          applyReviewedCorners(finalCorners, pendingScanLabel, reviewMeta?.tiePointReference);
          setScanReviewVisible(false);
          setReviewCorners([]);
          setReviewMeta(null);
          setReviewCatalogMatch(null);
          setPendingScanLabel(null);
        }}
      />

      {/* Export format (PDF / CSV) */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeExportModal}
      >
        <View style={styles.scanModalOverlay}>
          <View style={[styles.scanModalContent, { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }]}>
            <View style={styles.scanModalHeader}>
              <Text style={[styles.scanModalTitle, { color: colors.text }]}>Export lot</Text>
              <TouchableOpacity onPress={closeExportModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.exportModalDesc, { color: colors.textMuted }]}>
              Choose a file format. PDF includes a map image (when a Maps API key is configured), tie details, and the traverse table.
              {Platform.OS === 'web' ?
                ' On the web, the PDF downloads directly (html2canvas + jsPDF), so the file does not include browser URL or date headers. Do not use the browser Print dialog for export if you want a clean PDF.'
              : ''}
            </Text>
            <TouchableOpacity
              style={[styles.exportFormatRow, { backgroundColor: colors.contentBg, borderColor: colors.border }]}
              onPress={runExportPdf}
              activeOpacity={0.75}
            >
              <Ionicons name="document-text-outline" size={26} color="#3b5998" />
              <View style={styles.exportFormatTextCol}>
                <Text style={[styles.exportFormatTitle, { color: colors.text }]}>PDF report</Text>
                <Text style={[styles.exportFormatSub, { color: colors.textMuted }]}>
                  {Platform.OS === 'web' ? 'Download PDF (map + table)' : 'Map snapshot, summary, bearings table'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportFormatRow, { backgroundColor: colors.contentBg, borderColor: colors.border }]}
              onPress={runExportCsv}
              activeOpacity={0.75}
            >
              <Ionicons name="grid-outline" size={26} color="#3b5998" />
              <View style={styles.exportFormatTextCol}>
                <Text style={[styles.exportFormatTitle, { color: colors.text }]}>CSV (traverse)</Text>
                <Text style={[styles.exportFormatSub, { color: colors.textMuted }]}>Line, N/S, deg, min, E/W, distance (m)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportModalCancelWrap} onPress={closeExportModal} activeOpacity={0.7}>
              <Text style={[styles.exportModalCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload File Modal */}
      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScanModalVisible(false)}
      >
        <View style={styles.scanModalOverlay}>
          <View style={[styles.scanModalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.scanModalHeader}>
              <Text style={[styles.scanModalTitle, { color: colors.text }]}>Upload Data</Text>
              <TouchableOpacity onPress={() => setScanModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.scanModalDesc}>Select a method to upload or scan land title coordinates.</Text>
            
            <View style={styles.scanModalActions}>
              <TouchableOpacity style={[styles.scanActionBtn, { backgroundColor: colors.contentBg, borderColor: colors.border }]} onPress={handleCamera}>
                <Ionicons name="camera-outline" size={32} color="#3b5998" />
                <Text style={[styles.scanActionText, { color: colors.text }]}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.scanActionBtn, { backgroundColor: colors.contentBg, borderColor: colors.border }]} onPress={handleGallery}>
                <Ionicons name="images-outline" size={32} color="#3b5998" />
                <Text style={[styles.scanActionText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.scanActionBtn, { backgroundColor: colors.contentBg, borderColor: colors.border }]} onPress={() => { setScanModalVisible(false); handleChooseFile(); }}>
                <Ionicons name="document-text-outline" size={32} color="#3b5998" />
                <Text style={[styles.scanActionText, { color: colors.text }]}>Upload CSV</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeaderGray: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  sectionHeaderMaroon: {
    backgroundColor: '#3b5998', // Keep primary color
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  csvDropdownHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitleOnMaroon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewFormatTextOnMaroon: {
    fontSize: 12,
    color: '#e8c999',
    textDecorationLine: 'underline',
  },
  tiePointRow: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 6,
    gap: 12,
  },
  tiePointCol: {
    flex: 1,
  },
  tiePointNameRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tiePointNameCol: {
    flex: 1,
  },
  selectRowFull: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
  },
  /** Full-width tie name: text wraps vertically; icon stays top-right */
  selectRowTiePoint: {
    alignItems: 'flex-start',
    minHeight: 52,
  },
  tiePointNameTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  tiePointNameText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  tiePointExpandIcon: {
    marginTop: 2,
  },
  whiteDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  whiteDropdownText: {
    fontSize: 13,
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  tiePointLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  pickerModalRoot: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  pickerCloseBtn: {
    padding: 4,
  },
  pickerList: {
    flex: 1,
  },
  pickerSearch: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  pickerListContent: {
    paddingBottom: 24,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowTie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowSelected: {
    backgroundColor: 'rgba(59, 89, 152, 0.08)', // using primary color
  },
  pickerRowText: {
    fontSize: 16,
    flex: 1,
    paddingRight: 8,
  },
  pickerRowTextSelected: {
    fontWeight: '600',
    color: '#3b5998', // Keep primary color
  },
  pickerTieTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  pickerTieSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    lineHeight: 16,
  },
  pickerEmpty: {
    textAlign: 'center',
    color: '#888',
    padding: 24,
    fontSize: 15,
  },
  tpDetailsContainer: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /** 4 columns × 4 rows — compact tie point coordinates */
  tpGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tpGridLbl: {
    width: '18%',
    maxWidth: 44,
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 2,
  },
  tpGridVal: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 4,
    paddingRight: 4,
  },
  tpGridRowLast: {
    borderBottomWidth: 0,
    minHeight: 26,
  },
  tpGridFoot: {
    flex: 1,
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    lineHeight: 12,
  },
  docTieBanner: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  docTieBannerLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  docTieBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  docTieBannerHint: {
    fontSize: 10,
    marginTop: 8,
    lineHeight: 14,
  },
  autoTieHintBanner: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  autoTieHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  chooseFileBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b5998',
  },
  chooseFileBtnText: {
    color: '#3b5998',
    fontSize: 12,
    fontWeight: '600',
  },
  fileNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearFileBtn: {
    padding: 2,
    marginLeft: 4,
  },
  fileName: {
    color: '#555',
    fontSize: 12,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
  },
  checkboxChecked: {
    backgroundColor: '#3b5998',
    borderColor: '#3b5998',
  },
  checkboxText: {
    color: '#555',
    fontSize: 13,
  },
  uploadFileBtn: {
    backgroundColor: '#3b5998',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  uploadFileBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dataTableSectionHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  dataTableSectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dataTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  dataTableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dataTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  colLine: { flex: 0.5, alignItems: 'center', justifyContent: 'center' },
  colDir: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },
  colDegMin: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  colDist: { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  colDel: { flex: 0.5, alignItems: 'center', justifyContent: 'center' },
  dataTableCell: {
    fontSize: 13,
  },
  deleteX: {
    color: '#dc3545', // Keep error color
    fontSize: 20,
    fontWeight: 'bold',
    padding: 4,
  },
  directionToggle: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: 4,
    padding: 2,
  },
  dirBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    minWidth: 24,
    borderRadius: 3,
  },
  dirBtnActive: {
    backgroundColor: '#3b5998', // Keep primary color
  },
  dirBtnText: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dirBtnTextActive: {
    color: '#fff',
  },
  tableInput: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 14,
    textAlign: 'center',
    borderRadius: 6,
    borderWidth: 1,
    width: '100%',
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  leftButtons: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
    flexWrap: 'wrap',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  yellowBtn: {
    backgroundColor: '#e8c999',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  yellowBtnText: {
    color: '#3b5998', // Keep primary color
    fontSize: 13,
    fontWeight: 'bold',
  },
  newBtn: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  newBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scanModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanModalContent: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  scanModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanModalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  scanModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  scanActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  scanActionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  exportModalDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  exportFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 4,
  },
  exportFormatTextCol: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  exportFormatTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  exportFormatSub: {
    fontSize: 12,
    marginTop: 2,
  },
  exportModalCancelWrap: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  exportModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b5998',
  },
  scanBtnText: {
    color: '#3b5998',
    fontSize: 12,
    fontWeight: '600',
  },
});
