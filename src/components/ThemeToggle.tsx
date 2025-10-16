import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center transition-colors duration-300"
      aria-label="Alternar tema"
    >
      <div
        className={`absolute w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
          theme === "dark" ? "translate-x-7" : "translate-x-1"
        }`}
      />
      {theme === "dark" ? (
        <Moon className="absolute left-1 text-white w-4 h-4 z-10" />
      ) : (
        <Sun className="absolute right-1 text-yellow-500 w-4 h-4 z-10" />
      )}
    </button>
  );
}
