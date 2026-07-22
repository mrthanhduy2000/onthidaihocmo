/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSettings } from "../types";
import { dbService } from "../services/db";

export type ThemeType = "light" | "dark" | "system";

interface ThemeContextType {
  theme: ThemeType;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<UserSettings>(() => dbService.getSettings());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const theme = settings.theme || "light";

  const applyTheme = (currentTheme: ThemeType) => {
    let activeTheme: "light" | "dark" = "light";

    if (currentTheme === "system") {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      activeTheme = systemPrefersDark ? "dark" : "light";
    } else {
      activeTheme = currentTheme;
    }

    setResolvedTheme(activeTheme);

    if (activeTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Update theme on settings change or system preference change
  useEffect(() => {
    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      
      // Modern browser support
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      } else {
        // Legacy browser support
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    const updatedSettings: UserSettings = {
      ...settings,
      theme: newTheme
    };
    setSettingsState(updatedSettings);
    dbService.saveSettings(updatedSettings);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
