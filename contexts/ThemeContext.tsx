import React, { createContext, useContext, useState, useEffect } from 'react';

import { lightColors, darkColors } from '../constants/Colors';
import { getItem, setItem } from '@/lib/appStorage';

const THEME_STORAGE_KEY = 'theme';

export type AppThemeColors = typeof lightColors;

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: AppThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  colors: lightColors,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dark') {
          setIsDarkMode(true);
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await setItem(THEME_STORAGE_KEY, newTheme ? 'dark' : 'light');
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const colors: AppThemeColors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
