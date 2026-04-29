import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { useTheme } from '@/contexts/ThemeContext';
import { useNewRequest } from '@/contexts/NewRequestContext';
import { apiUrl } from '@/lib/api/api-url';
import { getAuthToken } from '@/lib/authSession';
import { AddressMapPickerModal, type GeocodedAddressPreview } from '@/components/profile/AddressMapPickerModal';

// Constants based on the extracted documents
const ASSESSMENT_TRANSACTIONS = [
  { id: 'transfer', title: 'Transfer of Ownership WITHOUT TITLE' },
  { id: 'transfer_with_title', title: 'Transfer of Ownership WITH TITLE' },
  { id: 'transfer_denr_handog', title: 'Transfer of Ownership - HANDOG TITULO' },
  { id: 'appraisal_land_first_time', title: 'Appraisal of Land Declared FIRST TIME' }
];

const CERTIFICATION_TRANSACTIONS = [
  { id: 'certified_true_copy', title: 'Certified True Copy of Tax Declaration' },
  { id: 'certificate_landholdings', title: 'Certificate of Landholdings' }
];

const ALL_TRANSACTION_TYPES = [...ASSESSMENT_TRANSACTIONS, ...CERTIFICATION_TRANSACTIONS];

const REQUIREMENTS: Record<string, string[]> = {
  transfer: [
    '3 copies - Document(s) (Sale, Donation, Segregation, Extra judicial settlement, etc) Registered with the Register of Deeds (ROD)',
    '3 copies - Latest Tax Declaration subject for transfer (Masso)',
    '3 copies - Payment of transfer tax (1/2 of 1% of fair market value or consideration whichever is higher at PTO)',
    '3 copies - Certificate of Tax payment (from current year and previous year from MTO)',
    '3 copies - Authenticated Xerox copy of Certificate Authorizing Registration (CAR) from the BIR',
    'Special Power of Attorney (SPA), if the person transacting is not a party to the transaction'
  ],
  transfer_with_title: [
    '1 copy - Electronic Copy of Title',
    '3 copies - Document(s) (Sale, Donation, Segregation, Extra judicial settlement, etc) Certified copy with the Register of Deeds (ROD)',
    '3 copies - Latest Tax Declaration subject for transfer (Masso)',
    '3 copies - Payment of transfer tax (1/2 of 1% of fair market value or consideration)',
    '3 copies - Certificate of Tax payment (from current year and previous year from MTO)',
    '3 copies - Authenticated Xerox copy of Certificate Authorizing Registration (CAR) from the BIR',
    'Special Power of Attorney (SPA), if applicable'
  ],
  transfer_denr_handog: [
    '1 copy - Electronic copy of Title (ROD Naga City)',
    '3 copies - Document(s) certified true copy (Sale, Donation, Segregation, Extra judicial settlement, etc)',
    '3 copies - Latest Tax Declaration subject for transfer (Masso)',
    '3 copies - Payment of transfer tax (1/2 of 1% of fair market value or consideration)',
    '3 copies - Certificate of Tax payment (from current year and previous year from MTO)',
    'Special Power of Attorney (SPA), if applicable'
  ],
  appraisal_land_first_time: [
    'A survey plan prepared by a duly licensed Geodetic Engineer duly approved by the LMB of DENR or Cadastral Map duly certified by DENR',
    'A certification from the CENRO, stating that the land is within the alienable and disposable area',
    'An affidavit of ownership and/or Sworn Statement declaring the Market Value of Real Property',
    'A certification from the Barangay captain that declarant is the present possessor and occupant',
    'An ocular inspection/investigation report by the assessor or his authorized representative',
    'Special Power of Attorney (SPA), if applicable'
  ],
  certified_true_copy: [
    'Authorization or Special Power of Attorney (SPA) from the Registered Owner(s) or compulsory heirs',
    'Valid ID of the requesting party',
    'Purpose of request must be indicated in the notes'
  ],
  certificate_landholdings: [
    'Authorization or Special Power of Attorney (SPA) from the Registered Owner(s) or compulsory heirs',
    'Valid ID of the requesting party',
    'Purpose of request must be indicated in the notes'
  ]
};

