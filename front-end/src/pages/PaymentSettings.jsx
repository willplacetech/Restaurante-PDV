import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function PaymentSettings() {
  const { user } = useAuth();
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/payment-settings', {
          headers: { Authorization: user ? `Bearer ${user.token}` : '' },
        });
        const data = await res.json();
        setFormasPagamento(data.formasPagamento || []);
      } catch (erro) {
        console.error('Erro ao carregar formas de pagamento:', erro);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [user]);

  if (carregando) return <div>Carregando configurações de pagamento...</div>;

  return (
    <div>
      <h2>Configurações de Pagamento</h2>
      <ul>
        {formasPagamento.map((f) => (
          <li key={f.tipo}>
            {f.nome}: {f.taxaPercentual ? f.taxaPercentual + '%' : 'N/A'}
          </li>
        ))}
      </ul>
    </div>
  );
}