import React from "react";
import { Image, StyleSheet, View } from "react-native";

type AsaSize = "small" | "medium" | "large";

const SIZE_MAP: Record<AsaSize, number> = {
  small: 48,
  medium: 80,
  large: 120,
};

interface AsaAvatarProps {
  size?: AsaSize;
}

export function AsaAvatar({ size = "medium" }: AsaAvatarProps) {
  const dimension = SIZE_MAP[size];
  return (
    <View style={[styles.wrapper, { width: dimension, height: dimension }]}>
      <Image
        source={require("@/assets/images/asa-avatar.png")}
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    borderRadius: 999,
  },
});
