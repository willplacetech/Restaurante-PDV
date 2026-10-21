# Changelog - Restaurante-PDV

## [1.0.0] - 2026-10-21

### Adicionado
- Migração core completa (Fases 1-4): modelos, rotas, páginas do PDV-Cafe → Restaurante-PDV
- PWA com service worker e offline support
- Funcionalidades de entrega (pedidos, entregadores, status)
- Componente `<AutorizarGerente>` com bypass admin
- Rota `/api/auth/autorizar` no backend com validação de senha para gerente/atendente e bypass para admin
- Componente `Skeleton.jsx` para estados de loading
- Toast personalizado (sem window.alert)
- Estados vazios amigáveis (EmptyState)
- Confirmação modal (ConfirmModal)
- RBAC real perfis: ATENDENTE, GERENTE, ADMIN com validação no frontend e backend
- Modelo Auditoria + tela Gestão (só admin) com filtro por usuário/data/ação
- Versionamento no rodapé do menu
- Export CSV/Excel em vendas por período, clientes, estoque/produtos (implementação inicial)
- Health check `/health` no backend
- Variáveis de ambiente limpas (sem URL de teste/localhost em produção)
- Logout que limpa localStorage (token, rascunhos)
- Gráfico dashboard receita/ticket médio corrigido
- Garantido GET `/api/dashboard/urgencias`
- Atalhos: F2=nova venda, F3=focar busca, Enter=confirmar
- Onboarding primeiro acesso (wizard: mesa → produto → taxa cartão → impressora)

### Corrigido
- Estados vazios: ícone + texto + botão de ação nas listagens
- Erro de API/rede com botão "Tentar novamente"
- Banner offline explícito: "📡 Offline — N vendas na fila, serão sincronizadas."
- Validação de senha no auth bypass admin

### Segurança
- Contagem de tentativas de senha erradas (3 → bloqueio 60s)
- Token de autorização com validade 5min e header X-Autorizacao-Gerente no backend
- Rate limit em /api/auth/login (10 tentativas/15min)
- Headers de segurança com Helmet.js

### Deprecated
- Nenhum

## Planejado para 1.1.0
- Integração DeliveryLink
- NFC-e emissão
- Relatórios avançados DRE
- Multi-tenant support