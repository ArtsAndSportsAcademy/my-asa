import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

const ASINHA_SVG = `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" fill="none">
  <defs>
    <linearGradient id="gla" x1="72" y1="6" x2="18" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#9333EA"/>
      <stop offset="55%" stop-color="#6D28D9"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="glb" x1="78" y1="22" x2="20" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="glc" x1="80" y1="42" x2="22" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6D28D9"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
  </defs>
  <path d="M 16,106 C 10,80 8,50 18,22 C 28,2 56,-2 76,10 C 62,18 46,34 36,58 C 28,76 22,92 16,106 Z" fill="url(#gla)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 20,106 C 16,84 18,60 28,40 C 40,18 64,10 82,20 C 68,28 54,46 46,66 C 36,84 28,96 20,106 Z" fill="url(#glb)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 24,106 C 20,88 22,70 32,54 C 44,36 68,28 84,38 C 72,46 60,60 52,78 C 44,92 34,100 24,106 Z" fill="url(#glc)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

export function LoadingScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulse, alignItems: "center" }}>
        <SvgXml xml={ASINHA_SVG} width={56} height={63} />
        <Text style={styles.name}>MyASA</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#5B21B6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 14,
    letterSpacing: -0.5,
  },
});
