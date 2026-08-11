import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../lib/auth';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="server-link" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="flight/[id]" />
          <Stack.Screen name="flight/new" />
          <Stack.Screen name="flight/edit/[id]" />
          <Stack.Screen name="visited-countries" />
          <Stack.Screen name="sharing" />
          <Stack.Screen name="users" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
