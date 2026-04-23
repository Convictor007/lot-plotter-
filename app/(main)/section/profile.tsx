import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getItem } from '@/lib/appStorage';

import { AddressMapPickerModal, type GeocodedAddressPreview } from '@/components/profile/AddressMapPickerModal';
import { getMockProfileOverrideForEmail, MOCK_USER } from '@/constants/mockUser';
import type { PublicUserJson } from '@/database/models';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticatedImageDataUri } from '@/hooks/useAuthenticatedImageDataUri';
import { apiUrl } from '@/lib/api/api-url';
import { clearAuthSession, getAuthToken, SESSION_USER_EMAIL_KEY } from '@/lib/authSession';

function roleLabel(role: string): string {
  if (role === 'citizen') return 'Citizen';
  if (role === 'assessor') return 'Assessor';
  if (role === 'admin') return 'Admin';
  return role;
}

/** API / JSON date: YYYY-MM-DD or ISO string */
function formatDobFromApi(iso: string | null | undefined): string {
  if (!iso) return '';
  const day = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ageFromIso(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(`${iso}T12:00:00`);
  const diff = Date.now() - d.getTime();
  if (diff < 0) return '0';
  return String(Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

function profileFromApiUser(u: PublicUserJson): typeof MOCK_USER {
  const iso = u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : '';
  return {
    ...MOCK_USER,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    phone_number: u.phone_number ?? '',
    gender: u.gender === 'Male' || u.gender === 'Female' ? u.gender : '',
    age: u.age != null ? String(u.age) : ageFromIso(iso),
    date_of_birth_iso: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '',
    street_address: u.street_address ?? '',
    region: u.region ?? '',
    postal_code: u.postal_code ?? '',
    barangay: u.barangay ?? '',
    municipality: u.municipality,
    province: u.province,
    role: roleLabel(u.role),
    verification_status:
      u.verification_status === 'verified' ||
      u.verification_status === 'pending' ||
      u.verification_status === 'unverified'
        ? u.verification_status
        : 'unverified',
    has_id_document: u.has_id_document ?? false,
    id_document_mime_type: u.id_document_mime_type ?? null,
    id_document_url: u.id_document_url ?? null,
    has_profile_picture: u.has_profile_picture ?? false,
    profile_picture_mime_type: u.profile_picture_mime_type ?? null,
    profile_picture_url: u.profile_picture_url ?? null,
    server_updated_at: u.updated_at ?? '',
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768;
  /** Side-by-side profile + detail columns on large screens (uses horizontal space). */
  const isWideLayout = width >= 900;
  /** Narrow phone: tighter padding, smaller type, single-column fields. */
  const isCompact = width < 440;
  const stackFields = width < 400;
  const iconMd = isCompact ? 18 : 20;
  const iconSm = isCompact ? 16 : 18;
  const { colors } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const modalBackdropSafe = useMemo(
    () => ({
      paddingTop: (isCompact ? 12 : 20) + safeInsets.top,
      paddingBottom: (isCompact ? 12 : 20) + safeInsets.bottom,
      paddingLeft: (isCompact ? 12 : 20) + safeInsets.left,
      paddingRight: (isCompact ? 12 : 20) + safeInsets.right,
    }),
    [isCompact, safeInsets]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState(MOCK_USER);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const [idDocument, setIdDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [idUploading, setIdUploading] = useState(false);

  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [dobIosModalVisible, setDobIosModalVisible] = useState(false);
  const [dobAndroidOpen, setDobAndroidOpen] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  /** Session-only last map pin (not saved); recenters the picker next time. */
  const [lastMapPin, setLastMapPin] = useState<{ lat: number; lng: number } | null>(null);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { uri: resolvedAvatarUri, loading: avatarImageLoading } = useAuthenticatedImageDataUri(
    userData.profile_picture_url,
    Boolean(userData.has_profile_picture),
    authToken,
    userData.server_updated_at
  );

  const dobPickerDate = useMemo(() => {
    const iso = userData.date_of_birth_iso;
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(1998, 2, 17);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [userData.date_of_birth_iso]);

  const onNativeDobChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') setDobAndroidOpen(false);
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setUserData((prev) => ({
      ...prev,
      date_of_birth_iso: iso,
      age: ageFromIso(iso),
    }));
  };

  const openAddressMap = useCallback(() => {
    setIsEditing(true);
    setMapModalVisible(true);
  }, []);

  const applyPinAddress = useCallback(async (lat: number, lng: number, cached?: GeocodedAddressPreview | null) => {
    setIsEditing(true);
    setGeocodeLoading(true);
    try {
      type Addr = {
        street?: string | null;
        barangay?: string | null;
        municipality?: string | null;
        province?: string | null;
        region?: string | null;
        postal_code?: string | null;
      };
      let a: Addr;
      if (cached?.municipality && cached?.province) {
        a = cached;
      } else {
        const res = await fetch(
          apiUrl(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
        );
        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          address?: Addr;
        };
        if (!res.ok || !data.success || !data.address) {
          throw new Error(data.message || 'Could not resolve address for this pin.');
        }
        a = data.address;
      }
      setLastMapPin({ lat, lng });
      setUserData((prev) => ({
        ...prev,
        street_address: a.street ?? prev.street_address,
        barangay: a.barangay ?? prev.barangay,
        municipality: a.municipality || prev.municipality,
        province: a.province || prev.province,
        region: a.region ?? prev.region,
        postal_code: a.postal_code ?? prev.postal_code,
      }));
      Alert.alert(
        'Address updated',
        'We filled your profile from this map location. Review the fields on your profile, then tap Save Changes if everything looks correct.'
      );
    } catch (e) {
      Alert.alert(
        'Address lookup',
        e instanceof Error
          ? e.message
          : 'Could not look up this spot. You can still edit street, barangay, city, and province manually, then Save Changes.'
      );
    } finally {
      setGeocodeLoading(false);
    }
  }, []);

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
      const response = await fetch(apiUrl('/api/change-password'), {
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
        const token = await getAuthToken();
        setAuthToken(token);
        if (token) {
          const res = await fetch(apiUrl('/api/users/me'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = (await res.json()) as { success?: boolean; user?: PublicUserJson };
          if (res.ok && json.success && json.user) {
            setUserData(profileFromApiUser(json.user));
            return;
          }
        }

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

  const closeAvatarModal = () => setAvatarModalVisible(false);

  const uploadProfilePhotoFromPicker = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Sign in required', 'Log in to upload a profile picture.');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      const mime = asset.mimeType || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      formData.append(
        'photo',
        {
          uri: asset.uri,
          name: `profile.${ext}`,
          type: mime,
        } as unknown as Blob
      );

      const response = await fetch(apiUrl('/api/users/me/profile-picture'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = (await response.json()) as { success?: boolean; message?: string; user?: PublicUserJson };
      if (!response.ok || !json.success || !json.user) {
        throw new Error(json.message || 'Upload failed.');
      }
      setUserData(profileFromApiUser(json.user));
      setAvatarModalVisible(false);
      Alert.alert('Updated', 'Your profile picture was saved.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeProfilePhoto = async () => {
    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Sign in required', 'Log in to change your profile picture.');
      return;
    }
    setAvatarUploading(true);
    try {
      const response = await fetch(apiUrl('/api/users/me/profile-picture'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await response.json()) as { success?: boolean; message?: string; user?: PublicUserJson };
      if (!response.ok || !json.success || !json.user) {
        throw new Error(json.message || 'Could not remove picture.');
      }
      setUserData(profileFromApiUser(json.user));
      setAvatarModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    const first = userData.first_name.trim();
    const last = userData.last_name.trim();
    if (!first || !last) {
      Alert.alert('Missing name', 'First and last name are required.');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Sign in required', 'Log in to save your profile to your account.');
      return;
    }

    let date_of_birth: string | null;
    const isoRaw = userData.date_of_birth_iso.trim();
    if (!isoRaw) {
      date_of_birth = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(isoRaw)) {
      date_of_birth = isoRaw;
    } else {
      Alert.alert('Invalid date', 'Choose a valid date of birth from the calendar.');
      return;
    }

    let ageNum: number | null;
    if (!userData.age.trim()) {
      ageNum = null;
    } else {
      const n = parseInt(userData.age.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0 || n > 150) {
        Alert.alert('Invalid age', 'Enter a valid age (0–150) or leave the field blank.');
        return;
      }
      ageNum = n;
    }

    const mun = userData.municipality.trim();
    const prov = userData.province.trim();
    if (!mun || !prov) {
      Alert.alert('Address', 'Municipality and province are required. Use Pick on map or enter them manually.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/users/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          phone_number: userData.phone_number.trim() || null,
          gender: userData.gender === 'Male' || userData.gender === 'Female' ? userData.gender : null,
          age: ageNum,
          date_of_birth,
          street_address: userData.street_address.trim() || null,
          region: userData.region.trim() || null,
          postal_code: userData.postal_code.trim() || null,
          barangay: userData.barangay.trim() || null,
          municipality: mun,
          province: prov,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; user?: PublicUserJson };

      if (res.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.');
        return;
      }
      if (!res.ok || !json.success || !json.user) {
        Alert.alert('Could not save', json.message || 'Profile update failed.');
        return;
      }

      setUserData(profileFromApiUser(json.user!));
      setIsEditing(false);
      Alert.alert('Saved', 'Your profile was updated.');
    } catch (e) {
      console.error('Profile save failed', e);
      Alert.alert('Error', 'Could not reach the server. Try again.');
    } finally {
      setIsSaving(false);
    }
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
      <View style={[styles.badgeContainer, isCompact && styles.badgeContainerCompact]}>
        <Ionicons name={icon as any} size={isCompact ? 12 : 14} color="#fff" />
        <Text style={[styles.badgeText, isCompact && styles.badgeTextCompact]}>{text}</Text>
      </View>
    );
  };

  const renderField = (label: string, value: string, fieldKey: keyof typeof MOCK_USER, editable: boolean = true) => {
    return (
      <View style={[styles.fieldContainer, stackFields && styles.fieldContainerStack]}>
        <Text style={[styles.fieldLabel, isCompact && styles.fieldLabelCompact, { color: colors.textMuted }]}>{label}</Text>
        {isEditing && editable ? (
          <TextInput
            style={[
              styles.input,
              isCompact && styles.inputCompact,
              { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border },
            ]}
            value={value}
            onChangeText={(text) => setUserData({ ...userData, [fieldKey]: text })}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <Text style={[styles.fieldValue, isCompact && styles.fieldValueCompact, { color: colors.text }]}>
            {value || 'Not provided'}
          </Text>
        )}
      </View>
    );
  };

  const renderGenderField = () => (
    <View style={[styles.fieldContainer, stackFields && styles.fieldContainerStack]}>
      <Text style={[styles.fieldLabel, isCompact && styles.fieldLabelCompact, { color: colors.textMuted }]}>Gender</Text>
      {isEditing ? (
        <TouchableOpacity
          style={[
            styles.selectRow,
            isCompact && styles.selectRowCompact,
            { backgroundColor: colors.contentBg, borderColor: colors.border },
          ]}
          onPress={() => setGenderModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.selectRowText,
              isCompact && styles.selectRowTextCompact,
              { color: userData.gender ? colors.text : colors.textMuted },
            ]}
          >
            {userData.gender || 'Select Male or Female'}
          </Text>
          <Ionicons name="chevron-down" size={iconSm} color={colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <Text style={[styles.fieldValue, isCompact && styles.fieldValueCompact, { color: colors.text }]}>
          {userData.gender || 'Not provided'}
        </Text>
      )}
    </View>
  );

  const renderDobField = () => {
    const display = userData.date_of_birth_iso
      ? formatDobFromApi(userData.date_of_birth_iso)
      : '';
    return (
      <View style={[styles.fieldContainer, stackFields && styles.fieldContainerStack]}>
        <Text style={[styles.fieldLabel, isCompact && styles.fieldLabelCompact, { color: colors.textMuted }]}>
          Date of Birth
        </Text>
        {isEditing ? (
          <>
            {Platform.OS === 'web' ? (
              <TextInput
                style={[
                  styles.input,
                  isCompact && styles.inputCompact,
                  { backgroundColor: colors.contentBg, color: colors.text, borderColor: colors.border },
                ]}
                value={userData.date_of_birth_iso}
                onChangeText={(text) => {
                  const t = text.trim().slice(0, 10);
                  setUserData((prev) => ({
                    ...prev,
                    date_of_birth_iso: t,
                    age: /^\d{4}-\d{2}-\d{2}$/.test(t) ? ageFromIso(t) : prev.age,
                  }));
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.selectRow,
                  isCompact && styles.selectRowCompact,
                  { backgroundColor: colors.contentBg, borderColor: colors.border },
                ]}
                onPress={() => {
                  if (Platform.OS === 'android') setDobAndroidOpen(true);
                  else setDobIosModalVisible(true);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.selectRowText,
                    isCompact && styles.selectRowTextCompact,
                    { color: display ? colors.text : colors.textMuted },
                  ]}
                >
                  {display || 'Tap to choose date'}
                </Text>
                <Ionicons name="calendar-outline" size={iconMd} color={colors.primary} />
              </TouchableOpacity>
            )}
            {Platform.OS === 'android' && dobAndroidOpen ? (
              <DateTimePicker
                value={dobPickerDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={onNativeDobChange}
              />
            ) : null}
          </>
        ) : (
          <Text style={[styles.fieldValue, isCompact && styles.fieldValueCompact, { color: colors.text }]}>
            {display || 'Not provided'}
          </Text>
        )}
      </View>
    );
  };

  const addressSummaryLines = [
    userData.region ? `Region: ${userData.region}` : null,
    `Province: ${userData.province || '—'}`,
    `City / Municipality: ${userData.municipality || '—'}`,
    userData.barangay ? `Barangay: ${userData.barangay}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const renderOverviewCard = () => (
    <View
      style={[
        styles.overviewCard,
        isCompact && styles.overviewCardCompact,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      <View style={[styles.overviewGrid, isCompact && styles.overviewGridCompact]}>
        <View style={[styles.overviewRow, isCompact && styles.overviewRowCompact]}>
          <View style={[styles.overviewCol, styles.overviewColLeft]}>
            <Pressable
              onPress={() => setAvatarModalVisible(true)}
              disabled={avatarUploading}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              accessibilityLabel="Change profile picture"
            >
              <View
                style={[
                  styles.avatarContainer,
                  isCompact && styles.avatarContainerCompact,
                  { backgroundColor: colors.primary, overflow: 'hidden' },
                ]}
              >
                {userData.has_profile_picture &&
                userData.profile_picture_url &&
                authToken ? (
                  resolvedAvatarUri ? (
                    <Image
                      source={{ uri: resolvedAvatarUri }}
                      style={[styles.avatarImage, isCompact && styles.avatarImageCompact]}
                      resizeMode="cover"
                    />
                  ) : avatarImageLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.avatarText, isCompact && styles.avatarTextCompact]}>
                      {userData.first_name.charAt(0)}
                      {userData.last_name.charAt(0)}
                    </Text>
                  )
                ) : (
                  <Text style={[styles.avatarText, isCompact && styles.avatarTextCompact]}>
                    {userData.first_name.charAt(0)}
                    {userData.last_name.charAt(0)}
                  </Text>
                )}
              </View>
            </Pressable>
          </View>
          <View style={[styles.overviewCol, styles.overviewColRight]}>
            <Text style={[styles.userName, isCompact && styles.userNameCompact, { color: colors.text }]}>
              {userData.first_name} {userData.last_name}
            </Text>
            <Text style={[styles.userRole, isCompact && styles.userRoleCompact, { color: colors.textMuted }]}>
              {userData.role} Account
            </Text>
          </View>
        </View>
        <View style={[styles.overviewRow, isCompact && styles.overviewRowCompact]}>
          <View style={[styles.overviewCol, styles.overviewColLeft]}>
            <Text
              style={[styles.overviewEmail, isCompact && styles.overviewEmailCompact, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {userData.email}
            </Text>
          </View>
          <View style={[styles.overviewCol, styles.overviewColRight, styles.overviewBadgeCell]}>{renderBadge()}</View>
        </View>
      </View>

      <View style={[styles.overviewBottom, isCompact && styles.overviewBottomCompact, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.editBtn, isCompact && styles.editBtnCompact, { backgroundColor: isEditing ? colors.success : colors.primary }]}
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={isEditing ? 'save-outline' : 'create-outline'} size={isCompact ? 16 : 18} color="#fff" />
          )}
          <Text style={[styles.editBtnText, isCompact && styles.editBtnTextCompact]}>
            {isEditing ? (isSaving ? 'Saving…' : 'Save Changes') : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const pickIdDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setIdDocument(result.assets[0]);
      }
    } catch {
      Alert.alert('Error', 'Could not open the file picker.');
    }
  };

  const submitIdVerification = async () => {
    if (!idDocument) {
      Alert.alert('No file selected', 'Choose a clear photo or PDF of your valid government ID.');
      return;
    }
    setIdUploading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const formData = new FormData();
      formData.append(
        'idDocument',
        {
          uri: idDocument.uri,
          name: idDocument.name || 'valid-id',
          type: idDocument.mimeType || 'application/octet-stream',
        } as unknown as Blob
      );

      const response = await fetch(apiUrl('/api/verify-id'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Upload failed.');
      }
      setUserData((prev) => ({
        ...prev,
        verification_status: result.verificationStatus ?? 'pending',
      }));
      setIdDocument(null);
      Alert.alert('Submitted', result.message || 'Your ID was received for review.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed.';
      Alert.alert('Error', message);
    } finally {
      setIdUploading(false);
    }
  };

  const renderIdVerificationCard = () => {
    const status = userData.verification_status;
    const canUpload = status === 'unverified' || status === 'pending';

    return (
      <View
        style={[
          styles.card,
          styles.idVerificationCard,
          isCompact && styles.cardCompact,
          { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <View
          style={[
            styles.cardHeader,
            isCompact && styles.cardHeaderCompact,
            { borderBottomColor: colors.border, backgroundColor: colors.contentBg },
          ]}
        >
          <Ionicons name="id-card-outline" size={iconMd} color={colors.primary} />
          <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact, { color: colors.text }]}>
            Identity verification
          </Text>
        </View>
        <View style={[styles.idVerificationBody, isCompact && styles.idVerificationBodyCompact]}>
          {status === 'verified' ? (
            <View
              style={[
                styles.idVerificationBanner,
                isCompact && styles.idVerificationBannerCompact,
                { backgroundColor: colors.contentBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="shield-checkmark" size={isCompact ? 20 : 22} color="#2ecc71" />
              <Text
                style={[styles.idVerificationBannerText, isCompact && styles.idVerificationBannerTextCompact, { color: colors.text }]}
              >
                Your government ID is on file and this account is verified.
              </Text>
            </View>
          ) : null}

          {status === 'pending' ? (
            <Text style={[styles.idVerificationHint, isCompact && styles.idVerificationHintCompact, { color: colors.textMuted }]}>
              We are reviewing your ID. This usually takes 1–2 business days. You may upload a clearer copy below if
              needed.
            </Text>
          ) : null}

          {status === 'unverified' ? (
            <Text style={[styles.idVerificationHint, isCompact && styles.idVerificationHintCompact, { color: colors.textMuted }]}>
              Upload a clear photo or PDF of your valid government ID (e.g. passport, driver’s license, national ID).
              Your status will show as pending until staff approve it.
            </Text>
          ) : null}

          {canUpload ? (
            <>
              <TouchableOpacity
                style={[styles.idPickBtn, isCompact && styles.idPickBtnCompact, { backgroundColor: colors.primary }]}
                onPress={pickIdDocument}
                disabled={idUploading}
                activeOpacity={0.85}
              >
                <Ionicons name="cloud-upload-outline" size={iconMd} color="#fff" />
                <Text style={[styles.idPickBtnText, isCompact && styles.idPickBtnTextCompact]}>Choose ID (image or PDF)</Text>
              </TouchableOpacity>
              {idDocument ? (
                <Text style={[styles.idFileName, isCompact && styles.idFileNameCompact, { color: colors.text }]} numberOfLines={1}>
                  {idDocument.name}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.idSubmitBtn,
                  isCompact && styles.idSubmitBtnCompact,
                  {
                    backgroundColor: idDocument && !idUploading ? colors.success : colors.textMuted,
                    opacity: idUploading ? 0.75 : 1,
                  },
                ]}
                onPress={submitIdVerification}
                disabled={!idDocument || idUploading}
                activeOpacity={0.85}
              >
                {idUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={iconSm} color="#fff" />
                    <Text style={[styles.idSubmitBtnText, isCompact && styles.idSubmitBtnTextCompact]}>
                      {status === 'pending' ? 'Replace ID' : 'Submit for review'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderDetailCards = () => (
    <>
      <View style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <View
          style={[
            styles.cardHeader,
            isCompact && styles.cardHeaderCompact,
            { borderBottomColor: colors.border, backgroundColor: colors.contentBg },
          ]}
        >
          <Ionicons name="person-outline" size={iconMd} color={colors.primary} />
          <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact, { color: colors.text }]}>
            Personal Information
          </Text>
        </View>
        <View
          style={[
            styles.cardContent,
            styles.cardContentGrid,
            isCompact && styles.cardContentCompact,
            isCompact && styles.cardContentGridCompact,
          ]}
        >
          {renderField('First Name', userData.first_name, 'first_name')}
          {renderField('Last Name', userData.last_name, 'last_name')}
          {renderGenderField()}
          {renderDobField()}
          {renderField('Age', userData.age, 'age')}
          {renderField('Role', userData.role, 'role', false)}
        </View>
      </View>

      <View style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <View
          style={[
            styles.cardHeader,
            isCompact && styles.cardHeaderCompact,
            { borderBottomColor: colors.border, backgroundColor: colors.contentBg },
          ]}
        >
          <Ionicons name="call-outline" size={iconMd} color={colors.primary} />
          <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact, { color: colors.text }]}>
            Contact Details
          </Text>
        </View>
        <View
          style={[
            styles.cardContent,
            styles.cardContentGrid,
            isCompact && styles.cardContentCompact,
            isCompact && styles.cardContentGridCompact,
          ]}
        >
          {renderField('Email Address', userData.email, 'email', false)}
          {renderField('Phone Number', userData.phone_number, 'phone_number')}
        </View>
      </View>

      <View style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
        <View
          style={[
            styles.cardHeader,
            isCompact && styles.cardHeaderCompact,
            { borderBottomColor: colors.border, backgroundColor: colors.contentBg },
          ]}
        >
          <Ionicons name="location-outline" size={iconMd} color={colors.primary} />
          <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact, { color: colors.text }]}>
            Address Information
          </Text>
        </View>
        <View
          style={[
            styles.cardContent,
            styles.cardContentGrid,
            isCompact && styles.cardContentCompact,
            isCompact && styles.cardContentGridCompact,
          ]}
        >
          <View style={[styles.fieldContainer, styles.fieldContainerFull]}>
            <Text style={[styles.fieldLabel, isCompact && styles.fieldLabelCompact, { color: colors.textMuted }]}>
              Region, Province, City, Barangay
            </Text>
            {isEditing ? (
              <TouchableOpacity
                style={[
                  styles.selectRow,
                  isCompact && styles.selectRowCompact,
                  { backgroundColor: colors.contentBg, borderColor: colors.border },
                ]}
                onPress={openAddressMap}
                disabled={geocodeLoading}
                activeOpacity={0.75}
              >
                <Text style={[styles.addressSummaryText, isCompact && styles.addressSummaryTextCompact, { color: colors.text }]}>
                  {addressSummaryLines}
                </Text>
                <Ionicons name="map-outline" size={isCompact ? 20 : 22} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={openAddressMap}
                disabled={geocodeLoading}
                activeOpacity={0.75}
              >
                <Text style={[styles.fieldValue, isCompact && styles.fieldValueCompact, { color: colors.text }]}>
                  {addressSummaryLines || 'Not provided'}
                </Text>
                <Text style={[styles.mapHintReadOnly, isCompact && styles.mapHintReadOnlyCompact, { color: colors.primary }]}>
                  Tap to edit address · pick on map
                </Text>
              </TouchableOpacity>
            )}
            {isEditing ? (
              <TouchableOpacity
                style={[
                  styles.mapPickBtn,
                  isCompact && styles.mapPickBtnCompact,
                  { backgroundColor: colors.primary, opacity: geocodeLoading ? 0.7 : 1 },
                ]}
                onPress={openAddressMap}
                disabled={geocodeLoading}
              >
                {geocodeLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="location" size={iconSm} color="#fff" />
                    <Text style={[styles.mapPickBtnText, isCompact && styles.mapPickBtnTextCompact]}>Pick on map</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {renderField('Street, building, house no.', userData.street_address, 'street_address')}
          {renderField('Postal code', userData.postal_code, 'postal_code')}
          {renderField('Barangay', userData.barangay, 'barangay')}
          {renderField('Municipality', userData.municipality, 'municipality', isEditing)}
          {renderField('Province', userData.province, 'province', isEditing)}
        </View>
      </View>
    </>
  );

  const renderAccountActions = () => (
    <View style={[styles.bottomActions, isWideLayout && styles.bottomActionsWide, isCompact && styles.bottomActionsCompact]}>
      <TouchableOpacity
        style={[styles.actionButton, isCompact && styles.actionButtonCompact, { backgroundColor: colors.cardBg }]}
        onPress={() => setPasswordModalVisible(true)}
      >
        <Ionicons name="lock-closed-outline" size={iconMd} color={colors.text} />
        <Text style={[styles.actionButtonText, isCompact && styles.actionButtonTextCompact, { color: colors.text }]}>
          Change Password
        </Text>
        <Ionicons name="chevron-forward" size={iconMd} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, isCompact && styles.actionButtonCompact, { backgroundColor: colors.cardBg }]}
        onPress={() => router.push('/(main)/section/request')}
      >
        <Ionicons name="document-text-outline" size={iconMd} color={colors.text} />
        <Text style={[styles.actionButtonText, isCompact && styles.actionButtonTextCompact, { color: colors.text }]}>
          My Transaction Requests
        </Text>
        <Ionicons name="chevron-forward" size={iconMd} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.logoutButton,
          isCompact && styles.actionButtonCompact,
          { backgroundColor: colors.cardBg, borderColor: colors.danger },
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={iconMd} color={colors.danger} />
        <Text style={[styles.actionButtonText, isCompact && styles.actionButtonTextCompact, { color: colors.danger }]}>
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.contentBg }]}
      contentContainerStyle={[
        styles.contentContainer,
        isWideLayout && styles.contentContainerWide,
        isCompact && styles.contentContainerCompact,
      ]}
    >
      <View style={[styles.mainWrapper, isWeb && styles.mainWrapperWeb, isWideLayout && styles.mainWrapperWide]}>
        {isWideLayout ? (
          <View style={styles.wideColumns}>
            <View style={styles.wideColumnLeft}>
              {renderOverviewCard()}
              {renderIdVerificationCard()}
              {renderAccountActions()}
            </View>
            <View style={styles.wideColumnRight}>{renderDetailCards()}</View>
          </View>
        ) : (
          <>
            {renderOverviewCard()}
            {renderIdVerificationCard()}
            {renderDetailCards()}
            {renderAccountActions()}
          </>
        )}
      </View>
    </ScrollView>

    <AddressMapPickerModal
      visible={mapModalVisible}
      onClose={() => setMapModalVisible(false)}
      onConfirm={(lat, lng, preview) => {
        void applyPinAddress(lat, lng, preview);
      }}
      initialLat={lastMapPin?.lat}
      initialLng={lastMapPin?.lng}
      colors={{
        cardBg: colors.cardBg,
        text: colors.text,
        textMuted: colors.textMuted,
        border: colors.border,
        primary: colors.primary,
        contentBg: colors.contentBg,
      }}
    />

    <Modal
      visible={avatarModalVisible}
      animationType="fade"
      transparent
      onRequestClose={closeAvatarModal}
    >
      <Pressable style={[styles.modalBackdrop, modalBackdropSafe]} onPress={closeAvatarModal}>
        <Pressable
          style={[styles.modalCard, isCompact && styles.modalCardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact, { color: colors.text, marginBottom: 12 }]}>
            Profile photo
          </Text>
          <Text style={[{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }]}>
            Tap your initials to open this anytime. Photos are stored with your account.
          </Text>
          <TouchableOpacity
            style={[styles.avatarModalPrimaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => void uploadProfilePhotoFromPicker()}
            disabled={avatarUploading}
            activeOpacity={0.85}
          >
            {avatarUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="images-outline" size={20} color="#fff" />
                <Text style={styles.avatarModalPrimaryBtnText}>Choose from library</Text>
              </>
            )}
          </TouchableOpacity>
          {userData.has_profile_picture ? (
            <TouchableOpacity
              style={[styles.avatarModalDangerBtn, { borderColor: colors.danger }]}
              onPress={() => void removeProfilePhoto()}
              disabled={avatarUploading}
              activeOpacity={0.85}
            >
              <Text style={[styles.avatarModalDangerBtnText, { color: colors.danger }]}>Remove photo</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.avatarModalCancelBtn} onPress={closeAvatarModal} disabled={avatarUploading}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={genderModalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setGenderModalVisible(false)}
    >
      <Pressable style={[styles.modalBackdrop, modalBackdropSafe]} onPress={() => setGenderModalVisible(false)}>
        <Pressable
          style={[styles.modalCard, isCompact && styles.modalCardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact, { color: colors.text, marginBottom: 8 }]}>
            Gender
          </Text>
          {(['Male', 'Female'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderModalOption, isCompact && styles.genderModalOptionCompact, { borderBottomColor: colors.border }]}
              onPress={() => {
                setUserData((prev) => ({ ...prev, gender: g }));
                setGenderModalVisible(false);
              }}
            >
              <Text style={{ color: colors.text, fontSize: isCompact ? 14 : 16 }}>{g}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={dobIosModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setDobIosModalVisible(false)}
    >
      <Pressable style={[styles.modalBackdrop, modalBackdropSafe]} onPress={() => setDobIosModalVisible(false)}>
        <Pressable
          style={[styles.modalCard, isCompact && styles.modalCardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact, { color: colors.text }]}>Date of birth</Text>
          <DateTimePicker
            value={dobPickerDate}
            mode="date"
            display="spinner"
            onChange={onNativeDobChange}
            maximumDate={new Date()}
          />
          <TouchableOpacity
            style={[
              styles.modalBtnPrimary,
              isCompact && styles.modalBtnPrimaryCompact,
              { backgroundColor: colors.primary, marginTop: 12 },
            ]}
            onPress={() => setDobIosModalVisible(false)}
          >
            <Text style={[styles.modalBtnPrimaryText, isCompact && styles.modalBtnPrimaryTextCompact]}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={passwordModalVisible}
      animationType="fade"
      transparent
      onRequestClose={closePasswordModal}
    >
      <Pressable style={[styles.modalBackdrop, modalBackdropSafe]} onPress={closePasswordModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalAvoid}
        >
          <Pressable
            style={[styles.modalCard, isCompact && styles.modalCardCompact, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, isCompact && styles.modalTitleCompact, { color: colors.text }]}>
                Change password
              </Text>
              <TouchableOpacity onPress={closePasswordModal} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={isCompact ? 22 : 24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, isCompact && styles.modalHintCompact, { color: colors.textMuted }]}>
              Enter your current password, then choose a new one.
            </Text>

            <Text style={[styles.modalLabel, isCompact && styles.modalLabelCompact, { color: colors.textMuted }]}>
              Current password
            </Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, isCompact && styles.modalInputCompact, { color: colors.text }]}
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
                <Ionicons name={showPwdCurrent ? 'eye-off-outline' : 'eye-outline'} size={iconMd} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, isCompact && styles.modalLabelCompact, { color: colors.textMuted }]}>
              New password
            </Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, isCompact && styles.modalInputCompact, { color: colors.text }]}
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
                <Ionicons name={showPwdNew ? 'eye-off-outline' : 'eye-outline'} size={iconMd} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, isCompact && styles.modalLabelCompact, { color: colors.textMuted }]}>
              Confirm new password
            </Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.contentBg }]}>
              <TextInput
                style={[styles.modalInput, isCompact && styles.modalInputCompact, { color: colors.text }]}
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
                <Ionicons name={showPwdConfirm ? 'eye-off-outline' : 'eye-outline'} size={iconMd} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalActions, isCompact && styles.modalActionsCompact]}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, isCompact && styles.modalBtnSecondaryCompact, { borderColor: colors.border }]}
                onPress={closePasswordModal}
                disabled={pwdSubmitting}
              >
                <Text style={[styles.modalBtnSecondaryText, isCompact && styles.modalBtnSecondaryTextCompact, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  isCompact && styles.modalBtnPrimaryCompact,
                  { backgroundColor: colors.primary, opacity: pwdSubmitting ? 0.7 : 1 },
                ]}
                onPress={submitPasswordChange}
                disabled={pwdSubmitting}
              >
                {pwdSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnPrimaryText, isCompact && styles.modalBtnPrimaryTextCompact]}>Update password</Text>
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
  contentContainerWide: {
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  contentContainerCompact: {
    padding: 12,
    paddingBottom: 16,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 600,
  },
  mainWrapperWeb: {
    paddingVertical: 40,
  },
  mainWrapperWide: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },
  wideColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    width: '100%',
  },
  wideColumnLeft: {
    flex: 1,
    minWidth: 300,
    maxWidth: 440,
    gap: 16,
  },
  wideColumnRight: {
    flex: 1.25,
    minWidth: 360,
    flexShrink: 1,
    gap: 16,
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
  overviewCardCompact: {
    marginBottom: 14,
    borderRadius: 12,
  },
  /** 2 horizontal rows, each split into 2 columns (50% / 50%) */
  overviewGrid: {
    padding: 20,
    gap: 16,
  },
  overviewGridCompact: {
    padding: 12,
    gap: 10,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  overviewRowCompact: {
    gap: 10,
  },
  overviewCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  overviewColLeft: {
    alignItems: 'flex-start',
  },
  overviewColRight: {
    alignItems: 'flex-start',
  },
  overviewBadgeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  overviewEmail: {
    fontSize: 13,
    lineHeight: 18,
  },
  overviewEmailCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  overviewBottom: {
    borderTopWidth: 1,
    padding: 14,
    alignItems: 'flex-end',
  },
  overviewBottomCompact: {
    padding: 10,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainerCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarTextCompact: {
    fontSize: 26,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarImageCompact: {
    borderRadius: 32,
  },
  avatarModalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  avatarModalPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarModalDangerBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarModalDangerBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  avatarModalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  userNameCompact: {
    fontSize: 18,
  },
  userRole: {
    fontSize: 14,
    marginTop: 2,
  },
  userRoleCompact: {
    fontSize: 12,
    marginTop: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeContainerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  badgeTextCompact: {
    fontSize: 10,
    marginLeft: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  editBtnTextCompact: {
    fontSize: 13,
    marginLeft: 4,
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
  cardCompact: {
    marginBottom: 12,
    borderRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  cardHeaderCompact: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardTitleCompact: {
    fontSize: 14,
    marginLeft: 6,
  },
  cardContent: {
    padding: 16,
  },
  cardContentCompact: {
    padding: 11,
  },
  cardContentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  cardContentGridCompact: {
    gap: 10,
  },
  fieldContainer: {
    marginBottom: 4,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    maxWidth: '48%',
  },
  fieldContainerStack: {
    flexBasis: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  fieldContainerFull: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  selectRowText: {
    fontSize: 16,
    flex: 1,
  },
  selectRowCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  selectRowTextCompact: {
    fontSize: 14,
  },
  addressSummaryText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  addressSummaryTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  mapPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
  },
  mapPickBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  mapPickBtnCompact: {
    paddingVertical: 10,
    marginTop: 8,
  },
  mapPickBtnTextCompact: {
    fontSize: 14,
  },
  genderModalOption: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mapHintReadOnly: {
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
  mapHintReadOnlyCompact: {
    fontSize: 12,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabelCompact: {
    fontSize: 10,
    marginBottom: 3,
    letterSpacing: 0.35,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  fieldValueCompact: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
  },
  bottomActions: {
    marginTop: 8,
    marginBottom: 40,
  },
  bottomActionsCompact: {
    marginBottom: 28,
  },
  bottomActionsWide: {
    marginTop: 0,
  },
  idVerificationCard: {
    marginBottom: 0,
  },
  idVerificationBody: {
    padding: 16,
    gap: 14,
  },
  idVerificationBodyCompact: {
    padding: 12,
    gap: 10,
  },
  idVerificationHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  idVerificationHintCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  idVerificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  idVerificationBannerCompact: {
    padding: 11,
    gap: 10,
  },
  idVerificationBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  idVerificationBannerTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  idPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  idPickBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  idPickBtnCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  idPickBtnTextCompact: {
    fontSize: 14,
  },
  idFileName: {
    fontSize: 13,
  },
  idFileNameCompact: {
    fontSize: 12,
  },
  idSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  idSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  idSubmitBtnCompact: {
    paddingVertical: 10,
    minHeight: 44,
  },
  idSubmitBtnTextCompact: {
    fontSize: 14,
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
  actionButtonCompact: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  actionButtonTextCompact: {
    fontSize: 14,
    marginLeft: 10,
  },
  logoutButton: {
    marginTop: 12,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
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
  modalCardCompact: {
    padding: 14,
    borderRadius: 12,
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
  modalTitleCompact: {
    fontSize: 16,
  },
  modalHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalHintCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 12,
  },
  modalLabelCompact: {
    fontSize: 11,
    marginBottom: 4,
    marginTop: 10,
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
  modalInputCompact: {
    fontSize: 14,
    paddingVertical: Platform.OS === 'web' ? 8 : 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  modalActionsCompact: {
    gap: 8,
    marginTop: 16,
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondaryCompact: {
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnSecondaryTextCompact: {
    fontSize: 15,
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalBtnPrimaryCompact: {
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnPrimaryTextCompact: {
    fontSize: 15,
  },
  genderModalOptionCompact: {
    paddingVertical: 11,
  },
});
