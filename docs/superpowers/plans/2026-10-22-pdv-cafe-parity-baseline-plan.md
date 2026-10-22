# PDV-Cafe Parity Baseline and Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a verified baseline and a traceable capability matrix that decomposes the approved full-parity specification into safe, independently implementable domain plans.

**Architecture:** This first plan is read-only against both applications except for new documentation in Restaurante-PDV. It verifies the fixed reference and destination baselines, records existing validation outcomes, and maps reference capabilities to destination evidence and acceptance tests. It does not implement product behavior; each independent domain receives a detailed follow-up plan after its contracts and file ownership are known.

**Tech Stack:** Git, Node.js, npm, Express, MongoDB/Mongoose, React, Vite, Jest, Cypress, Markdown.

**Spec:** `docs/superpowers/specs/2026-10-22-paridade-pdv-cafe-restaurante-design.md`

## Global Constraints

- O repositório do PDV-Cafe é somente fonte de consulta e não pode receber alterações.
- Preservar marca, paleta, tipografia, assets, componentes e organização visual do Restaurante.
- Use reference baseline `willplacetech/PDV-Cafe` branch `feature/pwa-offline-sincronizacao`, commit `4475c86349a2f414c0084e8f7beb4d43384c1a5a`, subject to the spec's per-phase baseline confirmation.
- Não emitir documentos fiscais sem provedor configurado e não copiar credenciais, segredos ou dados reais do ambiente de origem.
- Esta especificação não autoriza executar migração em produção, alterar provedores fiscais, publicar deploy ou modificar o repositório de referência.
- Record a validation command as blocked if its required package/tool is missing; do not install dependencies or modify manifests for baseline collection.
- Do not report a feature as complete based on file presence alone; record route, behavior, persistence, permission, and test evidence where available.

## Review Focus

- Replayed sale, cancellation, or synchronization request must not duplicate payment, stock movement, or order; record which existing tests assert idempotency and assign missing tests to the owning domain plan.
- Direct API calls by an unauthorized role must be denied server-side; record route-authorization test coverage and assign gaps to the auth domain plan.
- Legacy preparation product with conflicting or missing flags must not be silently mapped; identify ambiguous records and assign migration behavior tests to the preparation/data plan.
- Offline queue restored after reload must expose pending, failed, and conflicting work without success-shaped fallbacks; record test coverage and assign gaps to the PWA plan.
- Printer failure after a committed sale must not reverse or duplicate that sale; record test coverage and assign gaps to the printing plan.

---

## Scope and decomposition

The approved specification spans multiple independent subsystems. This plan covers only the prerequisite baseline and inventory deliverable. It deliberately does not create speculative implementation steps for auth, financial integrity, delivery, offline/PWA, printing, preparation, or reporting before their concrete contracts, current files, and gaps are inventoried. Once the matrix is reviewed, each domain will have its own implementation plan with exact file ownership, interfaces, tests, and dependencies. Parallel work packets must have non-overlapping owned files; shared integration remains assigned to one coordinator.

## File structure

- Create `docs/superpowers/parity-baseline.md` — immutable reference/destination hashes, available scripts, executed validation commands, outcomes, environment blockers, and pre-existing failures.
- Create `docs/superpowers/parity-matrix.md` — traceability from reference capability to source evidence, destination evidence, status, dependency, acceptance tests, and a follow-up plan.
- Modify no application source, package manifest, assets, environment file, or file in PDV-Cafe.

## Tasks

### Task 1: Capture reproducible repository and validation baselines

**Files:**
- Read only: `C:\Users\user\Documents\PDV-Cafe`
- Read only: current Restaurante-PDV application and package manifests
- Create: `docs/superpowers/parity-baseline.md`

**Interfaces:**
- Consumes: approved spec and exact reference/destination commits.
- Produces: dated baseline record with command, exit code, concise output, and failure classification for each attempted check.

- [ ] **Step 1: Verify both repository states and commit identities**

Run in PowerShell:

```powershell
git -C "C:\Users\user\Documents\PDV-Cafe" status --short --branch
git -C "C:\Users\user\Documents\PDV-Cafe" rev-parse HEAD
git -C "C:\Users\user\Documents\Restaurante-PDV" status --short --branch
git -C "C:\Users\user\Documents\Restaurante-PDV" rev-parse HEAD
```

Expected: record the Café reference commit and Restaurante destination commit; stop if the reference differs from the spec or has local changes that make its contents uncertain. Do not checkout, fetch, or modify the Café.

- [ ] **Step 2: Record stack and available scripts**

Read root, backend, and frontend `package.json` files in both repositories. Record Node/npm version and available test, build, lint, and E2E scripts. Do not infer parity from dependency or script names.

- [ ] **Step 3: Run destination baseline checks without installing packages**

Run each available command separately from `C:\Users\user\Documents\Restaurante-PDV`:

```powershell
npm test
npm --prefix front-end run build
npm --prefix front-end run lint
npm run test:frontend
```

Expected: record actual exit code and first actionable failure for every command. A pre-existing failure or missing package is a baseline result, not a reason to edit code in this inventory task. Do not run destructive migrations, connect to production, or install dependencies.

- [ ] **Step 4: Write `docs/superpowers/parity-baseline.md`**

Include verified commit IDs, clean/dirty status, runtime versions, script availability, validation results, any environment blockers, and a clear distinction between reproduced failures and historical reports. Never include secret values.

- [ ] **Step 5: Check baseline document formatting**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Review that only the new Restaurante documentation is untracked/changed and that the Café state is unchanged.

