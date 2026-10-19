import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrateDb } from '../db/database';
import { useTheme } from '../theme';
import { ensureNotificationSetup } from '../lib/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    ensureNotificationSetup().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="calendar.db" onInit={migrateDb}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="event" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
