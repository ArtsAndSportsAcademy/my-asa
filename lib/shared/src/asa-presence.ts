export type AsaPresenceState = "bomdia" | "feliz" | "boanoite";

export function getAsaPresenceState(date = new Date()): AsaPresenceState {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "bomdia";
  if (hour >= 18) return "boanoite";
  if (hour < 5) return "boanoite";
  return "feliz";
}
