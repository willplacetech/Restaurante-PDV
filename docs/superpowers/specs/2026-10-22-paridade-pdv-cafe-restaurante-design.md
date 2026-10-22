# Paridade funcional PDV-Cafe → Restaurante-PDV

## Objetivo

Levar o Restaurante-PDV à paridade funcional com a aplicação principal do
PDV-Cafe na referência definida abaixo, mantendo o Restaurante como projeto
independente, com seus dados e identidade visual próprios. O repositório do
PDV-Cafe é somente fonte de consulta e não pode receber alterações.

“Paridade” significa equivalência observável de fluxos, regras, permissões,
contratos e resultados persistidos para as capacidades incluídas no escopo;
não significa igualdade de código, telas, marca ou CSS.

## Decisões e limites

- **Referência inicial:** `willplacetech/PDV-Cafe`, branch
  `feature/pwa-offline-sincronizacao`, commit
  `4475c86349a2f414c0084e8f7beb4d43384c1a5a`, verificado localmente em
  2026-10-22. Antes de cada fase, confirmar se essa referência continua sendo
  a versão solicitada ou se uma versão mais nova deve substituir o baseline.
- **Destino:** `willplacetech/Restaurante-PDV`, branch `main`, baseline
  inicialmente observado em `f0fe5b09cb37e9f0e88f56c2ec0a40dc1be2de05`.
  Preservar alterações de terceiros e revalidar a árvore antes de editar.
- **PDV-Cafe:** somente leitura. Não fazer checkout, edição, commit, push,
  instalação de dependências ou execução que altere seu estado.
- **Estilo:** preservar marca, paleta, tipografia, assets, componentes e
  organização visual do Restaurante. Portar comportamento e conteúdo funcional,
  adaptando-os à apresentação existente em vez de copiar CSS/tema do Café.
- **Preparação:** apresentar um único tipo visível e selecionável,
  **Preparação**, para os antigos tipos “Coz — na hora” e “Produção própria —
  lote”. Preservar um modo operacional interno equivalente a `sob_demanda` ou
  `lote`, para manter consumo de insumos, estoque, fila da cozinha, rendimento
  e custos. Produtos antigos devem continuar operando sem perda de dados.
- **Compatibilidade:** manter contratos existentes do Restaurante sempre que
  possível. Qualquer incompatibilidade inevitável deve ser versionada,
  documentada e coberta por migração e testes.
- **Limite de produto:** o escopo é a aplicação PDV principal. Ferramentas,
  templates e serviços externos ou independentes apenas armazenados no mesmo
  repositório de referência não são automaticamente incorporados.
- Não emitir documentos fiscais sem provedor configurado e não copiar
  credenciais, segredos ou dados reais do ambiente de origem.

## Diagnóstico inicial conhecido

O destino já contém rotas e telas para autenticação, produtos, comandas,
estoque, produção, compras, financeiro, dashboard e delivery, mas a revisão
anterior encontrou integração incompleta. Os problemas registrados incluem
falha de build e lint no frontend, testes de recorrência financeira falhos,
lacunas em sessão revogável, operação offline, paginação e impressão, além de
erros em handlers de delivery e imports referenciados ausentes. Esses achados
devem ser reproduzidos na fase de baseline; não são presumidos como estado
atual até nova execução.

## Domínios funcionais e critérios de aceite

### 1. Baseline e inventário

- Criar inventário rastreável das capacidades da aplicação de referência,
  modelos, APIs, permissões, rotas, fluxos e testes relevantes.
- Mapear cada capacidade como existente, parcial, ausente, incompatível ou
  fora de escopo no Restaurante.
- Não declarar uma capacidade concluída somente por encontrar um arquivo ou
  tela: verificar o fluxo ponta a ponta e seus efeitos persistidos.
- Manter uma matriz de rastreabilidade entre requisito, implementação e
  teste como parte dos artefatos da migração.

### 2. Dados, modelos e contratos

- Mapear entidades, campos, enumerações, validações, índices e relações entre
  os dois sistemas.
- Migrar dados do Restaurante de modo aditivo, idempotente e seguro para
  repetição; preservar registros e compatibilidade com clientes existentes.
- Para alterações destrutivas ou irreversíveis, exigir plano de backup,
  verificação prévia e procedimento documentado de recuperação antes de
  executá-las.
- Validar serialização, datas, valores monetários, unidades fracionárias,
  estados e referências entre documentos.

