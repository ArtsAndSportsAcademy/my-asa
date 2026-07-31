import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";

// Ecrãs secundários — empilhados sobre as abas.
// headerShown: false → cada ecrã renderiza o seu próprio cabeçalho.
// gestureEnabled: true → deslizar para a direita volta (iOS).
// animation: slide_from_right → transição padrão de stack.
export default function StackLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
