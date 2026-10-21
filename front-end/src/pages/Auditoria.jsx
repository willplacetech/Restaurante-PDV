import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Auditoria() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/auditoria', {
          headers: { Authorization: user ? `Bearer ${user.token}` : '' },
        });
        const data = await res.json();
        setRegistros(data.registros || []);
      } catch (erro) {
        console.error('Erro ao carregar auditoria:', erro);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [user]);

  if (carregando) return <div>Carregando auditoria...</div>;

  return (
    <div>
      <h2>Histórico de Auditoria</h2>
      {registros.length === 0 ? (
        <p>Nenhum registro encontrado.</p>
      ) : (
        <ul>
          {registros.map((r) => (
            <li key={r._id}>
              {r.acao} - {r.usuarioSolicitante?.username || ' sistema '} em {new Date(r.createdAt).toLocaleDateString('pt-BR')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}