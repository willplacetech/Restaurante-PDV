# PDV Restaurante

Sistema de PDV para restaurante (MERN stack) — versão de demonstração genérica.

## Principais funcionalidades

- Produtos vendidos por unidade, peso ou volume (até 3 casas decimais)
- Comandas para mesa/balcão com lançamento de itens e fechamento com baixa de estoque
- Controle de produção e fichas técnicas
- Gestão de compras e estoque de insumos
- Financeiro: caixa, contas a receber, DRE
- Configuração fiscal segura via `GET /api/fiscal/config`

## Fiscal

Nenhum documento fiscal é emitido sem configuração explícita de provedor. Defina as variáveis do arquivo `back-end/.env.example` após escolher o emissor e instalar o respectivo adaptador. As credenciais devem permanecer somente no servidor.

## Execução local

Em terminais separados:

```bash
cd back-end && npm install && npm run dev
cd front-end && npm install && npm run dev
```

Crie `back-end/.env` a partir de `.env.example` e informe a conexão MongoDB antes de iniciar a API.

## Deploy no Render

O repositório inclui `render.yaml` para criar o front-end estático e a API Node.js pelo fluxo **New + Blueprint**. No Render, conecte este repositório e informe apenas a variável secreta `MONGO_URI` da instância MongoDB.

Após salvar a `MONGO_URI`, o Render executa os dois deploys automaticamente. Não coloque essa URI no GitHub.