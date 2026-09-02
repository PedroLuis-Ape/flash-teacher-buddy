import { useVisualPreferences } from "@/hooks/useVisualPreferences";

export function useTheme() {
  const {
    appearance,
    resolvedAppearance,
    setAppearance,
  } = useVisualPreferences();

  const toggleTheme = () => {
    setAppearance(resolvedAppearance === "dark" ? "light" : "dark");
  };

  return {
    theme: resolvedAppearance,
    appearance,
    setAppearance,
    toggleTheme,
  };
}
