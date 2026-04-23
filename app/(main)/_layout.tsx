import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  Pressable,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@/components/ScreenSafeArea';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { PublicUserJson } from '@/database/models';
import { MOCK_LOGIN_EMAIL } from '@/constants/mockAuth';
import { useAuthenticatedImageDataUri } from '@/hooks/useAuthenticatedImageDataUri';
import { apiUrl } from '@/lib/api/api-url';
import { clearAuthSession, getAuthToken } from '@/lib/authSession';
import { useTheme } from '@/contexts/ThemeContext';
import { NewRequestProvider, useNewRequest } from '@/contexts/NewRequestContext';

const MENU_ITEMS = [
  { 
    id: 'maps', 
    title: 'Maps', 
    icon: 'map-outline', 
    children: [
      { id: 'lot-plotter', title: 'Lot Plotter', route: '/(main)/section/lot-plotter' },
      { id: 'historical-map', title: 'Historical Map', route: '/(main)/section/historical-map' },
    ]
  },
  { id: 'new-request', title: 'New Request', icon: 'add-circle-outline', route: '/(main)/section/new-request' },
  { id: 'my-request', title: 'My Requests', icon: 'list-outline', route: '/(main)/section/request' },
  { id: 'profile', title: 'Profile', icon: 'person-outline', route: '/(main)/section/profile' },
];

const SIDEBAR_EXPANDED_WIDTH = 250;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const IASSESS_LOGO = require('../../assets/images/iassesslogo.jpg');

