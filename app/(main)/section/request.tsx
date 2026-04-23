import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  useWindowDimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

// Mock data based on the transaction_requests schema
const MOCK_REQUESTS = [
  {
    Transaction_id: 1,
    reference_number: 'TXN-1713829102',
    type: 'transfer_with_title',
    status: 'under_review',
    notes: 'Please process ASAP.',
    assessor_notes: 'Checking the submitted CAR and Tax Declaration.',
    submitted_at: '2026-04-18T10:30:00Z',
    updated_at: '2026-04-19T14:20:00Z',
  },
  {
    Transaction_id: 2,
    reference_number: 'TXN-1713500000',
    type: 'appraisal_land_first_time',
    status: 'approved',
    notes: 'First time declaration for newly inherited land.',
    assessor_notes: 'All documents verified. Ready for tax payment.',
    submitted_at: '2026-04-10T09:15:00Z',
    updated_at: '2026-04-15T11:00:00Z',
  },
  {
    Transaction_id: 3,
    reference_number: 'TXN-1713200000',
    type: 'certified_true_copy',
    status: 'pending_documents',
    notes: 'Need a copy for bank loan.',
    assessor_notes: 'Please upload a clearer copy of your Valid ID. The current one is blurred.',
    submitted_at: '2026-04-05T13:45:00Z',
    updated_at: '2026-04-06T08:30:00Z',
  }
];

// Helper to format transaction type to readable text
const formatType = (type: string) => {
  const types: Record<string, string> = {
    'transfer': 'Transfer of Ownership WITHOUT TITLE',
    'transfer_with_title': 'Transfer of Ownership WITH TITLE',
    'transfer_denr_handog': 'Transfer of Ownership - HANDOG TITULO',
    'appraisal_land_first_time': 'Appraisal of Land Declared FIRST TIME',
    'certified_true_copy': 'Certified True Copy of Tax Declaration',
    'certificate_landholdings': 'Certificate of Landholdings'
  };
  return types[type] || type;
};

// Helper to get status color and icon
const getStatusConfig = (status: string) => {
  switch (status) {
    case 'submitted': return { color: '#3498db', icon: 'paper-plane', label: 'Submitted' };
    case 'under_review': return { color: '#f1c40f', icon: 'search', label: 'Under Review' };
    case 'pending_documents': return { color: '#f39c12', icon: 'document-attach', label: 'Pending Documents' };
    case 'approved': return { color: '#2ecc71', icon: 'checkmark-circle', label: 'Approved' };
    case 'rejected': return { color: '#e74c3c', icon: 'close-circle', label: 'Rejected' };
    case 'ready_for_payment': return { color: '#2ecc71', icon: 'cash', label: 'Ready for Payment' };
    case 'completed': return { color: '#3b5998', icon: 'flag', label: 'Completed' };
    case 'cancelled': return { color: '#666666', icon: 'ban', label: 'Cancelled' };
    default: return { color: '#666666', icon: 'help-circle', label: 'Draft' };
  }
};

// Helper to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function RequestScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768;
  const { colors } = useTheme();
  
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>My Requests</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track the status of your transactions and documents.</Text>
        </View>
        <TouchableOpacity 
          style={styles.newRequestBtn}
          onPress={() => router.push('/(main)/section/new-request')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newRequestBtnText}>New Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.mainWrapper, isWeb && styles.mainWrapperWeb]}>
          
          {MOCK_REQUESTS.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Requests Found</Text>
              <Text style={[styles.emptyStateSub, { color: colors.textMuted }]}>You haven't submitted any transaction requests yet.</Text>
              <TouchableOpacity 
                style={styles.emptyStateBtn}
                onPress={() => router.push('/(main)/section/new-request')}
              >
                <Text style={styles.emptyStateBtnText}>Create New Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            MOCK_REQUESTS.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const isExpanded = expandedId === request.Transaction_id;

              return (
                <TouchableOpacity 
                  key={request.Transaction_id} 
                  style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  activeOpacity={0.9}
                  onPress={() => toggleExpand(request.Transaction_id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.refContainer}>
                      <Text style={[styles.refLabel, { color: colors.textMuted }]}>Reference No.</Text>
                      <Text style={[styles.refNumber, { color: colors.text }]}>{request.reference_number}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                      <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.typeText}>{formatType(request.type)}</Text>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>Submitted: {formatDate(request.submitted_at)}</Text>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={[styles.expandedContent, { backgroundColor: colors.contentBg }]}>
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Last Updated:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(request.updated_at)}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Your Notes:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{request.notes || 'None'}</Text>
                      </View>

                      <View style={[styles.assessorNotesBox, { backgroundColor: 'rgba(59, 89, 152, 0.05)' }]}>
                        <View style={styles.assessorNotesHeader}>
                          <Ionicons name="chatbubble-ellipses" size={16} color="#3b5998" />
                          <Text style={styles.assessorNotesTitle}>Assessor's Remarks</Text>
                        </View>
                        <Text style={[styles.assessorNotesText, { color: colors.text }]}>
                          {request.assessor_notes || 'No remarks yet.'}
                        </Text>
                      </View>

                      {request.status === 'pending_documents' && (
                        <TouchableOpacity style={styles.actionBtn}>
                          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>Upload Missing Documents</Text>
                        </TouchableOpacity>
                      )}
                      
                      {request.status === 'approved' && (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2ecc71' }]}>
                          <Ionicons name="print-outline" size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>View Assessment Printout</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <View style={[styles.expandIndicator, { backgroundColor: colors.contentBg, borderTopColor: colors.border }]}>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={colors.textMuted} 
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6f9',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebedf3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  newRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b5998', // Keep primary color
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  newRequestBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 800, // Constrain width on tablets/web for better readability
  },
  mainWrapperWeb: {
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ebedf3',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  refContainer: {
    flex: 1,
  },
  refLabel: {
    fontSize: 11,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  refNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  typeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b5998', // Keep primary color
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
  },
  expandIndicator: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#fafafa',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fafafa',
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    width: 100,
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
  assessorNotesBox: {
    marginTop: 12,
    backgroundColor: 'rgba(59, 89, 152, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#3b5998', // Keep primary color
    padding: 12,
    borderRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  assessorNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assessorNotesTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3b5998', // Keep primary color
  },
  assessorNotesText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333333',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f39c12', // Keep accent color
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 16,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyStateBtn: {
    marginTop: 24,
    backgroundColor: '#3b5998', // Keep primary color
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});