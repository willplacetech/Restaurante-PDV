import { createContext, useContext } from 'react';

export const FormasPagamentoContext = createContext();

export const useFormasPagamento = () => useContext(FormasPagamentoContext);

export const FormasPagamentoProvider = ({ children }) => {
  const [formasPagamento, setFormasPagamento] = useState([]);

  return (
    <FormasPagamentoContext.Provider
      value={{
        formasPagamento,
        setFormasPagamento,
      }}
    >
      {children}
    </FormasPagamentoContext.Provider>
  );
};