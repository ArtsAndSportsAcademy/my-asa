import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AsaAvatar } from "./AsaAvatar";
import { AsaSpeechBubble } from "./AsaSpeechBubble";

interface AsaConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  bubbleText?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function AsaConfirmModal({
  visible,
  onClose,
  title,
  bubbleText = "Tem certeza? Essa ação não pode ser desfeita. ⚠️",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
}: AsaConfirmModalProps) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.destructive }]}>{title}</Text>

          <View style={styles.asaRow}>
            <AsaAvatar size="small" pose="aviso_importante" />
            <View style={styles.bubbleWrap}>
              <AsaSpeechBubble text={bubbleText} visible={visible} duration={600000} />
            </View>
          </View>

          {description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.muted }]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.destructive }]}
              onPress={onConfirm}
            >
              <Text style={[styles.btnText, { color: colors.destructiveForeground }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  asaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  bubbleWrap: {
    flex: 1,
    paddingTop: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
