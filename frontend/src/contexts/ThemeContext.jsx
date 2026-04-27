import { createContext, useContext } from "react";

const ThemeContext = createContext({ dark: true });

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={{ dark: true }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
