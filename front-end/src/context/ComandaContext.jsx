import { createContext, useContext, useState } from 'react';

export const ComandaContext = createContext();

export const useComanda = () => useContext(ComandaContext);

export const ComandaProvider = ({ children }) => {
  const [comandaAtual, setComandaAtual] = useState(null);
  const [itensComanda, setItensComanda] = useState([]);
  const [totalComanda, setTotalComanda] = useState(0);

  const adicionarItem = (item) => {
    setItensComanda((itens) => [...itens, item]);
    setTotalComanda((total) => total + item.preco * item.quantidade);
  };

  const removerItem = (itemId) => {
    setItensComanda((itens) => itens.filter((item) => item.id !== itemId));
  };

  const clearComanda = () => {
    setItensComanda([]);
    setTotalComanda(0);
    setComandaAtual(null);
  };

  return (
    <ComandaContext.Provider
      value={{
        comandaAtual,
        setComandaAtual,
        itensComanda,
        totalComanda,
        adicionarItem,
        removerItem,
        clearComanda,
      }}
    >
      {children}
    </ComandaContext.Provider>
  );
};