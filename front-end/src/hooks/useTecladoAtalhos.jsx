import { useEffect } from 'react';

const useTecladoAtalhos = ({ onNovaVenda, onFocarBusca, onConfirmar } = {}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'F2') {
        event.preventDefault();
        onNovaVenda && onNovaVenda();
      } else if (event.key === 'F3') {
        event.preventDefault();
        onFocarBusca && onFocarBusca();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        onConfirmar && onConfirmar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNovaVenda, onFocarBusca, onConfirmar]);
};

export default useTecladoAtalhos;