### 3. Autenticação, autorização e auditoria

- Igualar os fluxos necessários de autenticação, expiração e encerramento de
  sessão, recuperação/alteração de credenciais e controle por função.
- Aplicar autorização no servidor em todas as rotas protegidas, não apenas
  ocultar controles no frontend.
- Auditar ações sensíveis com ator, ação, recurso, instante e resultado, sem
  registrar credenciais ou tokens.
- Cobrir revogação de sessão, privilégios insuficientes e falhas de
  autenticação com testes.

### 4. Integridade de venda, estoque e financeiro

- Preservar consistência entre vendas/comandas, pagamentos, caixa, estoque,
  insumos, custos e cancelamentos/estornos.
- Repetições de requisições e falhas parciais não podem duplicar cobranças,
  movimentos ou baixas; usar idempotência ou transações conforme o modelo.
- Aplicar as regras existentes de peso, volume, quantidade fracionária,
  descontos, taxas e arredondamento; validar os resultados no backend.
- Manter rastreabilidade dos movimentos e impedir saldos negativos quando a
  regra de negócio exigir essa restrição.

### 5. Preparação, receitas e produção

- O cadastro apresenta uma única categoria **Preparação** para itens antes
  classificados como Coz ou Produção própria.
- O modo operacional interno determina, de forma explícita e validada, se a
  venda prepara sob demanda ou se a equipe produz lote para gerar estoque.
- Migração de produtos antigos infere o modo a partir dos campos e valores
  legados já confiáveis; casos ambíguos são relatados para resolução, não
  convertidos silenciosamente.
- Preservar o comportamento por modo: consumo da ficha técnica, rendimento,
  estoque do produto pronto, fila da cozinha, custo e disponibilidade.
- Testar criação, edição, venda, produção, cancelamento e migração de ambos os
  modos, incluindo registros antigos.

### 6. Delivery

- Igualar os fluxos de configuração, entrada, atribuição, acompanhamento,
  atualização de estado, conclusão e cancelamento de pedidos de delivery que
  pertençam à aplicação principal.
- Validar transições de estado e autorização no servidor; impedir atualizações
  concorrentes de sobrescreverem dados ou produzirem auditoria incorreta.
- Cobrir taxas, pagamentos, dados de cliente/endereço, integração com pedidos
  e consistência financeira.
- Localização do entregador e serviços externos só entram no escopo se fizerem
  parte da aplicação PDV principal na referência e houver um contrato seguro
  definido; não copiar automaticamente um serviço independente.

### 7. PWA e operação offline

- Disponibilizar os recursos offline definidos pela aplicação de referência,
  com armazenamento local delimitado, indicação clara do estado de conexão e
  fila de sincronização persistente.
- A sincronização deve ser idempotente e explicitar conflitos, itens pendentes
  e falhas; não apresentar sucesso antes da confirmação do servidor.
- Não permitir que ações offline contornem autorização ou regras de caixa,
  estoque e pagamento. Restrições e operações não permitidas offline devem ser
  explícitas para o usuário.
- Testar desconexão, reabertura, repetição, reconexão, conflito e falha de
  sincronização sem duplicar operações.

### 8. Impressão

- Implementar configuração local da impressora e opções de impressão que
  estejam na aplicação de referência, sem enviar preferências ou documentos
  locais ao backend quando o modelo de referência não o fizer.
- Preservar venda confirmada mesmo se a impressão falhar; disponibilizar
  reimpressão com estado de erro visível e sem duplicar venda.
- Cobrir comprovantes e tickets por setor, observações, desconexão e
  impressão do sistema, além dos protocolos de dispositivo suportados.
- Tratar configuração fiscal e impressão fiscal apenas por integração
  explicitamente configurada; não simular emissão fiscal bem-sucedida.

### 9. Dashboard, relatórios e paginação

- Igualar métricas, filtros, períodos, totais e regras dos relatórios da
  aplicação principal; somas devem corresponder aos registros da fonte.
- Usar paginação consistente nas listas volumosas, preservando filtros,
  ordenação, limites validados e contratos da API.
- Separar estados de carregamento, erro e ausência de dados, sem exibir dados
  desatualizados como se fossem atuais.
- Testar limites de página, totais, períodos vazios e mudanças rápidas de
  filtro.

### 10. Integração frontend e experiência

