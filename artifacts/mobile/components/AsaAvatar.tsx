import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type AsaSize = "small" | "medium" | "large";
export type AvatarState = "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia";

const SIZE_MAP: Record<AsaSize, number> = {
  small: 48,
  medium: 80,
  large: 120,
};

const STATE_EMOJI: Record<AvatarState, string> = {
  feliz:       "😊",
  duvida:      "🤔",
  comemoracao: "🎉",
  atencao:     "⚠️",
  sugestao:    "💡",
  boanoite:    "🌙",
  bomdia:      "☀️",
};

interface AsaAvatarProps {
  size?: AsaSize;
  state?: AvatarState;
}

export function AsaAvatar({ size = "medium", state }: AsaAvatarProps) {
  const dimension = SIZE_MAP[size];
  const badgeSize = Math.round(dimension * 0.38);
  return (
    <View style={[styles.wrapper, { width: dimension, height: dimension }]}>
      <Image
        source={require("@/assets/images/asa-avatar.png")}
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
        resizeMode="cover"
      />
      {state && state !== "feliz" && (
        <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
          <Text style={{ fontSize: badgeSize * 0.65, lineHeight: badgeSize }}>
            {STATE_EMOJI[state]}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "visible",
    borderRadius: 999,
  },
  badge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
