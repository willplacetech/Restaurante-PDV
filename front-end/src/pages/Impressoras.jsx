import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Impressoras() {
  const { user } = useAuth();
  [impressoras, setImpressoras] = useState([]);
  [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/impressoras', {
          headers: { Authorization: user ? `Bearer ${user.token}` : '' },
        });
        const data = await res.json();
        setImpressoras(data.impressoras || []);
      } catch (erro) {
        console.error('Erro ao carregar impressoras:', erro);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [user]);

  if (carregando) return <div>Carregando impressoras...</div>;

  return (
    <div>
      <h2>Impressoras</h2>
      <ul>
        {impressoras.map((i) => (
          <li key={i.id}>{i.nome} - {i.porta}</li>
        ))}
      </ul>
    </div>
  );
}