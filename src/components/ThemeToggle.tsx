import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground transition-all" />
      ) : (
        <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-foreground transition-all" />
      )}
    </Button>
  );
}
