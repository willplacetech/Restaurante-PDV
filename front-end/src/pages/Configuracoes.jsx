import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Configuracoes() {
  const { user } = useAuth();
  const [config, setConfig] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/configuracoes', {
          headers: { Authorization: user ? `Bearer ${user.token}` : '' },
        });
        const data = await res.json();
        setConfig(data);
      } catch (erro) {
        console.error('Erro ao carregar configurações:', erro);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [user]);

  if (carregando) return <div>Carregando configurações...</div>;

  return (
    <div>
      <h2>Configurações</h2>
      <p>Exigir autorização de gerente: {config.exigirAutorizacaoGerente ? 'Sim' : 'Não'}</p>
      <p>Bloqueado por suporte: {config.bloqueadoPorSuporte ? 'Sim' : 'Não'}</p>
    </div>
  );
}