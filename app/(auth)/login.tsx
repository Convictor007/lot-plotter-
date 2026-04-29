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
  ScrollView,
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
/** Temporary convenience for local/dev testing (fills inputs only). */
const AUTO_FILL_EMAIL = 'dareyes@my.cspc.edu.ph';
const AUTO_FILL_PASSWORD = 'dsadsadsa';

export default function LoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWeb = width > 768; // Breakpoint for web/tablet
  const isCompactMobile = !isWeb && height < 860;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour12: true, timeZone: 'Asia/Manila' });
      const dateString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
      setCurrentDate(`${timeString}\n${dateString}`);
    };
    updateDate();
    const timer = setInterval(updateDate, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Keyboard.dismiss();
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        message?: string;
        token?: string;
        user?: PublicUserJson;
      };

      if (res.ok && data.success && data.token && data.user?.email) {
        await setAuthSession(data.user.email, data.token);
        router.replace('/section/lot-plotter');
        return;
      }

      Alert.alert('Login Failed', data.message || 'Invalid credentials');
    } catch (e) {
      console.error('Login failed', e);
      Alert.alert('Login Failed', 'Could not reach the server. Is Expo running and MySQL up?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
      Alert.alert('Google Sign-In Failed', data.message || 'Could not sign in with Google.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('cancelled')) return;
      Alert.alert('Google Sign-In Failed', msg || 'Could not sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
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
      Alert.alert('Facebook Sign-In Failed', data.message || 'Could not sign in with Facebook.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('cancelled')) return;
      Alert.alert('Facebook Sign-In Failed', msg || 'Could not sign in with Facebook.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFill = () => {
    if (isLoading) return;
    setEmail(AUTO_FILL_EMAIL);
    setPassword(AUTO_FILL_PASSWORD);
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.authScroll}
            contentContainerStyle={[styles.authScrollContent, !isWeb && styles.authScrollContentMobile]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.mainLayout,
                isWeb ? styles.mainLayoutWeb : styles.mainLayoutMobile,
                isCompactMobile && styles.mainLayoutMobileCompact,
              ]}
            >
              {/* Left Side: Welcome Text */}
              <View style={[styles.leftSection, isWeb && styles.leftSectionWeb, isCompactMobile && styles.leftSectionCompact]}>
                <View style={[styles.logoContainer, isCompactMobile && styles.logoContainerCompact]}>
                  <Image source={LOGO_BALATAN} style={styles.largeLogo} resizeMode="contain" />
                </View>
                <Text style={[styles.muniTitle, isCompactMobile && styles.muniTitleCompact]}>MUNICIPALITY OF BALATAN</Text>
                <Text style={[styles.assessorTitle, isCompactMobile && styles.assessorTitleCompact]}>MUNICIPAL ASSESSOR&apos;S OFFICE</Text>
                
                <Text style={[styles.welcomeText, isCompactMobile && styles.welcomeTextCompact]}>WELCOME</Text>

                <Text style={[styles.dateTimeText, isCompactMobile && styles.dateTimeTextCompact]}>{currentDate}</Text>
              </View>

              {/* Right Side: Login Form */}
              <View style={[styles.rightSection, isWeb && styles.rightSectionWeb]}>
                <View style={[styles.formContainer, isCompactMobile && styles.formContainerCompact]}>
                
                <View style={[styles.formHeader, isCompactMobile && styles.formHeaderCompact]}>
                  <View style={[styles.smallLogoPlaceholder, isCompactMobile && styles.smallLogoPlaceholderCompact]}>
                    <Image source={LOGO_IASSESS} style={styles.smallLogo} resizeMode="contain" />
                  </View>
                  <Text style={[styles.formHeaderText, isCompactMobile && styles.formHeaderTextCompact]}>
                    BALATAN MUNICIPAL{'\n'}ASSESSOR WEBSITE
                  </Text>
                </View>

                <Text style={[styles.formSubtitle, isCompactMobile && styles.formSubtitleCompact]}>
                  Please Enter your email and password!
                </Text>

                <View style={[styles.inputWrapper, isCompactMobile && styles.inputWrapperCompact]}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="person-outline" size={20} color="#666" />
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

                <View style={[styles.inputWrapper, isCompactMobile && styles.inputWrapperCompact]}>
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

                <View style={[styles.loginActionsRow, isCompactMobile && styles.loginActionsRowCompact]}>
                  <TouchableOpacity
                    style={[styles.loginButton, styles.loginButtonFill, isCompactMobile && styles.loginButtonCompact, isLoading && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    <Text style={styles.loginButtonText}>
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.autoFillButton, isLoading && styles.autoFillButtonDisabled]}
                    onPress={handleAutoFill}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Auto fill login credentials"
                  >
                    <Ionicons name="flash-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.socialDividerRow}>
                  <View style={styles.socialDividerLine} />
                  <Text style={styles.socialDividerText}>or continue with</Text>
                  <View style={styles.socialDividerLine} />
                </View>

                <View style={[styles.socialButtonsRow, isCompactMobile && styles.socialButtonsRowCompact]}>
                  <TouchableOpacity
                    style={[styles.socialButton, styles.googleButton, isLoading && styles.socialButtonDisabled]}
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-google" size={18} color="#DB4437" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.socialButton, styles.facebookButton, isLoading && styles.socialButtonDisabled]}
                    onPress={handleFacebookLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.signupContainer}>
                  <Text style={styles.signupText}>Don&apos;t have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                    <Text style={styles.signupLink}>Register here</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Signing you in...</Text>
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
  authScroll: {
    width: '100%',
    flex: 1,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  authScrollContentMobile: {
    justifyContent: 'flex-start',
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
  mainLayoutMobileCompact: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  leftSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  leftSectionCompact: {
    marginBottom: 18,
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
  logoContainerCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
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
  muniTitleCompact: {
    fontSize: 14,
  },
  assessorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textLight,
    marginBottom: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
  assessorTitleCompact: {
    fontSize: 15,
    marginBottom: 14,
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
  welcomeTextCompact: {
    fontSize: 28,
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
  dateTimeTextCompact: {
    fontSize: 15,
    lineHeight: 23,
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
  formContainerCompact: {
    padding: 22,
    maxWidth: 380,
  },
  formHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  formHeaderCompact: {
    marginBottom: 20,
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
  smallLogoPlaceholderCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
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
  formHeaderTextCompact: {
    fontSize: 11,
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
  formSubtitleCompact: {
    fontSize: 12,
    marginBottom: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperCompact: {
    height: 44,
    marginBottom: 14,
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
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    gap: 10,
  },
  loginActionsRowCompact: {
    marginBottom: 14,
  },
  loginButtonFill: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  loginButtonCompact: {
    height: 46,
    marginBottom: 0,
  },
  loginButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  autoFillButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoFillButtonDisabled: {
    opacity: 0.55,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: COLORS.gray,
    fontSize: 13,
  },
  signupLink: {
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
  socialButtonsRowCompact: {
    marginBottom: 14,
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
  googleButton: {},
  facebookButton: {},
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
