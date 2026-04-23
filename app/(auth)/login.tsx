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
import {
  MOCK_LOGIN_EMAIL,
  MOCK_LOGIN_PASSWORD,
  isMockLoginValid,
} from '@/constants/mockAuth';
import { setSessionUserEmail } from '@/lib/authSession';

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

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768; // Breakpoint for web/tablet
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
      if (!isMockLoginValid(email, password)) {
        Alert.alert('Login Failed', 'Invalid credentials');
        return;
      }
      await setSessionUserEmail(MOCK_LOGIN_EMAIL);
      router.replace('/section/lot-plotter');
    } catch (e) {
      console.error('Login failed', e);
      Alert.alert('Login Failed', 'Could not save session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillMockCredentials = () => {
    if (isLoading) return;
    setEmail(MOCK_LOGIN_EMAIL);
    setPassword(MOCK_LOGIN_PASSWORD);
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
              <Text style={styles.assessorTitle}>MUNICIPAL ASSESSOR'S OFFICE</Text>
              
              <Text style={styles.welcomeText}>WELCOME</Text>

              <Text style={styles.dateTimeText}>{currentDate}</Text>
            </View>

            {/* Right Side: Login Form */}
            <View style={[styles.rightSection, isWeb && styles.rightSectionWeb]}>
              <View style={styles.formContainer}>
                
                <View style={styles.formHeader}>
                  <View style={styles.smallLogoPlaceholder}>
                     <Image source={LOGO_IASSESS} style={styles.smallLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.formHeaderText}>BALATAN MUNICIPAL{'\n'}ASSESSOR WEBSITE</Text>
                </View>

                <Text style={styles.formTitle}>SIGN IN</Text>
                <Text style={styles.formSubtitle}>Please Enter your email and password!</Text>

                <View style={styles.inputWrapper}>
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

                <TouchableOpacity
                  style={[styles.mockFillButton, isLoading && styles.mockFillButtonDisabled]}
                  onPress={fillMockCredentials}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Fill demo login email and password"
                >
                  <Ionicons name="flask-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.mockFillButtonText}>Use demo account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.signupContainer}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                    <Text style={styles.signupLink}>Register here</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  smallLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 89, 152, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  mockFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 89, 152, 0.08)',
  },
  mockFillButtonDisabled: {
    opacity: 0.5,
  },
  mockFillButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
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
  loginButtonDisabled: {
    backgroundColor: '#BDC3C7',
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