function MenuItem({ item, isActive, isCollapsed, onPress, onChildPress, currentRoute }: any) {
  const { colors } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = !!item.children;
  
  // Auto-expand if a child is active
  const isChildActive = hasChildren && item.children.some((c: any) => c.route === currentRoute);
  const [isExpanded, setIsExpanded] = useState(isChildActive);

  const handlePress = () => {
    if (hasChildren) {
      if (!isCollapsed) {
        setIsExpanded(!isExpanded);
      }
    } else {
      onPress(item.route);
    }
  };

  return (
    <View>
      <Pressable
        onPress={handlePress}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={[
          styles.menuItem,
          (isActive || (isCollapsed && isChildActive)) && { backgroundColor: colors.activeBg },
          isHovered && !(isActive || (isCollapsed && isChildActive)) && { backgroundColor: colors.hoverBg },
          isCollapsed && styles.menuItemCollapsed
        ]}
      >
        <Ionicons
          name={item.icon as any}
          size={24}
          color={(isActive || isHovered || isChildActive) ? colors.sidebarTextActive : colors.sidebarText}
        />
        {!isCollapsed && (
          <>
            <Text style={[
              styles.menuText, 
              { color: colors.sidebarText },
              (isActive || isHovered || isChildActive) && { color: colors.sidebarTextActive }
            ]}>
              {item.title}
            </Text>
            {hasChildren && (
              <Ionicons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={(isActive || isHovered || isChildActive) ? colors.sidebarTextActive : colors.sidebarText} 
                style={{ marginLeft: 'auto' }}
              />
            )}
          </>
        )}
      </Pressable>
      
      {/* Dropdown Children */}
      {hasChildren && isExpanded && !isCollapsed && (
        <View style={styles.dropdownContainer}>
          {item.children.map((child: any) => {
            const isChildCurrent = child.route === currentRoute;
            return (
              <TouchableOpacity
                key={child.id}
                style={[styles.dropdownItem, isChildCurrent && styles.dropdownItemActive]}
                onPress={() => onChildPress(child.route)}
              >
                <View style={[styles.dropdownDot, { backgroundColor: colors.sidebarText }, isChildCurrent && { backgroundColor: colors.sidebarTextActive }]} />
                <Text style={[styles.dropdownText, { color: colors.sidebarText }, isChildCurrent && { color: colors.sidebarTextActive, fontWeight: '600' }]}>
                  {child.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function MainLayout() {
  const { width, height } = useWindowDimensions();
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const isSmallScreen = width < 768;
  /** Drawer width in dp scales with window width (not physical px); keeps layout sane on narrow/wide phones. */
  const phoneDrawerWidth = useMemo(() => {
    if (!isSmallScreen) return SIDEBAR_EXPANDED_WIDTH;
    const target = Math.round(width * 0.82);
    return Math.min(300, Math.max(220, Math.min(target, width - 12)));
  }, [isSmallScreen, width]);
  const compactPhoneChrome = isSmallScreen && height < 640;
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isSmallScreen);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();

  /** Absolute drawer ignores parent SafeAreaView padding on some Android builds — pad explicitly. */
  const drawerSafePadding = useMemo(() => {
    if (!isSmallScreen) return undefined;
    const androidStatus = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
    return {
      paddingTop: Math.max(safeInsets.top, androidStatus),
      paddingBottom: safeInsets.bottom,
    };
  }, [isSmallScreen, safeInsets.top, safeInsets.bottom]);

  const [sessionUser, setSessionUser] = useState<PublicUserJson | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await getAuthToken();
      if (!alive) return;
      setSessionToken(t);
      if (!t) {
        setSessionUser(null);
        return;
      }
      try {
        const res = await fetch(apiUrl('/api/users/me'), {
          headers: { Authorization: `Bearer ${t}` },
        });
        const json = (await res.json()) as { success?: boolean; user?: PublicUserJson };
        if (!alive) return;
        if (res.ok && json.success && json.user) setSessionUser(json.user);
        else setSessionUser(null);
      } catch {
        if (!alive) return;
        setSessionUser(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  const { uri: sidebarAvatarUri, loading: sidebarAvatarLoading } = useAuthenticatedImageDataUri(
    sessionUser?.profile_picture_url,
    Boolean(sessionUser?.has_profile_picture),
    sessionToken,
    sessionUser?.updated_at ?? ''
  );

  const sidebarDisplayName = sessionUser
    ? `${sessionUser.first_name} ${sessionUser.last_name}`.trim() || sessionUser.email.split('@')[0]
    : MOCK_LOGIN_EMAIL.split('@')[0];
  const sidebarDisplayEmail = sessionUser?.email ?? MOCK_LOGIN_EMAIL;
  const sidebarInitials =
    sessionUser?.first_name && sessionUser?.last_name
      ? `${sessionUser.first_name.charAt(0)}${sessionUser.last_name.charAt(0)}`.toUpperCase()
      : (sessionUser?.email ?? MOCK_LOGIN_EMAIL).slice(0, 2).toUpperCase();

  // Auto-close or collapse based on screen size
  useEffect(() => {
    if (isSmallScreen) {
      setIsSidebarOpen(false);
      setIsCollapsed(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isSmallScreen]);

  const toggleSidebar = () => {
    if (isSmallScreen) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
    if (isSmallScreen) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clearAuthSession();
    } catch (e) {
      console.error('Failed to clear session', e);
    } finally {
      setLogoutModalVisible(false);
      router.replace('/(auth)/login');
    }
  };

  const sidebarAnimatedStyle = useAnimatedStyle(() => {
    if (isSmallScreen) {
      return {
        transform: [
          { translateX: withTiming(isSidebarOpen ? 0 : -phoneDrawerWidth, { duration: 300 }) }
        ],
        width: phoneDrawerWidth,
      };
    } else {
      return {
        width: withTiming(isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH, { duration: 300 }),
        transform: [{ translateX: 0 }],
      };
    }
  }, [isSmallScreen, isSidebarOpen, isCollapsed, phoneDrawerWidth]);

  const getCurrentTitle = () => {
    for (const item of MENU_ITEMS) {
      if (item.route === pathname) return item.title;
      if (item.children) {
        for (const child of item.children) {
          if (child.route === pathname) return child.title;
        }
      }
    }
    return 'Dashboard';
  };

  const isNewRequestRoute = pathname === '/(main)/section/new-request';
  const newRequestHeader = useNewRequest();

  return (
    <ScreenSafeArea style={[styles.container, { backgroundColor: colors.contentBg }]} edges={['top', 'right', 'bottom', 'left']}>
      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          { backgroundColor: colors.sidebarBg },
          isSmallScreen && styles.sidebarAbsolute,
          drawerSafePadding,
          sidebarAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.sidebarHeader,
            isCollapsed && styles.sidebarHeaderCollapsed,
            !isCollapsed && { justifyContent: isSmallScreen ? 'space-between' : 'center' },
            compactPhoneChrome && styles.sidebarHeaderCompact,
          ]}
        >
          {!isCollapsed ? (
            <View style={styles.logoWrap}>
              <Image
                source={IASSESS_LOGO}
                style={compactPhoneChrome ? styles.logoImageCompact : styles.logoImage}
                resizeMode="contain"
              />
              <Text
                style={[styles.logoText, compactPhoneChrome && styles.logoTextCompact]}
                numberOfLines={1}
              >
                iAssess
              </Text>
            </View>
          ) : (
            <Image source={IASSESS_LOGO} style={styles.logoImageCollapsed} resizeMode="cover" />
          )}
          {isSmallScreen && (
            <TouchableOpacity onPress={toggleSidebar}>
              <Ionicons name="close" size={24} color={colors.sidebarText} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              currentRoute={pathname}
              isActive={pathname === item.route}
              isCollapsed={!isSmallScreen && isCollapsed}
              onPress={(route: string) => handleNavigation(route)}
              onChildPress={(route: string) => handleNavigation(route)}
            />
          ))}
        </View>

        <View style={[styles.userProfileSection, isCollapsed && !isSmallScreen && styles.userProfileSectionCollapsed]}>
          <View style={[styles.userProfileTopRow, isCollapsed && !isSmallScreen && styles.userProfileTopRowCollapsed]}>
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.activeBg, overflow: 'hidden' },
              ]}
            >
              {sessionUser?.has_profile_picture &&
              sessionUser.profile_picture_url &&
              sessionToken ? (
                sidebarAvatarUri ? (
                  <Image
                    source={{ uri: sidebarAvatarUri }}
                    style={styles.sidebarAvatarImage}
                    resizeMode="cover"
                  />
                ) : sidebarAvatarLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.avatarText}>{sidebarInitials}</Text>
                )
              ) : (
                <Text style={styles.avatarText}>{sidebarInitials}</Text>
              )}
            </View>
            {(!isCollapsed || isSmallScreen) && (
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {sidebarDisplayName}
                </Text>
                <Text style={[styles.userEmail, { color: colors.sidebarText }]} numberOfLines={1}>
                  {sidebarDisplayEmail}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.activeBg }, isCollapsed && !isSmallScreen && styles.logoutButtonCollapsed]}
            onPress={() => setLogoutModalVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
            {(!isCollapsed || isSmallScreen) && <Text style={styles.logoutButtonText}>Logout</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
            isNewRequestRoute && styles.headerExpanded,
          ]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={toggleSidebar} style={styles.burgerButton}>
              <Ionicons name="menu" size={28} color={colors.text} />
            </TouchableOpacity>
            {isNewRequestRoute ? (
              <View style={styles.newRequestHeaderContent}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  New Request
                </Text>
                <Text style={[styles.newRequestSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  Process transactions and real property documents.
                </Text>
                <View style={styles.newRequestStepsRow}>
                  {[1, 2, 3, 4].map((s) => (
                    <View key={s} style={styles.newRequestStepWrap}>
                      <View
                        style={[
                          styles.newRequestStepCircle,
                          { backgroundColor: colors.border },
                          newRequestHeader.step >= s && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.newRequestStepText,
                            { color: colors.textMuted },
                            newRequestHeader.step >= s && styles.newRequestStepTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </View>
                      {s < 4 && (
                        <View
                          style={[
                            styles.newRequestStepLine,
                            { backgroundColor: colors.border },
                            newRequestHeader.step > s && { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {getCurrentTitle()}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.themeTogglePill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <View style={[styles.themeIconBadge, { backgroundColor: isDarkMode ? 'rgba(74,110,169,0.18)' : 'rgba(243,156,18,0.18)' }]}>
              <Ionicons
                name={isDarkMode ? 'moon' : 'sunny'}
                size={16}
                color={isDarkMode ? '#4a6ea9' : '#f39c12'}
              />
            </View>
            <View style={styles.themeTextWrap}>
              <Text style={[styles.themeLabel, { color: colors.textMuted }]}>Theme</Text>
              <Text style={[styles.themeValue, { color: colors.text }]}>{isDarkMode ? 'Dark' : 'Light'}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Content Slot */}
        <View style={styles.contentArea}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' }, // Hide the default bottom tab bar completely
              sceneStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Tabs.Screen name="section/lot-plotter" />
            <Tabs.Screen name="section/historical-map" />
            <Tabs.Screen name="section/new-request" />
            <Tabs.Screen name="section/request" />
            <Tabs.Screen name="section/profile" />
          </Tabs>
        </View>
      </View>

      {/* Overlay for small screens */}
      {isSmallScreen && isSidebarOpen && (
        <Pressable
          style={styles.overlay}
          onPress={toggleSidebar}
        />
      )}

      <Modal
        transparent
        visible={isLogoutModalVisible}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View
          style={[
            styles.logoutModalOverlay,
            {
              paddingTop: safeInsets.top,
              paddingBottom: safeInsets.bottom,
              paddingLeft: Math.max(24, safeInsets.left),
              paddingRight: Math.max(24, safeInsets.right),
            },
          ]}
        >
          <View style={[styles.logoutModalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.logoutModalTitle, { color: colors.text }]}>Confirm Logout</Text>
            <Text style={[styles.logoutModalMessage, { color: colors.textMuted }]}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                style={[styles.logoutCancelButton, { backgroundColor: colors.contentBg, borderColor: colors.border }]}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.logoutCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirmButton}
                onPress={handleLogout}
                activeOpacity={0.85}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    flexDirection: 'column',
    height: '100%',
    zIndex: 10,
    ...Platform.select({
      web: {
        position: 'relative',
      },
    }),
  },
  sidebarAbsolute: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 112,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  sidebarHeaderCompact: {
    minHeight: 88,
    paddingVertical: 10,
  },
  sidebarHeaderCollapsed: {
    justifyContent: 'center',
    padding: 0,
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoTextCompact: {
    fontSize: 19,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  logoImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginRight: 12,
  },
  logoImageCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginRight: 10,
  },
  logoImageCollapsed: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  logoTextCollapsed: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  menuContainer: {
    flex: 1,
    paddingVertical: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 4,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  menuItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  menuItemActive: {
    // backgroundColor handled dynamically
  },
  menuItemHover: {
    // backgroundColor handled dynamically
  },
  menuText: {
    fontSize: 15,
    marginLeft: 15,
    fontWeight: '500',
  },
  menuTextActive: {
    // color handled dynamically
  },
  dropdownContainer: {
    paddingLeft: 44,
    paddingRight: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  dropdownItemActive: {
    backgroundColor: 'transparent',
  },
  dropdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  dropdownDotActive: {
    // backgroundColor handled dynamically
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '400',
  },
  dropdownTextActive: {
    fontWeight: '600',
  },
  userProfileSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  userProfileSectionCollapsed: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  userProfileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userProfileTopRowCollapsed: {
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoutButtonCollapsed: {
    marginTop: 12,
    paddingHorizontal: 0,
    width: 44,
    alignSelf: 'center',
  },
  logoutButtonText: {
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerExpanded: {
    height: 110,
    paddingVertical: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 12,
  },
  burgerButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  newRequestHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  newRequestSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  newRequestStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  newRequestStepWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newRequestStepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRequestStepText: {
    fontSize: 10,
    fontWeight: '700',
  },
  newRequestStepTextActive: {
    color: '#fff',
  },
  newRequestStepLine: {
    width: 22,
    height: 2,
    marginHorizontal: 4,
  },
  themeTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  themeIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeTextWrap: {
    minWidth: 45,
  },
  themeLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  themeValue: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
    minHeight: 0,
    padding: 20,
  },
  screenContainer: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  logoutModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  logoutModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  logoutCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  logoutCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8e1616',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

function MainLayoutWithProviders() {
  return (
    <NewRequestProvider>
      <MainLayout />
    </NewRequestProvider>
  );
}

export { MainLayoutWithProviders as default };