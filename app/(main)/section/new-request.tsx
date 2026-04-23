import React, { useState } from 'react';
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
    location: '',
    notes: ''
  });
  
  // Store uploaded files per requirement index
  const [uploadedDocs, setUploadedDocs] = useState<Record<number, DocumentPicker.DocumentPickerAsset>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step === 1 && !selectedType) {
      Alert.alert('Error', 'Please select a transaction type first.');
      return;
    }
    if (step === 2 && (!formData.applicantName || !formData.pin)) {
      Alert.alert('Error', 'Applicant name and PIN are required.');
      return;
    }
    setStep(prev => prev + 1);
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
      userId: 'current-user-id', // Placeholder for authenticated user ID
      type: selectedType,
      propertyId: formData.pin, // Using PIN as identifier for now
      status: 'submitted',
      notes: formData.notes,
      applicantName: formData.applicantName,
      location: formData.location,
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
      // API Request (Per rules: use API only, no direct DB)
      const response = await fetch('/api/transactions', { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload) 
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
      <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Property & Applicant Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Applicant Name *</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]} 
          placeholder="Enter full name or claimant" 
          placeholderTextColor={colors.textMuted}
          value={formData.applicantName}
          onChangeText={(text) => setFormData({...formData, applicantName: text})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Property Index Number (PIN) *</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]} 
          placeholder="e.g. 000-00-000-00-000" 
          placeholderTextColor={colors.textMuted}
          value={formData.pin}
          onChangeText={(text) => setFormData({...formData, pin: text})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Property Location (Barangay/Municipality)</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]} 
          placeholder="Enter complete location" 
          placeholderTextColor={colors.textMuted}
          value={formData.location}
          onChangeText={(text) => setFormData({...formData, location: text})}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Additional Notes (Optional)</Text>
        <TextInput 
          style={[styles.input, styles.textArea, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]} 
          placeholder="Any specific details for this request" 
          placeholderTextColor={colors.textMuted}
          multiline 
          numberOfLines={4}
          value={formData.notes}
          onChangeText={(text) => setFormData({...formData, notes: text})}
        />
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
                <Text style={[styles.uploadItemText, { color: colors.text }]}>{req}</Text>
                
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
                  <TouchableOpacity 
                    style={styles.uploadBtn}
                    onPress={() => pickDocument(index)}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.uploadBtnText}>Upload File</Text>
                  </TouchableOpacity>
                )}
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

    return (
      <View style={[styles.stepContent, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Review & Submit</Text>
        
        <View style={[styles.summaryCard, { backgroundColor: colors.contentBg, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Transaction Information</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedTypeTitle}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Applicant:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.applicantName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>PIN:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.pin}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Location:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.location || 'N/A'}</Text>
          </View>
          
          <View style={[styles.summaryRow, { marginTop: 15, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 }]}>
            <Text style={styles.summaryLabel}>Documents Uploaded:</Text>
            <Text style={[styles.summaryValue, checkedCount < reqsCount ? { color: '#e74c3c' } : { color: '#2ecc71' }]}>
              {checkedCount} of {reqsCount} files
            </Text>
          </View>
          {checkedCount < reqsCount && (
            <Text style={styles.warningText}>
              Note: You have lacking documents. Application will only be processed upon submission of complete documents.
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
          <TouchableOpacity style={styles.buttonSubmit} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  uploadItemText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b5998', // Keep primary color
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
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
