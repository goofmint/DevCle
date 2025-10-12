import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

/**
 * Dark mode context value interface
 */
interface DarkModeContextValue {
  isDark: boolean;
  toggleDark: () => void;
}

/**
 * Dark mode context
 * Provides dark mode state and toggle function to all components
 */
const DarkModeContext = createContext<DarkModeContextValue | undefined>(undefined);

/**
 * Props for DarkModeProvider component
 */
interface DarkModeProviderProps {
  children: ReactNode;
}

/**
 * DarkModeProvider component
 * Manages dark mode state at application level and persists to localStorage
 *
 * Features:
 * - Loads dark mode preference from localStorage on mount
 * - Falls back to system preference (prefers-color-scheme) if no saved preference
 * - Persists user preference to localStorage when toggled
 * - Provides state and toggle function via Context API
 *
 * Usage:
 * ```tsx
 * // In root.tsx
 * <DarkModeProvider>
 *   <App />
 * </DarkModeProvider>
 *
 * // In any component
 * const { isDark, toggleDark } = useDarkMode();
 * ```
 */
export function DarkModeProvider({ children }: DarkModeProviderProps): JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Load dark mode preference on mount
  // Priority: 1. localStorage (user preference), 2. System preference (prefers-color-scheme)
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      // User has explicitly set a preference - use it
      setIsDark(savedMode === 'true');
    } else {
      // No saved preference - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
    setMounted(true);
  }, []);

  // Toggle dark mode and persist to localStorage
  const toggleDark = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('darkMode', String(newMode));
  };

  // Always provide context, even before mounted
  // This prevents "useDarkMode must be used within a DarkModeProvider" errors in tests
  return (
    <DarkModeContext.Provider value={{ isDark, toggleDark }}>
      {children}
    </DarkModeContext.Provider>
  );
}

/**
 * useDarkMode hook
 * Provides access to dark mode state and toggle function
 *
 * Usage:
 * ```tsx
 * const { isDark, toggleDark } = useDarkMode();
 * ```
 *
 * @throws {Error} If used outside of DarkModeProvider
 */
export function useDarkMode(): DarkModeContextValue {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}
