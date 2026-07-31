import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

/**
 * Botão de voltar para telas secundárias do stack.
 * Usa router.back() — funciona em qualquer ponto da pilha de navegação.
 */
export function BackButton({ color }: { color?: string }) {
  const router = useRouter();
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.back()}
      style={styles.btn}
      hitSlop={8}
      accessibilityLabel="Voltar"
      accessibilityRole="button"
    >
      <Feather name="chevron-left" size={26} color={color ?? colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: 4,
    padding: 2,
  },
});
