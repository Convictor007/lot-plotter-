import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  useWindowDimensions,
  ImageBackground,
  Image,
} from 'react-native';
import type { PublicUserJson } from '@/database/models';
import { apiUrl } from '@/lib/api/api-url';
import { requestFacebookAccessToken, requestGoogleIdToken } from '@/lib/auth/social-client';
import { setAuthSession } from '@/lib/authSession';

const COLORS = {
  primary: '#3b5998', // A formal blue matching the reference
  accent: '#f39c12',  // Yellow/gold text
  text: '#333333',
  textLight: '#ffffff',
  white: 'rgba(255, 255, 255, 0.85)', // Glass effect
  border: '#cccccc',
  gray: '#6c757d',
};

// Update to match your actual local path if needed
const BG_IMAGE = require('../../assets/images/balatan-background.png');
const LOGO_IASSESS = require('../../assets/images/iassesslogo.jpg');
const LOGO_BALATAN = require('../../assets/images/balatan-icon.jpg');

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768; // Breakpoint for web/tablet
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isFirstNameFocused, setIsFirstNameFocused] = useState(false);
  const [isLastNameFocused, setIsLastNameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour12: false });
      const dateString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      setCurrentDate(`${timeString}\n${dateString}`);
    };
    updateDate();
    const timer = setInterval(updateDate, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Keyboard.dismiss();
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Keyboard.dismiss();
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();
    
    // Mock API call
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('Success', 'Account created successfully! Please login.', [
        { text: 'OK', onPress: () => router.push('/(auth)/login') }
      ]);
    }, 1500);
  };

  const handleGoogleRegister = async () => {
    if (isLoading) return;
    setIsLoading(true);
    Keyboard.dismiss();
    try {
      const idToken = await requestGoogleIdToken();
      const res = await fetch(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        token?: string;
        user?: PublicUserJson;
        message?: string;
      };
      if (res.ok && data.success && data.token && data.user?.email) {
        await setAuthSession(data.user.email, data.token);
        router.replace('/section/lot-plotter');
        return;
      }
      Alert.alert('Google Sign-Up Failed', data.message || 'Could not continue with Google.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('cancelled')) return;
      Alert.alert('Google Sign-Up Failed', msg || 'Could not continue with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookRegister = async () => {
    if (isLoading) return;
    setIsLoading(true);
    Keyboard.dismiss();
    try {
      const accessToken = await requestFacebookAccessToken();
      const res = await fetch(apiUrl('/api/auth/facebook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        token?: string;
        user?: PublicUserJson;
        message?: string;
      };
      if (res.ok && data.success && data.token && data.user?.email) {
        await setAuthSession(data.user.email, data.token);
        router.replace('/section/lot-plotter');
        return;
      }
      Alert.alert('Facebook Sign-Up Failed', data.message || 'Could not continue with Facebook.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('cancelled')) return;
      Alert.alert('Facebook Sign-Up Failed', msg || 'Could not continue with Facebook.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.mainLayout, isWeb ? styles.mainLayoutWeb : styles.mainLayoutMobile]}>
            
            {/* Left Side: Welcome Text */}
            <View style={[styles.leftSection, isWeb && styles.leftSectionWeb]}>
              <View style={styles.logoContainer}>
                <Image source={LOGO_BALATAN} style={styles.largeLogo} resizeMode="contain" />
              </View>
              <Text style={styles.muniTitle}>MUNICIPALITY OF BALATAN</Text>
              <Text style={styles.assessorTitle}>MUNICIPAL ASSESSOR&apos;S OFFICE</Text>
              
              <Text style={styles.welcomeText}>WELCOME</Text>

              <Text style={styles.dateTimeText}>{currentDate}</Text>
            </View>

            {/* Right Side: Register Form */}
            <View style={[styles.rightSection, isWeb && styles.rightSectionWeb]}>
              <View style={styles.formContainer}>
                
                <View style={styles.formHeader}>
                  <View style={styles.smallLogoPlaceholder}>
                    <Image source={LOGO_IASSESS} style={styles.smallLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.formHeaderText}>BALATAN MUNICIPAL{'\n'}ASSESSOR WEBSITE</Text>
                </View>

                <Text style={styles.formTitle}>CREATE ACCOUNT</Text>
                <Text style={styles.formSubtitle}>Register to access online services</Text>

                <View style={styles.row}>
                  <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="person-outline" size={18} color="#666" />
                    </View>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder={isFirstNameFocused ? '' : 'First Name'}
                      placeholderTextColor="#999"
                      value={firstName}
                      onChangeText={setFirstName}
                      editable={!isLoading}
                      onFocus={() => setIsFirstNameFocused(true)}
                      onBlur={() => setIsFirstNameFocused(false)}
                    />
                  </View>
                  <View style={[styles.inputWrapper, { flex: 1, marginLeft: 8 }]}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="person-outline" size={18} color="#666" />
                    </View>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder={isLastNameFocused ? '' : 'Last Name'}
                      placeholderTextColor="#999"
                      value={lastName}
                      onChangeText={setLastName}
                      editable={!isLoading}
                      onFocus={() => setIsLastNameFocused(true)}
                      onBlur={() => setIsLastNameFocused(false)}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="mail-outline" size={20} color="#666" />
                  </View>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder={isEmailFocused ? '' : 'Email Address'}
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" />
                  </View>
                  <TextInput
                    style={[styles.passwordInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder={isPasswordFocused ? '' : 'Password'}
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={COLORS.gray}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" />
                  </View>
                  <TextInput
                    style={[styles.passwordInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder={isConfirmPasswordFocused ? '' : 'Confirm Password'}
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!isLoading}
                    onFocus={() => setIsConfirmPasswordFocused(true)}
                    onBlur={() => setIsConfirmPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={COLORS.gray}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  <Text style={styles.registerButtonText}>
                    {isLoading ? 'Creating Account...' : 'Register'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.socialDividerRow}>
                  <View style={styles.socialDividerLine} />
                  <Text style={styles.socialDividerText}>or continue with</Text>
                  <View style={styles.socialDividerLine} />
                </View>

                <View style={styles.socialButtonsRow}>
                  <TouchableOpacity
                    style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
                    onPress={handleGoogleRegister}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-google" size={18} color="#DB4437" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
                    onPress={handleFacebookRegister}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                    <Text style={styles.loginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </View>
        </KeyboardAvoidingView>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Creating account...</Text>
            </View>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Dark overlay without backdrop blur
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainLayout: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainLayoutWeb: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    justifyContent: 'space-around',
  },
  mainLayoutMobile: {
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  leftSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  leftSectionWeb: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 0,
    paddingRight: 40,
  },
  logoContainer: {
    width: 90,
    height: 90,
    backgroundColor: COLORS.textLight,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  largeLogo: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  muniTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
    letterSpacing: 1.5,
  },
  assessorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textLight,
    marginBottom: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subWelcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.accent,
    marginBottom: 24,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  dateTimeText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 28,
  },
  rightSection: {
    width: '100%',
    maxWidth: 450,
  },
  rightSectionWeb: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 40,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  formHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  smallLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 89, 152, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  smallLogo: {
    width: '100%',
    height: '100%',
  },
  formHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIconContainer: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: '100%',
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: '100%',
  },
  eyeIcon: {
    padding: 10,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: COLORS.gray,
    fontSize: 13,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D6D6D6',
  },
  socialDividerText: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '500',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  socialButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  socialButtonDisabled: {
    opacity: 0.55,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  loadingCard: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
