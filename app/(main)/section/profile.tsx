import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getItem } from '@/lib/appStorage';

import { getMockProfileOverrideForEmail, MOCK_USER } from '@/constants/mockUser';
import { useTheme } from '@/contexts/ThemeContext';
import { clearAuthSession, SESSION_USER_EMAIL_KEY } from '@/lib/authSession';

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768;
  const { colors } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(MOCK_USER);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setShowPwdCurrent(false);
    setShowPwdNew(false);
    setShowPwdConfirm(false);
  };

  const submitPasswordChange = async () => {
    if (!pwdCurrent.trim() || !pwdNew.trim() || !pwdConfirm.trim()) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (pwdNew.length < 6) {
      Alert.alert('Too short', 'New password must be at least 6 characters.');
      return;
    }

    setPwdSubmitting(true);
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          currentPassword: pwdCurrent,
          newPassword: pwdNew,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not update password.');
      }
      Alert.alert('Success', result.message || 'Password updated successfully.');
      closePasswordModal();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not update password.';
      Alert.alert('Error', message);
    } finally {
      setPwdSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedEmail = await getItem(SESSION_USER_EMAIL_KEY);

        if (storedEmail) {
          setUserData((prev) => ({
            ...prev,
            email: storedEmail,
            ...getMockProfileOverrideForEmail(storedEmail),
          }));
        }
      } catch (e) {
        console.error('Failed to load user data', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSave = () => {
    // In a real app, this would make an API call to update the profile
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  const handleLogout = async () => {
    try {
      await clearAuthSession();
    } catch (e) {
      console.error('Failed to clear session', e);
    }
    router.replace('/(auth)/login');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.contentBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderBadge = () => {
    let bgColor = '#e74c3c'; // danger
    let icon = 'close-circle';
    let text = 'UNVERIFIED';

    if (userData.verification_status === 'verified') {
      bgColor = '#2ecc71'; // success
      icon = 'checkmark-circle';
      text = 'VERIFIED';
    } else if (userData.verification_status === 'pending') {
      bgColor = '#f1c40f'; // warning
      icon = 'time';
      text = 'PENDING ID';
    }

    return (
      <View style={[styles.badgeContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={14} color="#fff" />
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderField = (label: string, value: string, fieldKey: keyof typeof MOCK_USER, editable: boolean = true) => {
    return (
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
        {isEditing && editable ? (
          <TextInput
            style={[styles.input, { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border }]}
            value={value}
            onChangeText={(text) => setUserData({ ...userData, [fieldKey]: text })}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <Text style={[styles.fieldValue, { color: colors.text }]}>{value || 'Not provided'}</Text>
        )}
      </View>
    );
  };

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.contentBg }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.mainWrapper, isWeb && styles.mainWrapperWeb]}>
        <View style={[styles.overviewCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.overviewTop}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {userData.first_name.charAt(0)}{userData.last_name.charAt(0)}
              </Text>
            </View>
            <View style={styles.overviewTextBlock}>
              <Text style={[styles.userName, { color: colors.text }]}>{userData.first_name} {userData.last_name}</Text>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>{userData.role} Account</Text>
              <Text style={[styles.overviewEmail, { color: colors.textMuted }]} numberOfLines={1}>{userData.email}</Text>
            </View>
            <View style={styles.overviewBadgeWrap}>{renderBadge()}</View>
          </View>

          <View style={[styles.overviewBottom, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[
                styles.editBtn,
                { backgroundColor: isEditing ? colors.success : colors.primary },
              ]} 
              onPress={isEditing ? handleSave : () => setIsEditing(true)}
            >
              <Ionicons name={isEditing ? "save-outline" : "create-outline"} size={18} color="#fff" />
              <Text style={styles.editBtnText}>{isEditing ? "Save Changes" : "Edit Profile"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Information */}
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border, backgroundColor: colors.contentBg }]}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Information</Text>
          </View>
          <View style={[styles.cardContent, isWeb && styles.cardContentGrid]}>
            {renderField('First Name', userData.first_name, 'first_name')}
            {renderField('Last Name', userData.last_name, 'last_name')}
            {renderField('Gender', userData.gender, 'gender')}
            {renderField('Date of Birth', userData.dob, 'dob')}
            {renderField('Age', userData.age, 'age')}
            {renderField('Role', userData.role, 'role', false)}
          </View>
        </View>

        {/* Contact Details */}
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border, backgroundColor: colors.contentBg }]}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Contact Details</Text>
          </View>
          <View style={[styles.cardContent, isWeb && styles.cardContentGrid]}>
            {renderField('Email Address', userData.email, 'email', false)}
            {renderField('Phone Number', userData.phone_number, 'phone_number')}
          </View>
        </View>

        {/* Address Information */}
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border, backgroundColor: colors.contentBg }]}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Address Information</Text>
          </View>
          <View style={[styles.cardContent, isWeb && styles.cardContentGrid]}>
            {renderField('Barangay', userData.barangay, 'barangay')}
            {renderField('Municipality', userData.municipality, 'municipality', false)}
            {renderField('Province', userData.province, 'province', false)}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.cardBg }]} onPress={() => setPasswordModalVisible(true)}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.cardBg }]} onPress={() => router.push('/(main)/section/request')}>
            <Ionicons name="document-text-outline" size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>My Transaction Requests</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.logoutButton, { backgroundColor: colors.cardBg, borderColor: colors.danger }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.actionButtonText, { color: colors.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>

    <Modal
      visible={passwordModalVisible}
      animationType="fade"
      transparent
      onRequestClose={closePasswordModal}
    >
      <Pressable style={styles.modalBackdrop} onPress={closePasswordModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalAvoid}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change password</Text>
              <TouchableOpacity onPress={closePasswordModal} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>
              Enter your current password, then choose a new one.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Current password</Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                value={pwdCurrent}
                onChangeText={setPwdCurrent}
                secureTextEntry={!showPwdCurrent}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                editable={!pwdSubmitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPwdCurrent((v) => !v)} hitSlop={8}>
                <Ionicons name={showPwdCurrent ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>New password</Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                value={pwdNew}
                onChangeText={setPwdNew}
                secureTextEntry={!showPwdNew}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                editable={!pwdSubmitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPwdNew((v) => !v)} hitSlop={8}>
                <Ionicons name={showPwdNew ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Confirm new password</Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                value={pwdConfirm}
                onChangeText={setPwdConfirm}
                secureTextEntry={!showPwdConfirm}
                placeholder="Repeat new password"
                placeholderTextColor={colors.textMuted}
                editable={!pwdSubmitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPwdConfirm((v) => !v)} hitSlop={8}>
                <Ionicons name={showPwdConfirm ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: colors.border }]}
                onPress={closePasswordModal}
                disabled={pwdSubmitting}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary, opacity: pwdSubmitting ? 0.7 : 1 }]}
                onPress={submitPasswordChange}
                disabled={pwdSubmitting}
              >
                {pwdSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Update password</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 600, // Constrain width on tablets/web
  },
  mainWrapperWeb: {
    paddingVertical: 40,
  },
  overviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
    }),
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  overviewTextBlock: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  overviewEmail: {
    fontSize: 13,
    marginTop: 4,
  },
  overviewBadgeWrap: {
    marginLeft: 8,
  },
  overviewBottom: {
    borderTopWidth: 1,
    padding: 14,
    alignItems: 'flex-end',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  userRole: {
    fontSize: 14,
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  card: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardContent: {
    padding: 16,
  },
  cardContentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
  },
  fieldContainer: {
    marginBottom: 16,
    minWidth: '47%',
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  bottomActions: {
    marginTop: 8,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    }),
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 12,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalAvoid: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    width: '100%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  modalHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 16,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
    }),
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
