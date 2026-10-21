import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrateDb } from '../db/database';
import { useTheme, type AppTheme } from '../theme';
import { ensureNotificationSetup } from '../lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppSplash({ theme, onDone }: { theme: AppTheme; onDone: () => void }) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        SplashScreen.hideAsync().catch(() => undefined);
        onDone();
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [opacity, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.splash, { backgroundColor: theme.background, opacity }]}
    >
      <Image
        source={require('../../assets/ribongrant_rounded.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    ensureNotificationSetup().catch(() => undefined);
    SplashScreen.hideAsync().catch(() => undefined);
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
        {!splashDone ? <AppSplash theme={theme} onDone={() => setSplashDone(true)} /> : null}
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  splashLogo: { width: 220, height: 220 },
});
