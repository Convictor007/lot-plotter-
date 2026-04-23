import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import type { TiePoint } from '@/services/tiepoints.service';
import type { ParsedCorner, ScanReviewMeta } from '@/utils/ocr-utils';

export type ScanReviewModalProps = {
  visible: boolean;
  corners: ParsedCorner[];
  meta: ScanReviewMeta | null;
  /** Best row from `tiepoints-2025.json` for the document tie text (if any). */
  catalogMatch?: TiePoint | null;
  onDismiss: () => void;
  onApply: (corners: ParsedCorner[]) => void;
};

type DraftRow = ParsedCorner & { key: string };

function formatBearing(c: ParsedCorner): string {
  const d = (c.deg || '').padStart(2, '0');
  const m = (c.min || '').padStart(2, '0');
  return `${c.ns} ${d}° ${m}' ${c.ew}`;
}

export function ScanReviewModal({
  visible,
  corners,
  meta,
  catalogMatch = null,
  onDismiss,
  onApply,
}: ScanReviewModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const compact = windowWidth < 400;
  const maxContentWidth = Math.min(560, windowWidth);

  useEffect(() => {
    if (visible && corners.length > 0) {
      setDraft(
        corners.map((c, i) => ({
          ...c,
          key: `scan-${i}-${c.ns}-${c.deg}-${c.min}-${c.ew}-${c.distance}`,
        }))
      );
      setIsEditing(false);
    }
  }, [visible, corners]);

  /** No model names in UI (user preference); generic scan hint only. */
  const scanHint = useMemo(() => {
    if (!meta) return null;
    if (meta.extractionPath === 'tesseract') return 'Classic OCR — verify against your document';
    return 'AI-assisted scan — verify against your document';
  }, [meta]);

  const updateRow = (key: string, patch: Partial<ParsedCorner>) => {
    setDraft((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleApply = () => {
    const out: ParsedCorner[] = draft.map(({ ns, deg, min, ew, distance }) => ({
      ns,
      deg,
      min,
      ew,
      distance,
    }));
    onApply(out);
    onDismiss();
  };

  const lineLabel = (idx: number) =>
    idx === 0 && meta?.tiePointReference ? 'Line 1 · tie → C1' : `Line ${idx + 1}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.contentBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.cardBg }]}>
          <View style={[styles.headerInner, { maxWidth: maxContentWidth }]}>
            <View style={styles.headerTextBlock}>
              <Text style={[styles.title, { color: colors.text }]}>Review scan</Text>
              {scanHint ? (
                <Text style={[styles.subSource, { color: colors.textMuted }]} numberOfLines={2}>
                  {scanHint}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.iconBtn} accessibilityLabel="Close without applying">
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {meta?.warnings && meta.warnings.length > 0 ? (
            <View style={[styles.warnBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              {meta.warnings.map((w, i) => (
                <View key={i} style={styles.warnBulletRow}>
                  <Text style={[styles.warnBullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.warnText, { color: colors.text }]}>{w}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {meta?.tiePointReference ? (
            <View style={[styles.tieDocBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.tieDocTitle, { color: colors.textMuted }]}>Tie point (from document)</Text>
              <Text style={[styles.tieDocValue, { color: colors.text }]} selectable>
                {meta.tiePointReference}
              </Text>
              <Text style={[styles.tieDocHint, { color: colors.textMuted }]}>
                Line 1 is the bearing and distance from this monument to corner 1.
              </Text>
            </View>
          ) : null}

          {catalogMatch ? (
            <View style={[styles.catalogMatchBox, { backgroundColor: colors.cardBg, borderColor: colors.success }]}>
              <Ionicons name="checkmark-done-circle" size={26} color={colors.success} style={styles.catalogMatchIcon} />
              <View style={styles.catalogMatchTextCol}>
                <Text style={[styles.catalogMatchTitle, { color: colors.text }]}>Catalog tie found</Text>
                <Text style={[styles.catalogMatchName, { color: colors.text }]} numberOfLines={3}>
                  {catalogMatch.name}
                </Text>
                <Text style={[styles.catalogMatchLoc, { color: colors.textMuted }]}>
                  {catalogMatch.province} · {catalogMatch.municipality}
                </Text>
                <Text style={[styles.catalogMatchHint, { color: colors.textMuted }]}>
                  Province, municipality, and this tie point will be set when you tap OK.
                </Text>
              </View>
            </View>
          ) : meta?.tiePointReference ? (
            <View style={[styles.catalogMissBox, { backgroundColor: colors.cardBg, borderColor: colors.warning }]}>
              <Ionicons name="hand-left-outline" size={22} color={colors.warning} style={styles.catalogMatchIcon} />
              <View style={styles.catalogMatchTextCol}>
                <Text style={[styles.catalogMatchTitle, { color: colors.text }]}>No automatic map tie</Text>
                <Text style={[styles.catalogMatchHint, { color: colors.textMuted }]}>
                  The document tie did not match a row in the catalog. After OK, choose Province / Municipality / Tie Point
                  manually.
                </Text>
              </View>
            </View>
          ) : null}

          {isEditing ? (
            <View style={[styles.editModeBanner, { backgroundColor: colors.contentBg, borderColor: colors.primary }]}>
              <Ionicons name="options-outline" size={20} color={colors.primary} />
              <View style={styles.editModeBannerText}>
                <Text style={[styles.editModeBannerTitle, { color: colors.text }]}>Editing traverse lines</Text>
                <Text style={[styles.editModeBannerSub, { color: colors.textMuted }]}>
                  Fields shrink on narrow screens. Use Preview to verify how values read.
                </Text>
              </View>
            </View>
          ) : null}

          {draft.map((row, idx) => (
            <View
              key={row.key}
              style={[
                styles.rowCard,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
                isEditing && { borderLeftWidth: 3, borderLeftColor: colors.primary },
              ]}
            >
              <Text style={[styles.lineBadge, { color: colors.textMuted }]}>{lineLabel(idx)}</Text>

              {!isEditing ? (
                <View style={styles.previewRow}>
                  <Text
                    style={[styles.bearingPreview, { color: colors.text }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {formatBearing(row)}
                  </Text>
                  <View style={[styles.distPill, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
                    <Text style={[styles.distPillLabel, { color: colors.textMuted }]}>m</Text>
                    <Text style={[styles.distPillValue, { color: colors.text }]} numberOfLines={1}>
                      {row.distance}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.editWrap, compact && styles.editWrapStack]}>
                  <View style={[styles.editCluster, styles.editClusterNsEw]}>
                    <Text style={[styles.microLabel, { color: colors.textMuted }]}>NS</Text>
                    <View style={[styles.toggle, { backgroundColor: colors.contentBg }]}>
                      {(['N', 'S'] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[
                            styles.toggleBtn,
                            { borderColor: colors.border },
                            row.ns === v && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => updateRow(row.key, { ns: v })}
                        >
                          <Text style={[styles.toggleTxt, row.ns === v ? styles.toggleTxtActive : { color: colors.text }]}>
                            {v}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.editCluster}>
                    <Text style={[styles.microLabel, { color: colors.textMuted }]}>°</Text>
                    <TextInput
                      style={[
                        styles.inputShrink,
                        {
                          backgroundColor: colors.contentBg,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      value={row.deg}
                      onChangeText={(t) => updateRow(row.key, { deg: t.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.editCluster}>
                    <Text style={[styles.microLabel, { color: colors.textMuted }]}>′</Text>
                    <TextInput
                      style={[
                        styles.inputShrink,
                        {
                          backgroundColor: colors.contentBg,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      value={row.min}
                      onChangeText={(t) => updateRow(row.key, { min: t.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={[styles.editCluster, styles.editClusterNsEw]}>
                    <Text style={[styles.microLabel, { color: colors.textMuted }]}>EW</Text>
                    <View style={[styles.toggle, { backgroundColor: colors.contentBg }]}>
                      {(['E', 'W'] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[
                            styles.toggleBtn,
                            { borderColor: colors.border },
                            row.ew === v && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => updateRow(row.key, { ew: v })}
                        >
                          <Text style={[styles.toggleTxt, row.ew === v ? styles.toggleTxtActive : { color: colors.text }]}>
                            {v}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.editCluster, styles.editClusterGrow]}>
                    <Text style={[styles.microLabel, { color: colors.textMuted }]}>Distance (m)</Text>
                    <TextInput
                      style={[
                        styles.inputGrow,
                        {
                          backgroundColor: colors.contentBg,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      value={row.distance}
                      onChangeText={(t) => updateRow(row.key, { distance: t.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 14), borderTopColor: colors.border, backgroundColor: colors.cardBg },
          ]}
        >
          <View
            style={[
              styles.footerRow,
              compact && styles.footerRowStack,
              { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
            ]}
          >
            <View style={[styles.footerActionsRow, compact && styles.footerActionsRowStack]}>
              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.contentBg }]}
                onPress={onDismiss}
              >
                <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.contentBg }]}
                onPress={() => setIsEditing((e) => !e)}
              >
                <Ionicons name={isEditing ? 'eye-outline' : 'create-outline'} size={18} color={colors.text} />
                <Text style={[styles.btnSecondaryText, { color: colors.text, marginLeft: 6 }]}>
                  {isEditing ? 'Preview' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                compact && styles.btnPrimaryFull,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleApply}
            >
              <Text style={styles.btnPrimaryText}>OK — use values</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    alignSelf: 'center',
  },
  headerTextBlock: { flex: 1, paddingRight: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subSource: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  iconBtn: { padding: 6 },
  warnBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  warnBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  warnBullet: { fontSize: 16, lineHeight: 22, marginRight: 8, fontWeight: '700' },
  warnText: { flex: 1, fontSize: 14, lineHeight: 21 },
  tieDocBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  tieDocTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  tieDocValue: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  tieDocHint: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  catalogMatchBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 14,
  },
  catalogMissBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  catalogMatchIcon: { marginRight: 12, marginTop: 2 },
  catalogMatchTextCol: { flex: 1, minWidth: 0 },
  catalogMatchTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  catalogMatchName: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  catalogMatchLoc: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  catalogMatchHint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  editModeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  editModeBannerText: { flex: 1, minWidth: 0 },
  editModeBannerTitle: { fontSize: 14, fontWeight: '800' },
  editModeBannerSub: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  rowCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  lineBadge: { fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 0.2 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bearingPreview: {
    flex: 1,
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  distPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  distPillLabel: { fontSize: 12, fontWeight: '600' },
  distPillValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  editWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  editWrapStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  editCluster: {
    flexGrow: 0,
    flexShrink: 0,
  },
  editClusterGrow: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 100,
    alignSelf: 'stretch',
  },
  editClusterNsEw: {
    minWidth: 88,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggle: { flexDirection: 'row', borderRadius: 8, padding: 3, gap: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
    minWidth: 40,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleTxt: { fontSize: 15, fontWeight: '700' },
  toggleTxtActive: { color: '#fff' },
  /** Narrow numeric fields — shrink on small screens */
  inputShrink: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 48,
    width: 56,
    maxWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  /** Distance takes remaining width */
  inputGrow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 72,
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'nowrap',
  },
  footerRowStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  footerActionsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  footerActionsRowStack: {
    flex: 0,
    width: '100%',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '700' },
  btnPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 132,
  },
  btnPrimaryFull: {
    width: '100%',
    minWidth: undefined,
    marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
