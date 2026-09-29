import { useMemo } from 'react';
import { ThemeContext } from './ThemeContextDefinition.jsx';

/**
 * O sistema usa exclusivamente o tema claro.
 * O contexto permanece para preservar o contrato de importacao,
 * mas nao expoe alternancia de tema.
 */
export const ThemeProvider = ({ children }) => {
  const value = useMemo(() => ({ isDark: false }), []);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
