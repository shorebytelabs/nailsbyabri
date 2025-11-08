import React, { createContext, useContext, useMemo, useState } from 'react';
import classicChristmas from './classicChristmas.json';
import modernMaroon from './modernMaroon.json';

const themeRegistry = [classicChristmas, modernMaroon];
const themeIndex = themeRegistry.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {});

const defaultTheme = themeIndex.classicChristmas || themeRegistry[0];

const ThemeContext = createContext({
  theme: defaultTheme,
  themeId: defaultTheme.id,
  setThemeById: () => {},
  availableThemes: themeRegistry,
});

export function ThemeProvider({ initialThemeId = defaultTheme.id, children }) {
  const [themeId, setThemeId] = useState(
    themeIndex[initialThemeId] ? initialThemeId : defaultTheme.id,
  );

  const value = useMemo(() => {
    const theme = themeIndex[themeId] || defaultTheme;
    return {
      theme,
      themeId,
      setThemeById: setThemeId,
      availableThemes: themeRegistry,
    };
  }, [themeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;

