import { useState, useEffect } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import AreaTabs from '../components/AreaTabs.jsx';
import EmptyState from '../components/EmptyState.jsx';

// 🎯 Máscaras
const aplicarMascaraTelefone = (valor) => {
  if (!valor) return '';
  const apenasNumeros = valor.replace(/\D/g, '');
  if (apenasNumeros.length <= 2) return apenasNumeros.replace(/^(\d{0,2})/, '($1');
  if (apenasNumeros.length <= 7) return apenasNumeros.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  return apenasNumeros.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

const aplicarMascaraCPF = (valor) => {
  if (!valor) return '';
  const apenasNumeros = valor.replace(/\D/g, '');
  if (apenasNumeros.length <= 3) return apenasNumeros;
  if (apenasNumeros.length <= 6) return apenasNumeros.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
  if (apenasNumeros.length <= 9) return apenasNumeros.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  return apenasNumeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
};

const aplicarMascaraData = (valor) => {
  if (!valor) return '';
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 8);
  if (apenasNumeros.length <= 2) return apenasNumeros;
  if (apenasNumeros.length <= 4) return apenasNumeros.replace(/^(\d{2})(\d{0,2})/, '$1/$2');
  return apenasNumeros.replace(/^(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
};

const formularioVazio = { nome: '', telefone: '', endereco: '', cpf: '', aniversario: '' };

export default function Customers() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(formularioVazio);
  const [editing, setEditing] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const { showToast } = useToast();

  const carregar = async () => {
    try {
      const res = await api.get('/customers');
      setClientes(res.data || []);
    } catch (error) {
      console.error('Falha ao carregar clientes:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // O agendamento evita a renderizacao em cascata do primeiro carregamento.
    const inicial = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(inicial);
  }, []);

  // 🔒 Verifica duplicidade de CPF
  const cpfJaExiste = (cpf, idEdicao = null) => {
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    return clientes.some((c) =>
      String(c.cpf || '').replace(/\D/g, '') === cpfLimpo && c._id !== idEdicao
    );
  };

  const submit = async (event) => {
    event.preventDefault();

    const telefoneLimpo = form.telefone.replace(/\D/g, '');
    const cpfLimpo = form.cpf.replace(/\D/g, '');

    // ✅ Validações obrigatórias
    if (!form.nome.trim()) {
      return showToast('⚠️ Nome é obrigatório!', 'warning');
    }
    if (telefoneLimpo.length !== 11) {
      return showToast('⚠️ Telefone inválido! Digite com DDD e 9 dígitos', 'warning');
    }
    // 🔒 Verifica duplicidade de CPF
    if (cpfLimpo && cpfLimpo.length !== 11) {
      return showToast('⚠️ CPF inválido! Digite os 11 números ou deixe em branco', 'warning');
    }
    if (cpfLimpo && cpfJaExiste(cpfLimpo, editing?._id)) {
      return showToast('⚠️ Este CPF já está cadastrado!', 'warning');
    }

    const dadosParaEnviar = {
      nome: form.nome.trim(),
      telefone: telefoneLimpo,
      cpf: cpfLimpo,
      aniversario: form.aniversario.replace(/\D/g, '').length === 8 ? form.aniversario : '',
    };

    try {
      editing
        ? await api.put(`/customers/${editing._id}`, dadosParaEnviar)
        : await api.post('/customers', dadosParaEnviar);

      showToast(editing ? '✅ Cliente atualizado!' : '✅ Cliente cadastrado!', 'success');
      setForm(formularioVazio);
      setEditing(null);
      carregar();
    } catch {
      showToast('❌ Erro ao salvar', 'error');
    }
  };

  const alterar = (cliente) => {
    setEditing(cliente);
    setForm({
      nome: cliente.nome,
      telefone: aplicarMascaraTelefone(cliente.telefone || ''),
      endereco: cliente.endereco || '',
      aniversario: aplicarMascaraData(cliente.aniversario || ''),
      cpf: aplicarMascaraCPF(cliente.cpf || ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remover = async (id) => {
    if (!window.confirm('Excluir este cliente?')) return;
    try {
      await api.delete(`/customers/${id}`);
      showToast('Cliente removido', 'warning');
      carregar();
    } catch (err) {
      showToast(err.response?.data?.msg || 'Erro ao excluir cliente', 'error');
    }
  };

  const handleTelefoneChange = (event) => {
    const valor = event.target.value.replace(/\D/g, '').slice(0, 11);
    setForm({ ...form, telefone: aplicarMascaraTelefone(valor) });
  };

  const handleCpfChange = (event) => {
    const valor = event.target.value.replace(/\D/g, '').slice(0, 11);
    setForm({ ...form, cpf: aplicarMascaraCPF(valor) });
  };

  return (
    <div className="page">
      <AreaTabs area="pessoas" />

      <header className="page-heading">
        <div>
          <h1>Clientes</h1>
          <p>Gerencie sua base de clientes.</p>
        </div>
      </header>

      <section className="card" aria-labelledby="cliente-form-titulo">
        <div className="card__header">
          <h2 className="card-title" id="cliente-form-titulo">
            {editing ? 'Editar cliente' : 'Novo cliente'}
          </h2>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span className="label">Nome *</span>
              <input
                id="cliente-nome"
                placeholder="Nome completo"
                value={form.nome}
                required
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
              />
            </label>

            <label className="field">
              <span className="label">Telefone *</span>
              <input
                placeholder="(11) 99999-9999"
                value={form.telefone}
                onChange={handleTelefoneChange}
                inputMode="numeric"
                required
              />
            </label>

            <label className="field">
              <span className="label">CPF <small>(opcional, único)</small></span>
              <input
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={handleCpfChange}
                inputMode="numeric"
              />
            </label>

            <label className="field">
              <span className="label">Aniversário <small>(opcional)</small></span>
              <input
                placeholder="DD/MM/AAAA"
                value={form.aniversario}
                onChange={(event) => setForm({ ...form, aniversario: aplicarMascaraData(event.target.value) })}
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="btn-row btn-row--stretch">
            <button type="submit" className="btn-primary">
              {editing ? 'Atualizar cliente' : 'Cadastrar cliente'}
            </button>
            {editing && (
              <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(formularioVazio); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="clientes-lista-titulo">
        <div className="card__header">
          <h2 className="card-title" id="clientes-lista-titulo">Cadastrados</h2>
          <span className="badge badge--neutral">{clientes.length}</span>
        </div>

        {carregando ? (
          <div className="state" role="status" aria-live="polite">
            <span className="state__text">Carregando clientes...</span>
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Nenhum cliente cadastrado"
            description="Cadastre clientes para identificar vendas e enviar comprovantes pelo WhatsApp."
          >
            <button
              type="button"
              className="btn-primary"
              onClick={() => document.getElementById('cliente-nome')?.focus()}
            >
              Cadastrar cliente
            </button>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Lista de clientes cadastrados</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Aniversário</th>
                  <th scope="col" className="num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente._id}>
                    <td style={{ fontWeight: 600 }}>{cliente.nome}</td>
                    <td className="num">{aplicarMascaraTelefone(cliente.telefone) || '—'}</td>
                    <td className="num">{aplicarMascaraCPF(cliente.cpf) || '—'}</td>
                    <td className="num">{cliente.aniversario || '—'}</td>
                    <td className="num">
                      <div className="btn-row">
                        <button type="button" className="btn-secondary" onClick={() => alterar(cliente)}>
                          Editar<span className="visually-hidden"> {cliente.nome}</span>
                        </button>
                        <button type="button" className="btn-danger" onClick={() => remover(cliente._id)}>
                          Excluir<span className="visually-hidden"> {cliente.nome}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