export default function NewRequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { step, setStep } = useNewRequest();
  
  // State for the Multi-step Form
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    applicantName: '',
    pin: '', // Property Index Number
    streetName: '',
    location: '',
    barangay: '',
    notes: ''
  });
  
  // Store uploaded files per requirement index
  const [uploadedDocs, setUploadedDocs] = useState<Record<number, DocumentPicker.DocumentPickerAsset>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [taxDecInput, setTaxDecInput] = useState('');
  const [taxDeclarations, setTaxDeclarations] = useState<string[]>([]);
  const formInputBg = colors.contentBg;
  const formInputBorder = colors.border;
  const formInputText = colors.text;
  const formPlaceholder = colors.textMuted;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(apiUrl('/api/users/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          success?: boolean;
          user?: {
            first_name?: string;
            last_name?: string;
            barangay?: string | null;
            municipality?: string | null;
          };
        };
        if (cancelled || !res.ok || !json.success || !json.user) return;
        const first = (json.user.first_name || '').trim();
        const last = (json.user.last_name || '').trim();
        const applicant = [first, last].filter(Boolean).join(' ');
        const barangay = (json.user.barangay || '').trim();
        const municipality = (json.user.municipality || '').trim();

        setFormData((prev) => ({
          ...prev,
          applicantName: prev.applicantName.trim() ? prev.applicantName : applicant,
          streetName: prev.streetName.trim() ? prev.streetName : ((json.user as any).street_address || '').trim(),
          barangay: prev.barangay.trim() ? prev.barangay : barangay,
          location: prev.location.trim() ? prev.location : municipality,
        }));
      } catch {
        //
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNext = () => {
    if (step === 1 && !selectedType) {
      Alert.alert('Error', 'Please select a transaction type first.');
      return;
    }
    if (step === 2 && (!formData.applicantName || taxDeclarations.length === 0)) {
      Alert.alert('Error', "Owner's name and at least one Tax Declaration Number are required.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const addTaxDeclaration = () => {
    const value = taxDecInput.trim();
    if (!value) {
      Alert.alert('Missing value', 'Enter a tax declaration number first.');
      return;
    }
    if (taxDeclarations.includes(value)) {
      Alert.alert('Duplicate', 'This tax declaration number is already in the list.');
      return;
    }
    const next = [...taxDeclarations, value];
    setTaxDeclarations(next);
    setTaxDecInput('');
    setFormData((prev) => ({ ...prev, pin: next[0] || prev.pin }));
  };

  const removeTaxDeclaration = (idx: number) => {
    const next = taxDeclarations.filter((_, i) => i !== idx);
    setTaxDeclarations(next);
    setFormData((prev) => ({ ...prev, pin: next[0] || '' }));
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const pickDocument = async (index: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all files (pdf, images, etc)
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadedDocs(prev => ({
          ...prev,
          [index]: result.assets[0]
        }));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const removeDocument = (index: number) => {
    setUploadedDocs(prev => {
      const newState = { ...prev };
      delete newState[index];
      return newState;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Construct the payload mapping to the TransactionRequest interface
    const payload = {
      type: selectedType,
      propertyId: taxDeclarations[0] || formData.pin,
      status: 'pending',
      notes: JSON.stringify({
        remarks: formData.notes || null,
        taxDeclarations,
      }),
      applicantName: formData.applicantName,
      location: [formData.streetName.trim(), formData.barangay.trim(), formData.location.trim()].filter(Boolean).join(', '),
      // Pass metadata about uploaded docs to the API
      documentsVerified: Object.keys(uploadedDocs).reduce((acc: any, key) => {
        acc[key] = {
          name: uploadedDocs[Number(key)].name,
          uri: uploadedDocs[Number(key)].uri,
          mimeType: uploadedDocs[Number(key)].mimeType
        };
        return acc;
      }, {}),
      submittedAt: new Date().toISOString()
    };

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl('/api/transactions'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit request');
      }
      
      const transactionCode = result.data?.id || `TXN-${Date.now()}`;
      
      Alert.alert(
        'Submission Successful', 
        `Your transaction request has been submitted.\n\nTransaction Code: ${transactionCode}\n\nPlease save this code to track your request.`, 
        [{ text: 'OK', onPress: () => router.push('/(main)/section/request') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyGeocodedAddress = (addr: GeocodedAddressPreview | null | undefined) => {
    if (!addr) return;
    const streetFallback =
      (addr.formatted || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)[0] || '';
    setFormData((prev) => ({
      ...prev,
      streetName: (addr.street || '').trim() || streetFallback || prev.streetName,
      barangay: (addr.barangay || '').trim() || prev.barangay,
      location: (addr.municipality || '').trim() || prev.location,
    }));
  };

  const resolveAndApplyAddress = async (
    lat: number,
    lng: number,
    preview: GeocodedAddressPreview | null
  ) => {
    setMapLat(lat);
    setMapLng(lng);
    if (preview?.municipality || preview?.barangay || preview?.street) {
      applyGeocodedAddress(preview);
      return;
    }
    try {
      const res = await fetch(
        apiUrl(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
      );
      const json = (await res.json()) as {
        success?: boolean;
        address?: GeocodedAddressPreview;
      };
      if (res.ok && json.success && json.address) {
        applyGeocodedAddress(json.address);
      }
    } catch {
      //
    }
  };

  // ---------------------------------------------------------
  // Render Steps
  // ---------------------------------------------------------

  const renderStep1 = () => (
    <View style={[styles.stepContent, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Select Transaction Type</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Choose the category and type of transaction.</Text>
      
      <Text style={styles.categoryTitle}>Assessment Transactions</Text>
      {ASSESSMENT_TRANSACTIONS.map((t) => (
        <TouchableOpacity 
          key={t.id} 
          style={[styles.typeCard, { borderColor: colors.border }, selectedType === t.id && styles.typeCardActive]}
          onPress={() => {
            setSelectedType(t.id);
            setUploadedDocs({});
          }}
        >
          <View style={styles.radioContainer}>
            <View style={[styles.radioOuter, selectedType === t.id && styles.radioOuterActive]}>
              {selectedType === t.id && <View style={styles.radioInner} />}
            </View>
          </View>
          <Text style={[styles.typeTitle, { color: colors.text }, selectedType === t.id && styles.typeTitleActive]}>
            {t.title}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.categoryTitle, { marginTop: 10 }]}>Certifications</Text>
      {CERTIFICATION_TRANSACTIONS.map((t) => (
        <TouchableOpacity 
          key={t.id} 
          style={[styles.typeCard, { borderColor: colors.border }, selectedType === t.id && styles.typeCardActive]}
          onPress={() => {
            setSelectedType(t.id);
            setUploadedDocs({});
          }}
        >
          <View style={styles.radioContainer}>
            <View style={[styles.radioOuter, selectedType === t.id && styles.radioOuterActive]}>
              {selectedType === t.id && <View style={styles.radioInner} />}
            </View>
          </View>
          <Text style={[styles.typeTitle, { color: colors.text }, selectedType === t.id && styles.typeTitleActive]}>
            {t.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep2 = () => (
    <View style={[styles.stepContent, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
      <Text style={[styles.sectionTitle, styles.formCenterTitle, { color: colors.text }]}>PROPERTY INFORMATION</Text>

      <View style={[styles.propertyFormShell, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.formMicroLabel, { color: colors.textMuted }]}>Required Field</Text>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Owner's Name *</Text>
          <TextInput
            style={[styles.input, styles.slimInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Owner's Name"
            placeholderTextColor={formPlaceholder}
            value={formData.applicantName}
            onChangeText={(text) => setFormData({ ...formData, applicantName: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Tax Declaration Number *</Text>
          <View style={styles.taxDecRow}>
            <TextInput
              style={[styles.input, styles.slimInput, styles.taxDecInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
              placeholder="Tax Declaration Number"
              placeholderTextColor={formPlaceholder}
              value={taxDecInput}
              onChangeText={setTaxDecInput}
            />
            <TouchableOpacity style={styles.taxDecActionBtn} activeOpacity={0.85} onPress={addTaxDeclaration}>
              <Text style={styles.taxDecActionBtnText}>Add Tax Dec</Text>
            </TouchableOpacity>
          </View>
          {taxDeclarations.length > 0 ? (
            <View style={[styles.taxDecTable, { borderColor: colors.border }]}>
              <View style={styles.taxDecTableHeader}>
                <Text style={[styles.taxDecTableHeaderTxt, styles.taxDecNumCol]}>#</Text>
                <Text style={[styles.taxDecTableHeaderTxt, styles.taxDecValCol]}>Tax Declaration No.</Text>
                <Text style={[styles.taxDecTableHeaderTxt, styles.taxDecActionCol]}>Action</Text>
              </View>
              {taxDeclarations.map((td, idx) => (
                <View key={`${td}-${idx}`} style={[styles.taxDecTableRow, { borderTopColor: colors.border, backgroundColor: formInputBg }]}>
                  <Text style={[styles.taxDecCellTxt, styles.taxDecNumCol, { color: colors.text }]}>{idx + 1}.</Text>
                  <Text style={[styles.taxDecCellTxt, styles.taxDecValCol, { color: colors.text }]} numberOfLines={1}>{td}</Text>
                  <View style={styles.taxDecActionCol}>
                    <TouchableOpacity style={styles.taxDecRemoveBtn} onPress={() => removeTaxDeclaration(idx)}>
                      <Text style={styles.taxDecRemoveBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <TouchableOpacity style={styles.mapPickBtn} onPress={() => setShowAddressPicker(true)} activeOpacity={0.85}>
            <Ionicons name="map-outline" size={16} color="#fff" />
            <Text style={styles.mapPickBtnText}>Pick Address from Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid3}>
          <TextInput
            style={[styles.input, styles.slimInput, styles.gridInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Unit No."
            placeholderTextColor={formPlaceholder}
          />
          <TextInput
            style={[styles.input, styles.slimInput, styles.gridInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Lot No."
            placeholderTextColor={formPlaceholder}
          />
          <TextInput
            style={[styles.input, styles.slimInput, styles.gridInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Block No."
            placeholderTextColor={formPlaceholder}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, styles.slimInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Street Name"
            placeholderTextColor={formPlaceholder}
            value={formData.streetName}
            onChangeText={(text) => setFormData({ ...formData, streetName: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Location *</Text>
          <TextInput
            style={[styles.input, styles.slimInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Municipality"
            placeholderTextColor={formPlaceholder}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Barangay *</Text>
          <TextInput
            style={[styles.input, styles.slimInput, { backgroundColor: formInputBg, color: formInputText, borderColor: formInputBorder }]}
            placeholder="Please Select Barangay"
            placeholderTextColor={formPlaceholder}
            value={formData.barangay}
            onChangeText={(text) => setFormData({ ...formData, barangay: text })}
          />
        </View>

      </View>
    </View>
  );

  const renderStep3 = () => {
    if (!selectedType) return null;
    const reqs = REQUIREMENTS[selectedType];

    return (
      <View style={[styles.stepContent, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Documentary Requirements</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Upload the required documents. The processing of the transaction will commence only upon submission of COMPLETE DOCUMENTS.
        </Text>
        
        <View style={styles.checklistContainer}>
          {reqs.map((req, index) => {
            const file = uploadedDocs[index];
            return (
              <View key={index} style={[styles.uploadItem, { borderBottomColor: colors.border }]}>
                <View style={styles.reqLeft}>
                  <View style={[styles.reqIndexBadge, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
                    <Text style={[styles.reqIndexText, { color: colors.text }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.uploadItemText, { color: colors.text }]}>{req}</Text>
                </View>

                <View style={styles.reqRight}>
                  {file ? (
                    <View style={[styles.fileAttachedContainer, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
                      <Ionicons name="document-text" size={20} color="#3b5998" />
                      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                        {file.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeDocument(index)} style={styles.removeBtn}>
                        <Ionicons name="close-circle" size={20} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickDocument(index)}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.uploadBtnText}>Upload File</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep4 = () => {
    const selectedTypeTitle = ALL_TRANSACTION_TYPES.find(t => t.id === selectedType)?.title;
    const reqsCount = REQUIREMENTS[selectedType!]?.length || 0;
    const checkedCount = Object.keys(uploadedDocs).length;
    const reqs = REQUIREMENTS[selectedType!]?.slice() ?? [];
    const missingCount = Math.max(0, reqsCount - checkedCount);
    const allDocsComplete = reqsCount > 0 ? checkedCount >= reqsCount : true;
    const progressPct = reqsCount > 0 ? Math.max(0, Math.min(1, checkedCount / reqsCount)) : 1;
    const locationText = [formData.streetName, formData.barangay, formData.location].filter(Boolean).join(', ') || 'N/A';

    return (
      <View style={[styles.stepContent, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Review & Submit</Text>

        <View style={[styles.reviewCard, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
          <Text style={[styles.reviewCardTitle, { color: colors.text }]}>Transaction Information</Text>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Type</Text>
            <Text style={[styles.reviewValue, { color: colors.text }]} numberOfLines={2}>
              {selectedTypeTitle || '—'}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Applicant</Text>
            <Text style={[styles.reviewValue, { color: colors.text }]} numberOfLines={2}>
              {formData.applicantName || '—'}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Tax Declarations</Text>
            <Text style={[styles.reviewValue, { color: colors.text }]} numberOfLines={2}>
              {taxDeclarations.length > 0 ? taxDeclarations.join(', ') : '—'}
            </Text>
          </View>
          <View style={[styles.reviewRow, { marginBottom: 0 }]}>
            <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Location</Text>
            <Text style={[styles.reviewValue, { color: colors.text }]} numberOfLines={3}>
              {locationText}
            </Text>
          </View>
        </View>

        <View style={[styles.reviewCard, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
          <View style={styles.docsHeaderRow}>
            <Text style={[styles.reviewCardTitle, { color: colors.text, marginBottom: 0 }]}>Documentary Requirements</Text>
            <View style={styles.docsHeaderMeta}>
              <Text
                style={[
                  styles.docsCountText,
                  { color: allDocsComplete ? '#2ecc71' : '#e74c3c' },
                ]}
              >
                {checkedCount} / {reqsCount}
              </Text>
            </View>
          </View>

          <View style={[styles.docsProgressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.docsProgressFill, { width: `${Math.round(progressPct * 100)}%`, backgroundColor: allDocsComplete ? '#2ecc71' : '#3b5998' }]} />
          </View>

          <View style={styles.docsList}>
            {reqs.map((req, index) => {
              const file = uploadedDocs[index];
              const ok = Boolean(file);
              return (
                <View key={index} style={[styles.docsItemRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.docsItemLeft}>
                    <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? '#2ecc71' : colors.textMuted} />
                    <Text style={[styles.docsReqText, { color: colors.text }]} numberOfLines={3}>
                      {req}
                    </Text>
                  </View>
                  <Text style={[styles.docsStatusText, { color: ok ? '#2ecc71' : '#e74c3c' }]}>
                    {ok ? 'Uploaded' : 'Missing'}
                  </Text>
                </View>
              );
            })}
          </View>

          {!allDocsComplete && (
            <Text style={styles.warningText}>
              {missingCount} missing document{missingCount === 1 ? '' : 's'}. Please complete uploads before submitting.
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
        {step > 1 ? (
          <TouchableOpacity style={[styles.buttonOutline, { borderColor: colors.border }]} onPress={handleBack}>
            <Text style={[styles.buttonOutlineText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        
        {step < 4 ? (
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleNext}>
            <Text style={styles.buttonPrimaryText}>Next Step</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.buttonSubmit,
              { backgroundColor: Object.keys(uploadedDocs).length < (REQUIREMENTS[selectedType!]?.length || 0) ? '#95a5a6' : '#2ecc71' },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || Object.keys(uploadedDocs).length < (REQUIREMENTS[selectedType!]?.length || 0)}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <AddressMapPickerModal
        visible={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onConfirm={(lat, lng, preview) => {
          void resolveAndApplyAddress(lat, lng, preview);
        }}
        initialLat={mapLat}
        initialLng={mapLng}
        colors={colors}
      />
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
    marginTop: 2,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  stepIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#3b5998', // Keep primary color
  },
  stepText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 10,
  },
  stepTextActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 5,
  },
  stepLineActive: {
    backgroundColor: '#3b5998', // Keep primary color
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContent: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formCenterTitle: {
    textAlign: 'center',
    fontSize: 20,
    marginBottom: 18,
  },
  propertyFormShell: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  formMicroLabel: {
    fontSize: 10,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  slimInput: {
    minHeight: 40,
    paddingVertical: 9,
  },
  taxDecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxDecInput: {
    flex: 1,
    marginBottom: 0,
  },
  taxDecActionBtn: {
    backgroundColor: '#1f5ca8',
    borderRadius: 4,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxDecActionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  grid3: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gridInput: {
    flex: 1,
    marginBottom: 0,
  },
  mapPickBtn: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 6,
    backgroundColor: '#1f5ca8',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPickBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  taxDecTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cfd4dc',
    borderRadius: 6,
    overflow: 'hidden',
  },
  taxDecTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#31b3c3',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  taxDecTableHeaderTxt: {
    color: '#0f1b2e',
    fontWeight: '700',
    fontSize: 12,
  },
  taxDecTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e3e7ed',
    backgroundColor: '#fff',
  },
  taxDecNumCol: {
    width: 32,
  },
  taxDecValCol: {
    flex: 1,
  },
  taxDecActionCol: {
    width: 88,
    alignItems: 'flex-end',
  },
  taxDecCellTxt: {
    color: '#1e2b3b',
    fontSize: 13,
    fontWeight: '500',
  },
  taxDecRemoveBtn: {
    backgroundColor: '#df3b30',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taxDecRemoveBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b5998', // Keep primary color
    marginBottom: 12,
    marginTop: 5,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  typeCardActive: {
    borderColor: '#3b5998', // Keep primary color
    backgroundColor: 'rgba(59, 89, 152, 0.05)',
  },
  radioContainer: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#3b5998', // Keep primary color
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b5998', // Keep primary color
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  typeTitleActive: {
    color: '#3b5998', // Keep primary color
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checklistContainer: {
    marginTop: 10,
  },
  uploadItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  reqLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reqRight: {
    width: 170,
    alignItems: 'flex-end',
  },
  reqIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  reqIndexText: {
    fontSize: 12,
    fontWeight: '800',
  },
  uploadItemText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b5998', // Keep primary color
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  uploadBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  fileAttachedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'flex-end',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  removeBtn: {
    padding: 4,
  },
  summaryCard: {
    backgroundColor: '#fafafa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  summaryLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    marginTop: 10,
    fontSize: 13,
    color: '#e74c3c',
    fontStyle: 'italic',
  },
  reviewCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  reviewCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  reviewLabel: {
    width: 110,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 18,
  },
  docsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  docsHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docsCountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  docsProgressTrack: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  docsProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  docsList: {
    borderWidth: 1,
    borderColor: '#e6e9ef',
    borderRadius: 8,
    overflow: 'hidden',
  },
  docsItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  docsItemLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  docsReqText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  docsStatusText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    justifyContent: 'space-between',
  },
  buttonOutline: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  buttonOutlineText: {
    fontWeight: '600',
    fontSize: 16,
  },
  buttonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#3b5998', // Keep primary color
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  buttonSubmit: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2ecc71', // Keep success color
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
