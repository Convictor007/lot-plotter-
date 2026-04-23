import { Stack } from 'expo-router';
import { View } from 'react-native';

import { ScreenSafeArea } from '@/components/ScreenSafeArea';

export default function AuthLayout() {
  return (
    <ScreenSafeArea edges={['top', 'right', 'bottom', 'left']}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { flex: 1, backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot" />
          <Stack.Screen name="rememberme" />
        </Stack>
      </View>
    </ScreenSafeArea>
  );
}