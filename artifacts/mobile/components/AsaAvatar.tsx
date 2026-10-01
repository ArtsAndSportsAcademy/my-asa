import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image as ExpoImage } from "expo-image";

export type AsaPose =
  | "idle"
  | "bomdia"
  | "boanoite"
  | "duvida"
  | "aviso_importante"
  | "arquivo"
  | "lembrete"
  | "tarefa_concluida"
  | "biblioteca"
  | "analisando"
  | "carregando"
  | "enviando"
  | "chuva"
  | "frio"
  | "recomendacao"
  | "comemoracao"
  | "vazio"
  | "focado"
  | "planejando"
  | "feliz";

export type AvatarState = "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia";

const AVATAR_STATE_TO_POSE: Record<AvatarState, AsaPose> = {
  feliz:       "feliz",
  duvida:      "duvida",
  comemoracao: "comemoracao",
  atencao:     "aviso_importante",
  sugestao:    "recomendacao",
  boanoite:    "boanoite",
  bomdia:      "bomdia",
};

export function avatarStateToPose(state: AvatarState | undefined): AsaPose {
  if (!state) return "idle";
  return AVATAR_STATE_TO_POSE[state] ?? "idle";
}

const REACTION_POSES: AsaPose[] = [
  "feliz", "comemoracao", "duvida", "bomdia", "recomendacao", "lembrete",
];

function randomReactionPose(current: AsaPose): AsaPose {
  const options = REACTION_POSES.filter((p) => p !== current);
  return options[Math.floor(Math.random() * options.length)];
}

type AsaSize = "small" | "medium" | "large";

const SIZE_MAP: Record<AsaSize, number> = {
  small:  48,
  medium: 80,
  large:  120,
};

const POSE_IMAGES: Record<AsaPose, number> = {
  idle: require("../assets/images/asa-poses-clean/oi.webp"),
  bomdia: require("../assets/images/asa-poses-clean/bom-dia.webp"),
  boanoite: require("../assets/images/asa-poses-clean/sonolenta.webp"),
  duvida: require("../assets/images/asa-poses-clean/duvida.webp"),
  aviso_importante: require("../assets/images/asa-poses-clean/aviso-importante.webp"),
  arquivo: require("../assets/images/asa-poses-clean/estudando.webp"),
  lembrete: require("../assets/images/asa-poses-clean/lembrete.webp"),
  tarefa_concluida: require("../assets/images/asa-poses-clean/tarefa-concluida.webp"),
  biblioteca: require("../assets/images/asa-poses-clean/estudando.webp"),
  analisando: require("../assets/images/asa-poses-clean/consultando.webp"),
  carregando: require("../assets/images/asa-poses-clean/pensativa.webp"),
  enviando: require("../assets/images/asa-poses-clean/travessa.webp"),
  chuva: require("../assets/images/asa-poses-clean/sonolenta.webp"),
  frio: require("../assets/images/asa-poses-clean/sonolenta.webp"),
  recomendacao: require("../assets/images/asa-poses-clean/pensativa.webp"),
  comemoracao: require("../assets/images/asa-poses-clean/vencemos.webp"),
  vazio: require("../assets/images/asa-poses-clean/oi.webp"),
  focado: require("../assets/images/asa-poses-clean/estudando.webp"),
  planejando: require("../assets/images/asa-poses-clean/pensativa.webp"),
  feliz: require("../assets/images/asa-poses-clean/olhos-de-estrela.webp"),
};

interface AsaAvatarProps {
  size?: AsaSize;
  pose?: AsaPose;
  state?: AvatarState;
  onPress?: () => void;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AsaAvatar({ size = "medium", pose, state, onPress, accessibilityLabel, containerStyle }: AsaAvatarProps) {
  const resolvedPose: AsaPose = pose ?? avatarStateToPose(state);
  const dimension = SIZE_MAP[size];

  const [activePose, setActivePose] = useState<AsaPose>(resolvedPose);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setActivePose(resolvedPose);
  }, [resolvedPose]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [floatAnim]);

  const handlePress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const reaction = randomReactionPose(resolvedPose);
    setActivePose(reaction);
    timerRef.current = setTimeout(() => {
      setActivePose(resolvedPose);
      timerRef.current = null;
    }, 1500);
  }, [resolvedPose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Pressable
      onPress={onPress ?? handlePress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { width: dimension, height: dimension }, containerStyle]}
    >
      <Animated.View
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <ExpoImage
          source={POSE_IMAGES[activePose]}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={0}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "visible",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    overflow: "visible",
    backgroundColor: "transparent",
  },
});
