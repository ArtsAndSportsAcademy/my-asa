import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

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

const POSE_IMAGES: Record<AsaPose, any> = {
  idle:              require("@/assets/images/asa-poses/idle.png"),
  bomdia:            require("@/assets/images/asa-poses/bomdia.png"),
  boanoite:          require("@/assets/images/asa-poses/boanoite.png"),
  duvida:            require("@/assets/images/asa-poses/duvida.png"),
  aviso_importante:  require("@/assets/images/asa-poses/aviso_importante.png"),
  arquivo:           require("@/assets/images/asa-poses/arquivo.png"),
  lembrete:          require("@/assets/images/asa-poses/lembrete.png"),
  tarefa_concluida:  require("@/assets/images/asa-poses/tarefa_concluida.png"),
  biblioteca:        require("@/assets/images/asa-poses/biblioteca.png"),
  analisando:        require("@/assets/images/asa-poses/analisando.png"),
  carregando:        require("@/assets/images/asa-poses/carregando.png"),
  enviando:          require("@/assets/images/asa-poses/enviando.png"),
  chuva:             require("@/assets/images/asa-poses/chuva.png"),
  frio:              require("@/assets/images/asa-poses/frio.png"),
  recomendacao:      require("@/assets/images/asa-poses/recomendacao.png"),
  comemoracao:       require("@/assets/images/asa-poses/comemoracao.png"),
  vazio:             require("@/assets/images/asa-poses/vazio.png"),
  focado:            require("@/assets/images/asa-poses/focado.png"),
  planejando:        require("@/assets/images/asa-poses/planejando.png"),
  feliz:             require("@/assets/images/asa-poses/feliz.png"),
};

interface AsaAvatarProps {
  size?: AsaSize;
  pose?: AsaPose;
  state?: AvatarState;
}

export function AsaAvatar({ size = "medium", pose, state }: AsaAvatarProps) {
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
      onPress={handlePress}
      style={[styles.container, { width: dimension, height: dimension }]}
    >
      <Animated.Image
        source={POSE_IMAGES[activePose]}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            transform: [{ translateY: floatAnim }],
          },
        ]}
        resizeMode="contain"
        fadeDuration={0}
      />
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
