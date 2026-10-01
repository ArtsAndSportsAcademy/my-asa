import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { AsaAvatar } from "@/components/AsaAvatar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getAsaPresenceState } from "@workspace/shared";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [presenceState, setPresenceState] = useState(() => getAsaPresenceState());

  const mustChangePassword = !!user?.mustChangePassword;

  useEffect(() => {
    const timer = setInterval(() => setPresenceState(getAsaPresenceState()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    // Both (tabs) and (stack) are authenticated groups — treat them equally.
    const inAppGroup = segments[0] === "(tabs)" || segments[0] === "(stack)";
    const onForceChange = segments[0] === "force-password-change";

    if (!isAuthenticated && inAppGroup) {
      router.replace("/login");
    } else if (isAuthenticated && mustChangePassword && !onForceChange) {
      router.replace("/force-password-change");
    } else if (isAuthenticated && !mustChangePassword && !inAppGroup) {
      router.replace("/(tabs)/meu-dia");
    }
  }, [isAuthenticated, isLoading, mustChangePassword, segments]);

  if (isLoading) return <LoadingScreen />;

  const showAsaLauncher = isAuthenticated && !mustChangePassword
    && (segments[0] === "(tabs)" || segments[0] === "(stack)")
    && segments.join("/") !== "(stack)/asa";

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(stack)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="force-password-change" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      {showAsaLauncher && (
        <AsaAvatar
          size="small"
          state={presenceState}
          accessibilityLabel="Conversar com a ASA"
          onPress={() => router.push({ pathname: "/(stack)/asa", params: { from: segments.join("/") } })}
          containerStyle={{
            position: "absolute",
            zIndex: 100,
            right: 16,
            bottom: insets.bottom + (Platform.OS === "web" ? 88 : segments[0] === "(tabs)" ? 72 : 16),
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 8,
          }}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