### Task 2: Build the capability and evidence matrix

**Files:**
- Read only: relevant source, route, model, component, and test files at the pinned Café reference.
- Read only: corresponding Restaurante files.
- Create: `docs/superpowers/parity-matrix.md`

**Interfaces:**
- Consumes: `docs/superpowers/parity-baseline.md`.
- Produces: one stable matrix row per observable capability, with evidence sufficient for a follow-up implementer to locate both implementations and the required acceptance behavior.

- [ ] **Step 1: Enumerate in-scope application capabilities**

Inspect application routes, server mounts, models, frontend routes/screens, and relevant tests at the exact reference commit. Exclude independent templates/services unless they are demonstrably part of the primary PDV application. Include the 12 spec domains and their user-visible or persisted flows.

- [ ] **Step 2: Map the corresponding destination behavior**

For each reference capability, inspect the Restaurante route/API, model, frontend entry point, authorization, persistence effects, and tests. Mark exactly one status: `existing`, `partial`, `missing`, `incompatible`, or `out-of-scope`.

- [ ] **Step 3: Record the five high-risk review cases**

For replayed financial/sync operations, unauthorized direct API calls, ambiguous legacy preparation records, restored offline conflicts, and print failure after sale, record current evidence and the exact owning follow-up domain plan. Do not mark a scenario covered unless a test asserts its outcome.

- [ ] **Step 4: Write `docs/superpowers/parity-matrix.md`**

Use columns: `ID`, `domain`, `capability`, `reference evidence`, `destination evidence`, `status`, `data/API dependency`, `acceptance test`, `follow-up plan`. Evidence must use repository-relative paths and symbol names; include line numbers when readily available. For `out-of-scope`, state the reason and link to the spec criterion.

- [ ] **Step 5: Validate matrix completeness**

Check that every spec domain appears, every in-scope capability has destination evidence or an explicit `missing` status, and every row has an acceptance test or a reason it cannot apply. Confirm all five Review Focus cases have an owning plan assignment.

- [ ] **Step 6: Run documentation checks**

Run:

```powershell
git diff --check
```

Expected: no formatting errors; no application files or PDV-Cafe files changed.

### Task 3: Decompose domain plans and non-overlapping work packets

**Files:**
- Read: `docs/superpowers/specs/2026-10-22-paridade-pdv-cafe-restaurante-design.md`
- Read: `docs/superpowers/parity-baseline.md`
- Read: `docs/superpowers/parity-matrix.md`
- Create: a short section in `docs/superpowers/parity-matrix.md` listing follow-up plan names, dependencies, and exclusive file ownership after inspection.

**Interfaces:**
- Consumes: complete capability matrix.
- Produces: ordered, independently reviewable implementation domains and file ownership boundaries. No coding task starts from this plan.

- [ ] **Step 1: Order domains by concrete dependency**

Use evidence from the matrix to order data/contracts, authentication/authorization, preparation and operational integrity, delivery, PWA/offline, printing, reports/pagination, frontend integration, CI/documentation, and final end-to-end validation. Record true dependencies only; do not serialize independent domains without a reason.

- [ ] **Step 2: Define non-overlapping work packets**

For each proposed packet, list exact files and interfaces from the matrix. Do not assign the same mutable file to separate parallel workers. Assign shared integration, API contract changes, and final verification to one coordinator.

Use these proposed plan boundaries, adjusting only when matrix evidence shows a real dependency:

1. `2026-10-22-pdv-cafe-parity-data-preparacao-plan.md`
2. `2026-10-22-pdv-cafe-parity-auth-auditoria-plan.md`
3. `2026-10-22-pdv-cafe-parity-vendas-estoque-financeiro-plan.md`
4. `2026-10-22-pdv-cafe-parity-delivery-plan.md`
5. `2026-10-22-pdv-cafe-parity-pwa-offline-plan.md`
6. `2026-10-22-pdv-cafe-parity-impressao-plan.md`
7. `2026-10-22-pdv-cafe-parity-dashboard-paginacao-plan.md`
8. `2026-10-22-pdv-cafe-parity-integracao-qualidade-plan.md`

- [ ] **Step 3: Record agent-tool availability without assuming external control**

Record whether a supported integration can actually create and observe Codex or Kilo Code tasks. If none is available, mark those tools unavailable and leave the work packets ready for the user's preferred agent or supported built-in delegation. Never claim an external agent accepted or completed work without a returned result.

- [ ] **Step 4: Review dependencies and handoff**

Verify every spec domain maps to exactly one primary plan, cross-domain dependencies are explicit, the Café remains read-only, and the next step is user review of the decomposition before domain implementation plans are executed.

- [ ] **Step 5: Commit the baseline and matrix artifacts**

After the user reviews and accepts the decomposition, commit only the two generated documents:

```powershell
git add -- docs/superpowers/parity-baseline.md docs/superpowers/parity-matrix.md
git commit -m "docs: map PDV Cafe parity gaps" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit contains only the baseline and matrix; no application files or PDV-Cafe files are included.

## Completion criteria for this plan

- Both repository baselines and attempted checks are recorded with evidence.
- The matrix covers every in-scope application capability at the approved reference commit.
- The five Review Focus scenarios are explicitly assigned to the plans that will own their tests.
- Each independent domain has a proposed follow-up plan, known dependencies, and non-overlapping file ownership.
- No product code or dependency manifest is changed, and PDV-Cafe remains untouched.
- The decomposition is reviewed before any implementation begins.
