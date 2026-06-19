import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AsaAvatar } from "./AsaAvatar";

interface AsaEmptyStateProps {
  title: string;
  subtitle?: string;
}

export function AsaEmptyState({ title, subtitle }: AsaEmptyStateProps) {
  return (
    <View style={styles.container}>
      <AsaAvatar size="large" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#111827",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#6B7280",
    lineHeight: 20,
  },
});