- Ligar todas as telas às APIs reais e a estados de carregamento, vazio e erro
  coerentes; não manter mocks como caminho de produção.
- Integrar rotas, navegação, permissões, validação e feedback para cada fluxo
  incluído no inventário.
- Adaptar componentes ao estilo do Restaurante. Mudanças visuais necessárias
  devem ser pontuais e não introduzir o tema do Café.
- Garantir acessibilidade básica e funcionamento em larguras suportadas, sem
  reduzir a identidade visual do Restaurante a uma cópia da referência.

### 11. Testes e qualidade

- Restaurar primeiro uma baseline reproduzível de build, lint e testes do
  Restaurante, separando falhas preexistentes de falhas introduzidas.
- Acrescentar testes unitários e de integração para regras, permissões,
  migrações e contratos; incluir testes end-to-end dos fluxos críticos.
- Executar a suíte completa aplicável e corrigir regressões ligadas à
  migração. Falhas preexistentes devem ser resolvidas ou isoladas com evidência
  antes de afirmar paridade.
- Para cada requisito da matriz, registrar evidência verificável de teste ou
  validação manual controlada.

### 12. Configuração, CI, deploy e documentação

- Harmonizar scripts e CI no Restaurante para validar backend, frontend,
  migrações e testes sem depender de segredos reais.
- Documentar variáveis, mudanças de dados, compatibilidade, operação offline,
  impressão, migração e recuperação.
- Validar deploy e health checks em ambiente apropriado antes de qualquer
  publicação; nenhuma implantação de produção está autorizada por esta
  especificação.
- Não copiar arquivos de ambiente nem valores secretos do Café.

## Estratégia de execução

1. Confirmar referências, estado Git e ferramentas; reproduzir build, lint e
   testes para fixar a baseline.
2. Completar o inventário comparativo e a matriz de rastreabilidade; ordenar
   lacunas por dependência e risco.
3. Corrigir bloqueios de qualidade que impeçam a validação contínua, mantendo
   correções dentro do Restaurante e do escopo.
4. Implementar em mudanças pequenas por domínio, começando por modelos,
   compatibilidade e controles de acesso; avançar para integridade operacional,
   delivery, offline, impressão e relatórios.
5. Integrar cada domínio à interface existente e preservar o estilo local.
6. Executar validação abrangente, migração em dados de teste e testes ponta a
   ponta; só declarar paridade quando todos os critérios de aceite aplicáveis
   estiverem cobertos.

Dependências entre domínios devem ser registradas no plano de implementação.
Migrações de dados devem ser testadas em cópia descartável antes de qualquer
ambiente persistente. A execução não pode escrever no repositório do Café.

## Riscos e mitigação

- **Diferenças semânticas entre modelos:** inventário de contratos e migração
  versionada; validar casos ambíguos sem conversão silenciosa.
- **Regressão em caixa/estoque/custos:** idempotência, transações, movimentos
  rastreáveis e testes de fluxos completos.
- **Falhas de origem no Restaurante mascararem regressões:** baseline separada
  e resultados antes/depois registrados por comando.
- **Offline gerar duplicidade ou falsos sucessos:** identificadores estáveis,
  confirmação do servidor, reconciliação e testes de repetição/conflito.
- **Port alterar visual indesejadamente:** revisão explícita de CSS, assets e
  tokens; manter adaptação no padrão do Restaurante.
- **Escopo excessivo:** dividir por domínio em entregas revisáveis, cada uma
  com critérios de aceite e sem declarar a migração total concluída antes de
  todas as fases.

## Critério de conclusão

A migração só pode ser declarada concluída quando:

1. A matriz confirmar todas as capacidades da aplicação principal da
   referência como implementadas ou explicitamente justificadas fora de
   escopo.
2. Os fluxos e dados do Restaurante satisfizerem os critérios por domínio,
   inclusive os dois modos legados sob a categoria Preparação.
3. Build, lint, testes unitários, integração e E2E aplicáveis passarem, com
   eventuais exceções documentadas e sem falhas novas não resolvidas.
4. A validação de migração provar idempotência e preservação de dados de teste.
5. A comparação confirmar que o estilo próprio do Restaurante foi mantido.
6. O repositório PDV-Cafe permanecer sem alterações causadas por esta tarefa.

Esta especificação não autoriza executar migração em produção, alterar
provedores fiscais, publicar deploy ou modificar o repositório de referência.
