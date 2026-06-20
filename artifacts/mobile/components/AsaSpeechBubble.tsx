import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AsaSpeechBubbleProps {
  text: string;
  duration?: number;
  visible?: boolean;
  style?: ViewStyle;
}

export function AsaSpeechBubble({ text, duration = 4000, visible = true, style }: AsaSpeechBubbleProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!visible) {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 160, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, text]);

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ scale }] }, style]}>
      <View style={styles.tail}>
        <View style={[styles.tailOuter, { borderRightColor: colors.border }]} />
        <View style={[styles.tailInner, { borderRightColor: colors.card }]} />
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.text, { color: colors.foreground }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 4,
  },
  tail: {
    justifyContent: "center",
    paddingTop: 10,
  },
  tailOuter: {
    position: "absolute",
    left: 0,
    top: 10,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 9,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  tailInner: {
    position: "absolute",
    left: 1.5,
    top: 11,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  bubble: {
    marginLeft: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
