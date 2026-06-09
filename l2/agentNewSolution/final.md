# Plano de manutencao - agentNewSolution

Data: 2026-06-06

Arquivos analisados:
- `/Volumes/WagnerSSD1/collab/mls-base/mls-102020/l2/agents/newSolution/run30/task.json`
- `/Volumes/WagnerSSD1/collab/mls-base/skills/archProduction.md`

Escopo deste plano:
- Encerrar corretamente a task de planejamento.
- Reduzir input enviado para LLM e remover gordura da task.
- Salvar artefatos do planejamento em arquivos `.defs.ts` incrementalmente, assim que cada output validado estiver disponivel, seguindo apenas o passo `plan` da arquitetura de producao.
- Limpar outputs grandes da task depois que o respectivo artefato tiver sido salvo e referenciado por arquivo/checksum.
- Rever steps dinamicos para execucao paralela controlada, especialmente paginas e workflows.
- Deixar `materialize` para uma proxima task.

## Diagnostico run30

Task:
- `PK`: `20260606103255.1001`
- `title`: `newModule`
- `status`: `in progress`
- total de steps: 47
- statuses: 45 `completed`, 1 `waiting_after_prompt`, 1 `waiting_dependency`
- fila backend: 0
- fila frontend: 1 hook de pooling orfao para step 23 (`agentPlanPageIndex`), mesmo com step 23 `completed`

Steps abertos:
- step 1: `agentNewSolution`, status `waiting_after_prompt`
- step 26: `org-materialization`, status `waiting_dependency`

Resumo do planejamento:
- modulo: `petShopBrasilSite`
- atores no plano final: `customer`, `administrator`
- regras: 12
- paginas aprovadas: 10
- workflows aprovados: 5
- plugin aprovado: 1 (`stripe`, `create_draft`)
- horizontais planejados: `finance`, `notifications`
- dominios MDM: `customer`, `product`, `service`, `order`, `transaction`, `appointment`
- tabela transacional module-owned: `cart`
- tabelas de metricas: `averageTicketMetrics`, `conversionRateMetrics`, `revenueByCategoryMetrics`, `paymentSuccessRateMetrics`
- paginas definidas: `home`, `catalog`, `productDetail`, `cart`, `checkout`, `myAccount`, `adminProducts`, `adminServices`, `adminOrders`, `financialDashboard`

Tokens do trace:
- total aproximado: 629733 input tokens, 83394 output tokens, 713127 total tokens, custo `$2.6767`
- maior custo por agente:
  - `agentPlanPageDefinition`: 10 chamadas, 319346 tokens totais
  - `agentPlanWorkflowDefinition`: 5 chamadas, 90780 tokens totais
  - `agentPlanMetricTableDefinition`: 4 chamadas, 50657 tokens totais
  - `agentValidateSolutionCoverage`: 1 chamada, 46781 tokens totais
  - `agentPlanPageIndex`: 1 chamada, 29272 tokens totais

Observacao de limpeza:
- `tools` e `toolChoice` parecem limpos nesta task.
- inputs relevantes ainda ficaram em:
  - step 3 (`agentNewSolutionRequirements`): input com aproximadamente 9994 bytes
  - step 1 (`agentNewSolution`): input com aproximadamente 2920 bytes
- varios steps mantem `payload` grande, especialmente `agentFinalizeSolutionPlan` e `agentPlanPageIndex`.

Observacao critica:
- O fluxo chegou ate `agentValidateSolutionCoverage`, mas a validacao final retornou `summary.passed=false`, `errorCount=3` e `readyToSaveDefs=false`.
- Mesmo assim, o step ficou `completed`. Portanto, o fluxo chegou ao final operacional, mas ainda nao esta pronto para flush automatico de `.defs.ts`.
- Novo requisito: os `.defs.ts` de planejamento nao precisam esperar o fim do fluxo inteiro. Eles podem ser gravados como drafts de plan assim que cada agente validar seu output. A validacao final continua funcionando como gate de prontidao geral, mas nao deve impedir persistencia incremental de artefatos intermediarios.
- Novo requisito: grupos independentes como page definitions e workflow definitions devem ser avaliados para execucao em paralelo controlado, em vez de encadeamento serial item a item.

Erros da validacao final:
- `metrics.hypertable.missing`: tabelas de metricas `metricTimeseries` sem configuracao de hypertable TimescaleDB.
- `page.flowRefs.categoryMismatch`: `serviceSchedulingWorkflow` foi referenciado em `entityLifecycles`, mas o workflow e `taskWorkflow`.
- `pageInputs.missingRequiredIdentifier`: `adminOrders` deveria exigir `orderId` obrigatorio para atualizacao de pedido.

## TODOs

### TODO-FINAL-001 - Encerrar a task de planejamento sem materializar

Problema:
- A task fica `in progress` mesmo depois do planejamento terminar.
- O root step 1 fica `waiting_after_prompt`.
- `org-materialization` fica `waiting_dependency`.
- Existe hook frontend orfao para step 23.

Acao:
- Definir regra de encerramento para modo `plan-only`.
- Ao completar `plan-validate-solution-coverage`, remover hooks orfaos e encerrar o root `agentNewSolution`.
- Nao liberar `org-materialization` automaticamente quando a intencao for apenas planejamento.
- Registrar no `last_update_log` que o planejamento terminou e que materializacao esta pendente para uma nova task.

Criterio de aceite:
- Depois do ultimo step de planejamento, a task nao permanece `in progress`.
- Nao sobra `queueFrontEnd` para steps ja completos.
- `org-materialization` nao executa no fluxo `plan-only`.

**EXECUTED** (2026-06-06):
- Evidencia: diagnostico no proprio final.md (run30) mostrava root em waiting_after_prompt e orphan hook apos validate completed.
- Mudanca: em agentValidateSolutionCoverage.afterPromptStep, quando status=completed, envia update-status para completar o root 'agentNewSolution' step.
- Registro no traceMsg da intencao plan-only e materializacao pendente.
- Nao afeta materializacao (permanece manual_later no planned tree).
- Sem efeitos colaterais em fluxos normais (materializacao manual).
- Atualizacao neste arquivo.

### TODO-FINAL-002 - Bloquear conclusao quando coverage nao esta pronto

Problema:
- `agentValidateSolutionCoverage` retornou `summary.passed=false` e `readyToSaveDefs=false`, mas o step foi marcado como `completed`.

Acao:
- Alterar `agentValidateSolutionCoverage` para status de erro ou `needs_input` quando `readyToSaveDefs=false`.
- Nao permitir flush de `.defs.ts` quando existir issue `severity=error`.
- Decidir se a task deve ficar `waiting_after_prompt_with_error`, `failed`, ou `waiting_human_input` para revisao.

Criterio de aceite:
- Validacao com erro nao avanca como sucesso silencioso.
- O usuario ve os erros de coverage como motivo real de bloqueio.

**EXECUTED** (2026-06-06):
- Decisao: quando a validacao gera relatorio com `status="ok"`, mas `readyToSaveDefs=false`, `summary.passed=false`, `summary.errorCount>0` ou issues `severity="error"`, o step e marcado como `failed`.
- O payload continua parseavel e preserva `summary`, `issues` e `readyToSaveDefs` para UI, debug e retry.
- O root `agentNewSolution` nao e fechado nesse caso, porque o fechamento plan-only ja depende de `status=completed`.
- Isso bloqueia conclusao silenciosa e impede considerar o conjunto pronto para save/materializacao.

**SUPERSEDED em parte por TODO-FINAL-023/024** (2026-06-07): com checkpoints e critica/reparo por indice pegando erros cedo, a coverage final voltou a completar o step mesmo com `readyToSaveDefs=false`; os erros agora sao gravados como relatorio tecnico nao-bloqueante (`planHealthReport`) no trace/manifesto. `status="failed"` da propria LLM e erros de extracao continuam falhando o step.

### TODO-FINAL-003 - Corrigir definicao de hypertable nas metric tables

Problema:
- As quatro tabelas de metricas foram planejadas como `metricTimeseries`, mas sem configuracao de hypertable.

Acao:
- Atualizar `agentPlanMetricTableDefinition` para exigir campos de hypertable no schema.
- Incluir no prompt que `metricTimeseries` exige `timeColumn`, politica de chunk, retencao e indices minimos.
- Atualizar validator para falhar cedo quando a hypertable estiver ausente.

Criterio de aceite:
- `averageTicketMetrics`, `conversionRateMetrics`, `revenueByCategoryMetrics` e `paymentSuccessRateMetrics` saem com configuracao TimescaleDB completa.

**EXECUTED** (2026-06-06):
- `agentPlanMetricTableDefinition` agora exige `metricTableDefinition.hypertable` no schema da tool.
- O schema exige `timeColumn`, `chunkTimeInterval`, `retentionPolicy` e `indexes`.
- O validator falha cedo quando `hypertable.timeColumn` nao bate com `metricTableDefinition.timeColumn`, quando chunk/retencao estao vazios, ou quando nao existe indice contendo a coluna de tempo.
- O prompt instrui explicitamente a gerar hypertable TimescaleDB completa para cada `metricTimeseries`.

### TODO-FINAL-004 - Corrigir categoria de flowRefs das paginas

Problema:
- `productDetail.flowRefs.entityLifecycles` incluiu `serviceSchedulingWorkflow`, mas esse workflow tem `executionMode=taskWorkflow`.

Acao:
- No `agentPlanPageIndex` e `agentPlanPageDefinition`, validar `flowRefs` contra `agentPlanWorkflowIndex`.
- Gerar bucket correto:
  - `entityLifecycle` -> `entityLifecycles`
  - `taskWorkflow` -> `taskWorkflows`
  - `automation` -> `automations`
  - `uiState` ou `documentationOnly` -> `experienceFlows` ou nenhum, conforme contrato final.

Criterio de aceite:
- Nenhuma pagina referencia workflow em bucket incompatível com `executionMode`.

**EXECUTED** (2026-06-06):
- `agentPlanPageIndex` valida `flowRefs` contra `agentPlanWorkflowIndex`.
- `agentPlanPageDefinition` reutiliza a mesma validacao antes de aceitar uma pagina individual.
- A regra aplicada e: `entityLifecycle -> entityLifecycles`, `taskWorkflow -> taskWorkflows`, `automation -> automations`, `uiState/documentationOnly -> experienceFlows`.
- O validator tambem falha quando o workflow nao existe ou quando o mesmo workflow aparece em mais de um bucket.

### TODO-FINAL-005 - Exigir inputs obrigatorios em paginas de acao especifica

Problema:
- `adminOrders` permite atualizar status de pedido, mas `orderId` saiu como nao obrigatorio.

Acao:
- No `agentPlanPageDefinition`, validar que comandos de detalhe, atualizacao, cancelamento, refund, status ou lifecycle exigem identificador externo obrigatorio.
- Para `adminOrders`, `orderId` deve ser `required=true`.

Criterio de aceite:
- Paginas com mutacao ou detalhe de entidade especifica sempre declaram o identificador requerido.

**EXECUTED** (2026-06-06):
- `agentPlanPageDefinition` agora valida paginas com comandos de detalhe, update, edit, status, cancelamento, refund, lifecycle e acoes equivalentes.
- Quando o comando declara um input identificador, como `{entity}Id`, deve existir `pageInputs` correspondente com `required=true`.
- Quando o comando especifico nao expõe o nome do identificador no input, a pagina ainda precisa declarar ao menos um identificador requerido para o sujeito principal ou registro de compromisso.
- O prompt foi atualizado para deixar essa regra explicita para a LLM.

### TODO-FINAL-006 - Reduzir input do `agentPlanPageDefinition`

Problema:
- `agentPlanPageDefinition` consumiu aproximadamente 319346 tokens em 10 chamadas.
- Cada pagina recebeu contexto amplo demais.

Acao:
- Criar um contexto reduzido por pagina:
  - pagina selecionada do page index
  - atores do final plan
  - capabilities usadas pela pagina
  - workflows referenciados pela pagina
  - usecases referenciados pela pagina
  - tabelas e metricas referenciadas pela pagina
  - regras citadas pela pagina
  - plugin/mdm refs citados pela pagina
- Nao enviar o final plan completo nem todas as page definitions anteriores.

Criterio de aceite:
- Cada chamada de page definition deve ficar bem abaixo de 30000 input tokens.
- A pagina continua conseguindo produzir BFF commands e sections coerentes.

**EXECUTED** (2026-06-07):
- `buildHumanPrompt` do page definition agora monta um contexto reduzido por pagina (helper inline) em vez de despejar tudo:
  - `pageIndexItem` (spec da pagina), `module`, `actor` (so o ator da pagina), `capabilities`/`rules` filtrados por `pageIndexItem`.
  - `workflows` (index + definitions) filtrados por `flowRefs`; `usecases` por `usecaseHints`; `tables` por `persistenceHints`; `metrics` (index tables + defs + dashboards) por `metricRefs`; `plugins` por `pluginRefs`; `mdm` por `mdmRefs`.
  - `ontologyEntities`: subconjunto referenciado pelas tabelas/usecases selecionados (+ mdmRefs).
  - `backendArchitecture`/`controllerRules`/`usecaseEntities` (pequenos) mantidos para coerencia de BFF.
  - `navigablePages`: lista slim (`pageId,pageName,actor,purpose`) so para `navigationRefs`, em vez do page index completo.
- NAO envia mais final plan completo, todas as table/metric/workflow definitions, nem o page index inteiro.
- Helpers `pickRecordsByIds`/`summarizeRecords`/`collectStringRefs` adicionados ao `agentPlanningShared`.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-007 - Reduzir input do `agentPlanWorkflowDefinition`

Problema:
- `agentPlanWorkflowDefinition` consumiu aproximadamente 90780 tokens em 5 chamadas.

Acao:
- Enviar apenas o workflow selecionado, suas entidades, usecases, regras, metric refs e tabelas relevantes.
- Nao enviar todos os workflows e todas as definicoes de metric tables quando o workflow selecionado nao usa tudo.

Criterio de aceite:
- Cada workflow definition recebe contexto especifico ao workflow selector.

**EXECUTED** (2026-06-07):
- `buildHumanPrompt` do workflow definition agora envia contexto reduzido por workflow:
  - `workflowIndexItem` (spec), `module`, `actors`/`capabilities`/`rules` filtrados pelos refs do item.
  - `tables` por `persistenceRefs`, `usecases` por `usecaseRefs`, `metricTableDefinitions` por `metricRefs`.
  - `ontologyEntities` subconjunto referenciado por `relatedEntities` + tabelas/usecases selecionados.
  - `backendArchitecture`/`controllerRules`/`usecaseEntities` mantidos (pequenos).
- NAO envia mais o workflow index inteiro, final plan completo, usecase plan completo, nem todas as table/metric definitions.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-008 - Reduzir input do `agentValidateSolutionCoverage`

Problema:
- `agentValidateSolutionCoverage` consumiu 46781 tokens em uma chamada.

Acao:
- Criar um `coverageSnapshot` compacto antes da chamada:
  - ids e counts de artefatos
  - matriz page/workflow/usecase/table/metric
  - issues deterministicas precomputadas no cliente
- Enviar payload resumido, nao todos os outputs completos.

Criterio de aceite:
- A validacao continua encontrando erros estruturais sem depender de contexto completo bruto.

**EXECUTED** (2026-06-07):
- `buildCoverageSnapshot` monta um snapshot compacto: `counts`, `ids` por tipo de artefato, e arrays resumidos (pages com actor/flowRefs/bffCommands resumidos; workflows com executionMode/refs/workflowScope; usecases/tables/metricTables/dashboards/plugins/mdm/agents summarizados).
- `deterministicIssues` precomputadas no cliente: page.actor desconhecido, page<->index mismatch, workflow persistence/usecase/metric refs danglings, dashboard actor desconhecido — passados prontos para a LLM confirmar/estender.
- O prompt envia apenas snapshot + issues + guidance, nao mais todos os artefatos completos.
- Coerente com TODO-FINAL-023/024: a coverage e relatorio tecnico nao-bloqueante; os checks pesados ja rodaram nos checkpoints por indice.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-009 - Reduzir input do `agentPlanPageIndex`

Problema:
- `agentPlanPageIndex` consumiu 29272 tokens.

Acao:
- Enviar um snapshot de planejamento de paginas com:
  - atores
  - capabilities now
  - userActions
  - workflows resumidos
  - metrics dashboard refs
  - agentes e plugins apenas por id e motivo
- Remover detalhes completos de tabelas, usecases e page definitions inexistentes nessa fase.

Criterio de aceite:
- O page index continua gerando todas as paginas necessarias, mas sem contexto detalhado de materializacao.

**EXECUTED** (2026-06-07):
- `buildHumanPrompt` do page index agora envia um snapshot de planejamento (summaries):
  - `module`, `actors`, `capabilities`, `userActions`, `rules` resumidos.
  - `workflows` resumidos COM `executionMode` (necessario para o bucket de `flowRefs`), `createsTask`, `actors`, `relatedCapabilities`.
  - `metrics` (enabled + metricTables/dashboards resumidos), `persistenceTables` (id/title/rootEntity), `usecases` (id/title/actor), `plugins` (id/provider/reason), `mdmDomains`, `horizontalModules`, `agents` por id+motivo.
- Removidos os dumps completos de table/metric/workflow definitions (detalhe nao necessario para planejar paginas).
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-010 - Limpar input/payload remanescente da task

Problema:
- Step 3 e step 1 ainda mantem `interaction.input`.
- Payloads grandes permanecem em varios steps.
- Com gravacao incremental de `.defs.ts`, a task pode deixar de carregar outputs completos que ja foram salvos com sucesso.

Acao:
- Revisar cleaners apos `afterPromptStep` para:
  - limpar `input`, `tools` e `toolChoice` sempre que o payload validado virar plano aceito ou arquivo salvo
  - limpar outputs intermediarios substituidos por plano revisado/final
  - apos salvar `.defs.ts`, substituir payload grande por referencia ao arquivo, checksum, agentName, stepId, planId e status de validacao
- Definir quais outputs ainda precisam ficar inline ate serem salvos e quais podem virar referencias.
- Manter payload completo apenas enquanto for necessario para retry/debug ou enquanto o arquivo correspondente ainda nao existir.

Criterio de aceite:
- A task final fica menor sem perder informacao necessaria para retry, debug, validacao e materializacao futura.
- Steps com `.defs.ts` salvo deixam de manter payload completo, exceto quando estiverem em erro.

**EXECUTED SAFE-PART** (2026-06-06):
- Confirmado no `collab-messages` que qualquer `cleaner` ja limpa `interaction.tools` e `interaction.toolChoice`; portanto os agents que usam `cleaner="input"` ja removem input/tools/toolChoice no sucesso.
- Foi implementado manifesto incremental com referencia de arquivo, checksum, agentName, stepId, planId, schemaVersion e status de draft.
- Nao foi aplicado `cleaner="input_output"` nos outputs salvos, porque `getPlannerOutput(s)` ainda le os payloads da task e os agentes posteriores dependem deles.
- A troca de payload completo por referencia deve acontecer somente depois de existir fallback de leitura pelos arquivos/manifesto; isso evita quebrar retry, coverage e agentes downstream.
- Em erro ou `needs_input`, o payload permanece preservado para debug.

### TODO-FINAL-011 - Implementar gravacao incremental plan-only para `.defs.ts`

Problema:
- O planejamento esta na task, mas ainda nao existe rotina de gravacao incremental dos artefatos `plan` para arquivos.
- Esperar o fluxo inteiro terminar para gravar tudo aumenta a task, dificulta retry e atrasa feedback visual.

Acao:
- Criar uma rotina de save plan-only chamada no `afterPromptStep` de cada agente que ja produz um artefato persistivel.
- Gravar como draft/plan assim que o output do step passar schema e validacao local daquele agente.
- A task passa a guardar referencia do arquivo salvo, checksum/hash, versao do schema, stepId, planId, agentName e status.
- A gravacao deve ser idempotente: mesmo input gera mesmo conteudo e sobrescreve o mesmo arquivo.
- A validacao final (`agentValidateSolutionCoverage`) continua sendo o gate para considerar o conjunto pronto, mas nao e requisito para salvar drafts intermediarios.
- Quando a validacao final falhar, os arquivos salvos devem permanecer marcados como `draft` ou `not-ready`, sem disparar materializacao.

Criterio de aceite:
- Ao longo da task, os `.defs.ts` do passo `plan` aparecem progressivamente no workspace.
- A task consegue ser retomada sem repetir LLM para artefatos ja salvos e validados.
- Nenhum arquivo `mat1` ou `mat2` e criado.

**EXECUTED** (2026-06-06):
- Criado `saveNewSolutionPlanArtifacts` em `agentNewSolutionArtifacts.ts`.
- O writer grava drafts plan-only apos schema/validacao local e somente quando o output esta `status="ok"`.
- Agents conectados ao save incremental:
  - `agentFinalizeSolutionPlan`
  - `agentPlanTableDefinition`
  - `agentPlanMetricTableDefinition`
  - `agentPlanUsecaseEntities`
  - `agentPlanWorkflowDefinition`
  - `agentPlanPageDefinition`
  - `agentPlanPlugins`
- Os arquivos gravados sao `.defs.ts` para plans e `.json` apenas para `l5/project.json`.
- A validacao final continua sendo o gate de readiness; drafts intermediarios ficam com status `draft`.

### TODO-FINAL-012 - Mapear caminhos de producao dos arquivos `plan`

Base: `/Volumes/WagnerSSD1/collab/mls-base/skills/archProduction.md`

Acao:
- Definir o mapeamento final para `petShopBrasilSite`:
  - `l5/project.json` -> plan de registro do projeto/modulos
  - `l5/petShopBrasilSite/module.defs.ts` -> definicao geral do modulo
  - `l5/petShopBrasilSite/rules.defs.ts` -> regras centralizadas
  - `l1/petShopBrasilSite/layer_1_external/cart.defs.ts` -> tabela transacional
  - `l1/petShopBrasilSite/layer_1_external/{metricTableId}.defs.ts` -> tabelas TimescaleDB de metricas, se esse for o destino aprovado
  - `l1/petShopBrasilSite/layer_3_usecases/{usecaseId}.defs.ts` -> usecases planejados
  - `l2/petShopBrasilSite/{pageId}.defs.ts` -> pagina e contrato BFF do passo plan
  - `l2/petShopBrasilSite/plugins/stripe.defs.ts` -> conexao do modulo com plugin Stripe
  - `l2/plugins/stripe/plugin.defs.ts` -> plugin draft quando `resolution=create_draft`
  - `l4/workflows/{workflowId}.defs.ts` -> workflows globais
- Definir tambem um arquivo de manifesto/checkpoint do planejamento, por exemplo `l2/{moduleName}/trace/plan-artifacts.json`, contendo lista de arquivos gerados, checksums, stepIds e status.

Criterio de aceite:
- Cada output de agente tem caminho de destino unico e previsivel.
- O fluxo consegue saber se um artefato ja foi salvo e se precisa ser regravado.

**EXECUTED** (2026-06-06):
- Mapeamento implementado no writer local:
  - `project` -> `l5/project.json`
  - `module` -> `l5/{moduleName}/module.defs.ts`
  - `rules` -> `l5/{moduleName}/rules.defs.ts`
  - `table` -> `l1/{moduleName}/layer_1_external/{tableId}.defs.ts`
  - `metricTable` -> `l1/{moduleName}/layer_1_external/{metricTableId}.defs.ts`
  - `usecase` -> `l1/{moduleName}/layer_3_usecases/{usecaseId}.defs.ts`
  - `page` -> `l2/{moduleName}/{pageId}.defs.ts`
  - `pluginConnection` -> `l2/{moduleName}/plugins/{pluginId}.defs.ts`
  - `pluginDraft` -> `l2/plugins/{pluginId}/plugin.defs.ts`
  - `workflow` -> `l4/workflows/{workflowId}.defs.ts`
- Manifesto/checkpoint gravado em `l2/{moduleName}/trace/plan-artifacts.json`.

### TODO-FINAL-013 - Adicionar `defsPlan` nas page definitions

Problema:
- `agentPlanPageDefinition` nao retorna `defsPlan.fileName`.
- Isso dificulta flush uniforme com tabelas, metric tables e workflows.

Acao:
- Estender schema de `agentPlanPageDefinition` para incluir `defsPlan`.
- Caminho sugerido: `{pageId}.defs.ts` sob `l2/{moduleName}/`.

Criterio de aceite:
- Todas as paginas retornam `defsPlan.saveAsDefs=true`, `fileName` e `exportName`.

**OBSOLETO / SUPERSEDED por TODO-FINAL-014** (verificado 2026-06-07):
- O objetivo (pagina vira `.defs.ts` com export e caminho estaveis, uniforme com tabelas/metricas/workflows) ja esta atendido, mas pela rota decidida no TODO-FINAL-014: o writer (`agentNewSolutionArtifacts.buildPlanArtifactCandidates` + `resolvePlanArtifactFileInfo`) resolve tudo a partir de `artifactType="page"`, `moduleName` e `pageId`:
  - caminho fisico: `l2/{moduleName}/{pageId}.defs.ts`;
  - export estavel: `{pageId}PagePlan` (via `toExportIdentifier`).
- Portanto `agentPlanPageDefinition` NAO retorna `defsPlan` e nao precisa: o artefato `.defs.ts` que aparece no workspace (`export const <pageId>PagePlan = {...} as const`) e produzido pelo writer, nao por um campo da LLM.
- Decisao: NAO estender o schema da pagina com `defsPlan`. Adicionar isso reintroduziria caminho/export decididos pela LLM, contrariando a decisao do TODO-FINAL-014 ("o writer ignora `defsPlan.fileName`; o caminho final e resolvido por `artifactType`/`moduleName`/`artifactId`"). O criterio de aceite original fica considerado coberto pelo writer.
- Observacao: tabelas/metricas/workflows ainda RETORNAM `defsPlan` (a LLM gera), mas o writer tambem o ignora para definir o caminho fisico (so usa `exportName` quando presente). A pagina simplesmente nao gera esse campo — comportamento consistente com o writer.

### TODO-FINAL-014 - Normalizar caminhos `defsPlan` atuais

Problema:
- Alguns agents retornam `defsPlan.fileName` relativo como `tables/cart.defs.ts` ou `workflows/checkoutWorkflow.defs.ts`.
- A arquitetura de producao separa `l1`, `l2`, `l4` e `l5`.

Acao:
- Decidir se o `defsPlan.fileName` deve ser:
  - relativo ao modulo
  - relativo ao projeto
  - ou apenas um identificador logico resolvido pelo flush
- Preferir que o flush resolva caminhos finais para evitar LLM inventar paths.
- Com gravacao incremental, preferir que o writer local resolva o caminho final a partir de `artifactType`, `moduleName`, `planId` e id do artefato, mesmo quando a LLM retornar apenas identificador logico.

Criterio de aceite:
- LLM nao precisa conhecer caminho absoluto de producao.
- Writer incremental aplica o mapa de `archProduction.md`.

**EXECUTED** (2026-06-06):
- O writer ignora `defsPlan.fileName` para definir caminho fisico final.
- `defsPlan.exportName` ainda pode ser usado como nome de export quando existir.
- O caminho final e resolvido por `artifactType`, `moduleName`, `artifactId` e mapa local baseado em `archProduction.md`.
- Isso reduz a dependencia da LLM conhecer `l1/l2/l4/l5` e evita paths relativos inconsistentes como `tables/...` ou `workflows/...`.

**FIX (run 2026-06-08) - tripleslash ausente em .defs.ts de l1/l4/l5**:
- Sintoma: alguns `.defs.ts` gerados (ex.: l1 `layer_3_usecases/usecaseAddToCart.defs.ts`) saiam SEM o header `/// <mls fileReference=... enhancement="_blank"/>`.
- Causa: `createStorFile` (libStor) so injeta o tripleslash quando `req.level === 2`, e `verifyNeedAddTripleslach` (libCommom) ainda hardcoda `l2` no path. Os artefatos do writer em l1/l4/l5 nunca recebiam o header.
- Correcao (contida no writer, sem alterar o stor global): `buildPlanDefsSource` agora recebe o `fileInfo` e prefixa `buildDefsTripleSlash(fileInfo)` -> `/// <mls fileReference="_{project}_/l{level}/{folder}/{shortName}{ext}" enhancement="_blank"/>` com nivel/pasta reais. Para level 2, `verifyNeedAddTripleslach` ve o header ja presente (`startsWith('/// <mls ')`) e nao duplica.
- Vale para novos arquivos e re-saves (saveStorContent grava o `source` com header diretamente). Arquivos ja gerados em runs antigos nao sao retroativamente corrigidos; basta regerar.
- Build: `tsc -p tsconfig.frontend.json` ok (sem erros novos).

### TODO-FINAL-015 - Planejar arquivos de horizontais e MDM

Problema:
- `agentPlanHorizontals` e `agentPlanMDM` geram plano conceitual, mas o destino `.defs.ts` ainda nao esta fechado.

Acao:
- Definir se horizontais (`finance`, `notifications`) geram arquivos em `l2/{horizontal}/...` nesta task ou apenas referencias para modulos existentes.
- Definir se dominios MDM geram `.defs.ts` nesta task ou ficam como referencias/governance no `module.defs.ts`.

Criterio de aceite:
- Flush nao ignora horizontais/MDM nem inventa estrutura fora da arquitetura.


Resposta: deve ser consultado os módulos existentes, ex "financeiro", e nos artefatos .defs.ts referenciar o módulo , ou se, não existir , criar um <moduleid>module.defs.ts com os detalhes que o módulo deve ter. Para cada módulo horizontal, será criado posteriormente uma task para criação deles. Provavelmente após a criação , o módulo origem , ex 'petshop' deverá ser atualizado. 

**EXECUTED** (2026-06-07):
- Decisao confirmada com o usuario: horizontais E dominios MDM seguem a mesma regra "referenciar se existe, criar draft se nao existe".
- Writer (`agentNewSolutionArtifacts`):
  - `buildPlanArtifactCandidates` passou a tratar `agentPlanHorizontals` (artifactType `horizontalModule`) e `agentPlanMDM` (artifactType `mdmDomain`). Para cada item, verifica `getExistingModuleFolders()`: se a pasta `{id}` ja existe -> `referenceOnly=true`; senao -> cria draft.
  - `resolvePlanArtifactFileInfo`: `horizontalModule`/`mdmDomain` -> `l5/{id}/module.defs.ts` (shortName `module`), caminho canonico de registro de modulo.
  - Novo `referenceOnly` em `PlanArtifactCandidate` + status `reference` em `PlanArtifactReference`: quando `referenceOnly`, o writer NAO grava/sobrescreve o arquivo, apenas registra a entrada no manifesto com status `reference` apontando para `l5/{id}/module.defs.ts`.
  - Conteudo do draft (`data`): `kind` (`horizontal`/`mdm`), `moduleId`, `plannedByModule` (modulo origem, ex petShop), `referencesExisting`, e o item de plano (`module`/`domain`).
- `agentPlanHorizontals` e `agentPlanMDM` agora chamam `saveNewSolutionPlanArtifacts` no `afterPromptStep` (status completed).
- Separacao de manifesto: o manifesto e gravado sob o modulo origem (`getInitialModuleName`, ex petShop) e as entradas apontam para os modulos horizontais/MDM. Assim o modulo origem registra o que referencia/cria, coerente com "o modulo origem devera ser atualizado".
- Escopo: a criacao efetiva de cada modulo horizontal/MDM continua sendo uma task futura propria (drafts aqui sao o ponto de partida). Flush nao inventa estrutura fora de `l5/{id}/module.defs.ts` e nunca sobrescreve modulo existente.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

**EXTENSAO (run 2026-06-08) - referencia MDM no l1 para usecase/mock**:
- Problema: o plano de MDM (dominios, masterEntities, sourceOfTruth, governanceRules) nao descia para o l1. O persistence index exclui entidades MDM (nao gera tabela), entao a materializacao de usecase e a geracao de mock no l1 nao tinham a referencia das entidades MDM.
- Solucao: para cada `masterEntity` de cada dominio MDM, o save agora emite tambem um artefato em `l1/{module}/layer_1_external/{Entity}.defs.ts` com `artifactType="mdmEntity"`, flag `generateTable: false` e `ownership: "mdmOwned"`, enriquecido com o shape da ontologia (`fields` de `fieldId/type/required/description`, `title`, `description`) + metadata do dominio (`domainId`, `sourceOfTruth`, `governanceRules`). Granularidade: um arquivo por masterEntity (confirmado com o usuario).
- Implementacao: `saveNewSolutionPlanArtifacts` ganhou `options.ontologyEntities`; `agentPlanMDM.afterPromptStep` passa `finalPlan.result.ontology.entities`. `buildPlanArtifactCandidates` (branch MDM) gera os candidatos `mdmEntity` alem do draft de modulo l5 (TODO-015). `resolvePlanArtifactFileInfo` mapeia `mdmEntity` -> `l1/{module}/layer_1_external/{Entity}.defs.ts`.
- O `generateTable:false` sinaliza que NAO e tabela fisica (MDM e acessado em runtime via project 102034 / ctx.data.mdmDocument), mas o shape fica disponivel localmente para mock e materializacao de usecase.
- Build: `tsc -p tsconfig.frontend.json` ok.

**FIX (run 2026-06-08)**: `agentPlanHorizontals` falhava a task inteira com "horizontalModule was accepted, but horizontalModules output is empty" quando uma decisao aceitava um horizontal fora do catalogo (finance/notifications/documents) — o modelo nao tinha como plana-lo, falha garantida. Esse gate virou advisory (`console.warn`, nao-fatal), coerente com a direcao nao-bloqueante (TODO-FINAL-023/024) e com o fato de horizontais serem criados em task propria depois. Checagens estruturais duras (id fora do catalogo; needs_input sem questions) e o gate obrigatorio de MDM (mdmDomains nao-vazio) permanecem. Observacao do trace: `x-tool-strict: not used` para horizontals nesse run (provider azureai/gpt-5.2-codex) — informativo, nao e a causa; a validacao ajv contra o schema continua ativa.

### TODO-FINAL-016 - Separar claramente `plan`, `mat1` e `mat2`

Problema:
- Alguns outputs ja contem detalhes proximos de materializacao, especialmente page sections e BFF command shapes.

Acao:
- Documentar fronteira:
  - `plan`: contratos, regras, entidades, paginas, workflows, plugins, usecases
  - `mat1`: layout especifico, device, componentes, mocks, controllers finais
  - `mat2`: arquivos `.ts`, `.html`, `.less`, configs runtime
- Garantir que o flush atual escreva apenas artefatos `plan`.

Criterio de aceite:
- Nenhum arquivo `mat1` ou `mat2` e criado nesta etapa.

Resposta: já estamos seguinto esta recomentação.

**EXECUTED / DONE** (verificado 2026-06-07):
- Fronteira confirmada no codigo: `resolvePlanArtifactFileInfo` so resolve artefatos `plan` (`project`, `module`, `rules`, `table`, `metricTable`, `usecase`, `page`, `pluginConnection`, `pluginDraft`, `workflow`, e agora `horizontalModule`/`mdmDomain` + `indexCheckpoint`/`planHealthReport`/trace). Nenhum caminho `mat1`/`mat2` e gerado pelo writer.
- `org-materialization` permanece `manual_later` (TODO-FINAL-001) e nao e disparado no fluxo plan-only.
- Page sections e BFF command shapes ficam no nivel de contrato (plan), nao geram `.ts`/`.html`/`.less`.
- Nenhuma mudanca de codigo necessaria; criterio "nenhum arquivo mat1/mat2 criado nesta etapa" ja atendido.

### TODO-FINAL-017 - Criar testes de contrato para agentes de planejamento

Problema:
- Muitos erros recorrentes foram incompatibilidades entre schema, validator e payload.

Acao:
- Criar testes com fixtures reais de run30 para:
  - extrair payload
  - validar schema
  - normalizar output
  - validar regras semanticas
  - simular campos extras, aliases e valores invalidos
- Priorizar agentes que geram muitos filhos dinamicos: page definition, workflow definition, metric table definition.

Criterio de aceite:
- Um payload como run30 pode ser validado em Node sem browser.
- Erros de schema/validator sao pegos antes da execucao no Studio.

### TODO-FINAL-018 - Criar politica de trace

Problema:
- O trace e util para debug, mas pode crescer muito.
- Com save incremental, trace e artefato plan precisam ter politicas separadas: trace pode ser temporario, `.defs.ts` e manifesto sao produto do planejamento.

Acao:
- Salvar trace bruto em `l2/{moduleName}/trace/` somente durante planejamento.
- Definir retencao:
  - manter ultimo payload por agente/step
  - compactar ou remover traces apos artefato `.defs.ts` salvo e validado
  - preservar resumo de tokens e erros

Criterio de aceite:
- Debug continua possivel sem transformar a task e o repositorio em deposito de payloads grandes.

Resposta: colocar no primeiro agente uma variável 'saveTrace' e incluir esta variável na memória da task, aquela que não vai para a LLM, assim todos os outros agentes podem consultar se precisa ou não salvar os trace, default = true, pode ser alterado no código fonte.

**EXECUTED** (2026-06-08):
- Flag `saveTrace` na memoria da task, exatamente como pedido. Usa a chave `_saveTrace` em `iaCompressed.longMemory`; o prefixo `_` garante que NAO vai para o prompt da LLM (confirmado em `collab-messages` `appendLongTermMemoryToInteraction`, que filtra chaves `_`).
- `agentNewSolution` (primeiro agente) semeia `_saveTrace` via `saveTraceMemorySeed()` no `longTermMemory` do `add-message-ai` (entra em `longMemory` na criacao da task).
- Todos os agentes consultam via `shouldSaveTrace(context)` dentro de `saveNewSolutionAgentTracePayload` (chamado por todos no afterPrompt): se `_saveTrace === 'false'`, pula a gravacao do trace (mas mantem a telemetria de tamanho do R7). Default = `SAVE_TRACE_DEFAULT = true`, alteravel no codigo-fonte.
- Retencao: cada step grava em `l2/{module}/trace/{stepId}-{agent}.json` (um por step; retry sobrescreve o mesmo arquivo => "ultimo payload por step"). A compactacao/remocao automatica apos `.defs.ts` salvo (item mais agressivo da retencao) NAO foi implementada — o controle principal e o flag (desligar quando nao precisar de debug). Critic aprovado tambem ja limpa seu payload da task (TODO-FINAL-030).
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-019 - Ajustar contrato de atores sem hard-code

Problema:
- Validadores nao devem depender de nomes como `admin`, `administrator` ou traducoes.

Acao:
- Todos os agentes devem usar apenas `finalPlan.result.actors[].actorId`.
- Validadores devem comparar contra actorIds do plano final.
- Quando um artefato aprovado declarar `actor`, esse valor deve existir em `actors[].actorId`.

Criterio de aceite:
- O fluxo funciona igual em pt-BR, en-US ou qualquer idioma, desde que os actorIds sejam consistentes.

**EXECUTED** (2026-06-08):
- Auditoria: nenhum validador usa nome de ator hard-coded; todos comparam contra `actors[].actorId` (pageIndex, e os checkpoints de metrics/workflow/page/usecase do TODO-FINAL-024). A unica mencao a "admin" e num comentario de prompt (guia), nao em validador.
- Fonte unica do contrato: novo `getActorIdSet(actors)` em `agentPlanningShared.ts`. `agentPlanPageIndex.getFinalPlanActorIds` e `agentPlanIndexReview.getActorIds` passaram a usa-lo (remove duplicacao/drift).
- Checagem advisory na FONTE: `agentFinalizeSolutionPlan` (`warnFinalizeActorConsistency`) avisa (console.warn, nao-fatal) quando `capabilities[].actor`, `userActions[].actor`, `approvedArtifacts.pages[].actor`, `metricDashboards[].actor` ou `workflows[].actors[]` referenciam um ator fora de `actors[].actorId`. Os gates duros continuam downstream (pageIndex lanca; checkpoints marcam erro), entao o contrato e enforced sem travar cedo.
- Resultado: idioma-agnostico; um ator so existe se estiver em `actors[].actorId`.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-020 - Revisar consistencia entre plano final e planos especializados

Problema:
- O plano final lista 11 `usecaseEntities`, mas o plano especializado detalhou 1 `usecaseEntity` e varios `usecases`.
- Isso pode estar correto por diferenca de granularidade, mas precisa estar explicito.

Acao:
- Definir a diferenca entre `approvedArtifacts.usecaseEntities`, `usecaseEntities` e `usecases`.
- Ajustar nomes e validators para nao confundir entidade de caso de uso com caso de uso individual.

Criterio de aceite:
- Coverage consegue validar usecases sem falso positivo nem lacuna escondida.

**EXECUTED** (2026-06-08):
- Definicao dos tres conceitos (documentada no agente de usecase, secao "## Concepts", e ja referida em `agentFinalizeSolutionPlan`):
  - `approvedArtifacts.usecaseEntities` (final plan): lista plan-level de GRUPOS de entidade aprovados (ex. "OrderEntity"); sinal grosso de aprovacao, NAO alvo 1:1.
  - `usecaseEntities` (output do usecase plan): entidades agregadas de layer_3 detalhadas (usecaseEntityId, sourceTables, allowedOperations); PODEM consolidar varios grupos aprovados — a contagem NAO precisa bater.
  - `usecases` (output do usecase plan): operacoes INDIVIDUAIS (usecaseId, actor, reads/writes, commands). Workflows/agents/BFF referenciam por `usecaseId`, nunca por `usecaseEntityId`.
- Sem paridade de contagem exigida em lugar nenhum: `validateFinalizeSolutionPlanOutput` so exige `approvedArtifacts.usecaseEntities` nao-vazio quando aceito como "now"; `validatePlanUsecaseEntitiesOutput` so exige `usecaseEntities`/`usecases` nao-vazios quando ha tabelas module-owned; a coverage compara `usecases` por `usecaseId`. Nenhum compara contagem de usecaseEntities entre plano final e plano especializado -> sem falso positivo (o caso "11 vs 1" do problema e modelagem valida).
- Prompt do agente reforca explicitamente que coverage compara por `usecaseId` e nao exige paridade.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-021 - Converter paginas e workflows para paralelo controlado

Problema:
- Page definitions e workflow definitions sao independentes por item, mas hoje a execucao efetiva fica serial/encadeada.
- Isso aumenta tempo total e piora a experiencia visual, porque a interface mostra um item surgindo apos o outro.

Acao:
- Para `plan-page-definition`, criar todos os child steps a partir da lista de pageIds gerada por `agentPlanPageIndex`.
- Para `plan-workflow-definition`, criar todos os child steps a partir da lista de workflowIds gerada por `agentPlanWorkflowIndex`.
- Usar `parallel_dynamic` com limite de slots, inicialmente 5.
- O `beforePromptStep` de cada child deve receber apenas o selector (`pageId` ou `workflowId`) e montar contexto reduzido especifico daquele item.
- Evitar que um child precise adicionar o proximo child. O parent dinamico deve controlar a fila e liberar slots.
- Manter ordem deterministica dos artefatos finais mesmo com execucao paralela.

Criterio de aceite:
- Paginas e workflows sao processados em paralelo limitado.
- A UI mostra progresso por lote de itens.
- Falha em um item nao impede visualizacao dos outros itens concluidos.
- Nao ocorre mais mutacao de parent `completed` para adicionar proximo child.

**EXECUTED** (2026-06-06):
- `agentPlanWorkflowIndex` agora cria um controlador paralelo para todos os `workflowIds` retornados pelo indice.
- `agentPlanPageIndex` agora cria um controlador paralelo para todos os `pageIds` retornados pelo indice.
- O limite inicial foi configurado como `maxParallel=5`.
- `agentPlanWorkflowDefinition` e `agentPlanPageDefinition` nao criam mais o proximo child; eles apenas validam, salvam o artefato incremental e retornam `update-status`.
- Criado `createParallelDynamicAgentStepIntent` em `agentPlanningShared.ts` para padronizar o fan-out controlado.
- `collab-messages` foi ajustado para:
  - nao preparar o step-pai paralelo como chamada LLM normal;
  - manter o pai paralelo em `in_progress` enquanto houver filhos em validacao;
  - abrir novo child slot a partir da fila quando um child termina;
  - preservar os payloads dos childs na task enquanto os getters ainda dependem da task como fonte de verdade;
  - gravar o selector em `step.prompt` durante `continueBeforePrompt`, permitindo que o `afterPromptStep` valide `pageId`/`workflowId`.
- Builds executados com sucesso:
  - `/Volumes/WagnerSSD1/collab/mls-base`: `pnpm build:frontend`
  - `/Volumes/WagnerSSD1/collab/collab-messages`: `pnpm build`
- Risco residual: ainda nao ha teste automatizado especifico para o fluxo paralelo de `add-step` + `executionMode=parallel`; a validacao feita foi por build e revisao de fluxo.

**EXTENSAO (run 2026-06-08) - metric table E table definitions em paralelo**:
- Os dois ultimos grupos seriais (`agentPlanMetricTableDefinition` e `agentPlanTableDefinition`) passaram a fan-out paralelo controlado (`maxParallel=5`), igual a page/workflow definitions. Agora TODOS os grupos de definitions independentes rodam em paralelo.
- `agentPlanMetricsIndex`: `createFirstMetricTableDefinitionIntent` (sequencial) virou `createMetricTableDefinitionParallelIntent` (`createParallelDynamicAgentStepIntent` para todos os `metricTableIds`).
- `agentPlanPersistenceIndex`: `createFirstTableDefinitionIntent` (sequencial) virou `createTableDefinitionParallelIntent` (todos os `tableIds`).
- Ambos acionados no caminho normal e via `createChildrenIntents` do critic (TODO-FINAL-024).
- `agentPlanMetricTableDefinition` e `agentPlanTableDefinition` `afterPromptStep`: removido o encadeamento `createNext...Intent` (e o `covered` set); cada child so valida/salva o seu artefato e retorna `update-status`. Selector vem de `args`/`step.prompt`. Imports orfaos (`createDynamicAgentStepIntent`, `findStepByPlanId`) removidos.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

**FIX (run 2026-06-08) - pageId/workflowId != selector derrubava o child paralelo**:
- Sintoma: `pageDefinition.pageId must match selector posOrderCreate` / `posOrderConfirm` (e analogo para workflowId). No fan-out paralelo, cada child recebe um selector (id do index) e seu prompt reduzido contem SO o index item daquele id, entao o conteudo gerado e sempre da pagina/workflow do selector — um id divergente e apenas erro de rotulo do modelo. A validacao estrita derrubava o child (e, sendo `update-status failed`, a task).
- Correcao deterministica (mesma filosofia do auto-correct de flowRefs): em `agentPlanPageDefinition` e `agentPlanWorkflowDefinition`, no `afterPromptStep`, coage `pageId`/`workflowId` para o selector antes de validar (com `console.warn`). O artefato fica salvo sob o id do selector, consistente com o index/coverage/navigation.
- `agentPlanMetricTableDefinition`/`agentPlanTableDefinition` nao tem validacao estrita de selector-match (validam sem selector), entao um id divergente nao derruba; no maximo gera mismatch nao-fatal no coverage. Pode receber a mesma coercao depois se aparecer.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-023 - Criar validacoes incrementais por checkpoint

Problema:
- Hoje `agentValidateSolutionCoverage` concentra a verificacao forte no fim do fluxo.
- Isso detecta inconsistencias tarde demais e obriga a task a manter payloads grandes ate o final, porque os agentes posteriores ainda precisam reler outputs completos da task.
- Para gravar `.defs.ts` logo apos cada artefato ser gerado e depois limpar o payload, o fluxo precisa validar em varios pontos, nao apenas no coverage final.

Acao:
- Criar checkpoints deterministas de validacao apos cada grupo de artefatos:
  - blueprint/final plan antes dos indices especializados
  - persistence index antes de table definitions
  - table definitions antes de metric/page/usecase consumers
  - metrics index antes de metric table definitions
  - workflow index antes de workflow definitions
  - page index antes de page definitions
  - usecases/plugins/horizontals antes de coverage final
- Em cada `afterPromptStep` que produz artefato persistivel:
  - validar JSON schema e regras semanticas locais
  - salvar `.defs.ts` draft quando valido
  - atualizar manifesto/checkpoint com arquivo, checksum, ids, planId, stepId e status
  - expor o artefato por getters capazes de ler task payload ou manifesto/defs
  - limpar ou substituir payload grande por referencia somente depois do getter por arquivo existir
- Transformar `agentValidateSolutionCoverage` em validador final de integracao/cobertura, consumindo checkpoints e snapshots compactos, nao como unica barreira de qualidade do fluxo.
- Manter payload completo apenas quando o step falhar, retornar `needs_input`, ou ainda nao tiver arquivo salvo.

Criterio de aceite:
- Um `.defs.ts` validado pode ser gravado e usado por agentes seguintes sem esperar o fim do planejamento.
- Payloads de page/workflow/table/metric/usecase podem ser limpos da task apos save e checkpoint, sem quebrar retry, coverage ou materializacao futura.
- O paralelo dinamico pode voltar a usar slots reutilizaveis sem precisar preservar todos os filhos completos na task, quando os getters ja estiverem baseados em manifesto/defs.
- `agentValidateSolutionCoverage` deixa de ser bloqueio tardio para usuario final; quando existir, vira relatorio tecnico de integracao/cobertura no trace/manifesto.

**EXECUTED** (2026-06-07):
- Checkpoints deterministicos por indice implementados em `agentPlanIndexReview.ts` (`runLocalCheckpoint` por indice):
  - `persistenceIndex`: rootEntity vs ontologia, tabelas sem writer, tabelas sem rules (warnings).
  - `metricsIndex`: widget -> metric table inexistente e dashboard actor fora de `actors[].actorId` (errors); sourceBaseTables desconhecidas e contagem abaixo do aprovado (warnings).
  - `workflowIndex`: actor desconhecido e persistenceRefs para tabela inexistente (errors); usecaseRefs/metricRefs desconhecidos (warnings).
  - `pageIndex`: navigationRefs para pagina inexistente (error); persistence/usecase/metric/plugin hints desconhecidos (warnings).
  - `pluginPlan`: provider duplicado em mais de um plugin (warning, conecta com TODO-FINAL-025).
  - `usecasePlan`: refs de tabela desconhecidas, actor desconhecido, metric tables sem usecase escritor (warnings).
- O checkpoint roda no `beforePromptStep` do critic, antes de qualquer LLM: erro deterministico vai direto para reparo (critica sintetica), sem gastar chamada de critica.
- Congelamento: indice aprovado e gravado em `l2/{moduleName}/trace/checkpoint-{indexName}.json` com checksum, source (agentName/stepId/planId), healthReport (erros/warnings locais + da critica) e status `frozen` no manifesto (`saveNewSolutionIndexCheckpoint`).
- Leitor por arquivo criado (`readNewSolutionIndexCheckpoint`) como fallback para getters baseados em manifesto/defs (pre-requisito para limpar payloads).
- `agentValidateSolutionCoverage` virou relatorio tecnico nao-bloqueante: com `status=ok` o step completa mesmo sem readiness e grava `plan-health-report.json` no trace + manifesto (`saveNewSolutionPlanHealthReport`).
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base (erros pre-existentes de mls-102030 no backend nao tem relacao).

**EXECUTED - limpeza de payload das paginas** (2026-06-07):
- Diagnostico confirmado: a pagina ja era salva em `l2/{module}/{pageId}.defs.ts` (agentPlanPageDefinition linha 369), mas o payload permanecia na task por dois motivos: `cleaner="input"` so limpa `interaction.input` (collab-messages tasks.ts:1217-1218), e o pai `parallel_dynamic` preserva os filhos (`shouldPreserveParallelChildren` true). Nao era bug, era o follow-up pendente.
- Leitor por arquivo/manifesto criado: `readSavedPlanArtifactDataList(context, artifactType)` em `agentNewSolutionArtifacts.ts` le `plan-artifacts.json`, abre cada arquivo referenciado e extrai o `data` do artefato (`.json` direto; `.defs.ts` via parse do literal entre `= ` e ` as const;`).
- `getPlanPageDefinitionOutputs` virou async com fallback: le primeiro os arquivos salvos (reconstruindo PlannerOutput via `normalizePlanPageDefinitionResult`) e depois sobrescreve por payloads ainda na task (passos nao salvos/falhos); merge por `pageId`. Unico consumidor (`agentValidateSolutionCoverage`) passou a usar `await`.
- `agentPlanPageDefinition.afterPromptStep` agora usa `cleaner="input_output"` SOMENTE quando `saveNewSolutionPlanArtifacts` retornou referencia (save de fato ocorreu); se o save falhar, mantem `cleaner="input"` para nao perder a pagina da task.
- ESCOPO inicial: paginas (sintoma relatado).
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

**EXECUTED - extensao para table/metric/workflow definitions** (2026-06-07):
- Helper generico `getPlannerOutputsWithFileFallback` em `agentPlanningShared.ts`: le os artefatos salvos por `artifactType`, reconstroi `PlannerOutput` via `config.normalizeResult`, e sobrescreve por payloads ainda na task (merge por id), ordenado.
- Getters convertidos para async com fallback de arquivo:
  - `getPlanTableDefinitionOutputs` (artifactType `table`)
  - `getPlanMetricTableDefinitionOutputs` (artifactType `metricTable`)
  - `getPlanWorkflowDefinitionOutputs` (artifactType `workflow`)
- O encadeamento sequencial de tabelas/metricas (`createNextTableDefinitionIntent` / `createNextMetricTableDefinitionIntent`) agora e async e computa o `covered` set a partir de arquivos + payloads, entao continua correto mesmo apos a limpeza do payload.
- afterPromptStep desses 3 agentes usa `cleaner="input_output"` somente quando o save retornou referencia; senao `input` (nao perde o artefato).
- Todos os call sites dos 3 getters receberam `await` (consumidores em beforePromptStep/afterPromptStep, todos async): metricsIndex, metricTableDefinition, pageIndex, usecaseEntities, pageDefinition, workflowIndex, workflowDefinition, agentPlanAgents, coverage.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

**NAO EXECUTADO - usecasePlan** (decisao tecnica, 2026-06-07):
- Diferente das definitions folha, `usecasePlan` e um indice que passa por critic/reparo (TODO-FINAL-024). Seu resultado completo (com `usecaseEntities`) so existe no payload da task ou no `checkpoint-usecasePlan.json` (os artefatos `usecase` salvos sao por-usecase e NAO contem `usecaseEntities`).
- Limpar o payload exigiria tornar `getPlanUsecaseEntitiesOutput` async com fallback ao checkpoint, o que cascateia para: (a) o helper SINCRONO `getUsecaseIds` em `agentPlanIndexReview.ts` (usado pelos checkpoints de workflow/page via `safe(() => ...)`), e (b) a interface SINCRONA `getCurrentOutput` chamada pelo fluxo critic/reparo recem-criado (3 call sites). Threadear async nesse fluxo novo e ainda sem teste automatizado nao compensa para limpar um unico payload singular.
- Decisao: manter o payload do usecase por enquanto (`cleaner="input"` no caminho de aprovacao do critic). Reavaliar quando os getters de indice migrarem para leitura por checkpoint de forma coordenada (mesma migracao dos 6 indices).

**AJUSTE (run 2026-06-08) - formato do `.defs.ts` de usecase (l1/.../layer_3_usecases)**:
- O arquivo do usecase deixou de salvar o envelope com `data: { backendArchitecture, controllerRules, usecase }`. Agora exporta o objeto do usecase diretamente sob um nome fixo: `export const useCase = {...} as const` (todo arquivo de usecase usa a mesma variavel). Implementado via flag `bareExport` no `PlanArtifactCandidate` (writer escreve `data` direto, sem metadados; os metadados/checksum/status ficam so no manifesto).
- `backendArchitecture` e `controllerRules` (globais, repetidos) nao entram mais em cada arquivo de usecase.
- Commands do usecase: o schema de `commands` mudou de `string[]` para objetos `{ commandId, input, output }`, com `input: [{name,type,required}]` e `output: [{name,type}]` (campos tipados, objetos fechados, mantem strict). Normalizer, validacao e prompt atualizados para exigir input/output por command.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-024 - Validar e reparar cada indice com LLM antes das definitions

Problema:
- Os indices ainda carregam decisoes sensiveis da LLM, especialmente quantidade de metricas, paginas, workflows, ownership de tabelas e plugin resolutions.
- Quando um indice ruim passa adiante, os agentes filhos apenas detalham uma decisao ja instavel e o erro aparece tarde, muitas vezes so na coverage final.
- Uma validacao final bloqueante e ruim para usuario leigo, porque chega depois de muitos steps e nao oferece um caminho claro de correcao.

Decisao:
- Fazer uma LLM critica por indice e uma LLM reparadora por indice, nao uma unica LLM para todos os indices.
- Motivo: cada indice tem contrato, schema, riscos e vocabulario proprio; separar reduz contexto, melhora foco e evita que uma correcao de paginas altere metricas, plugins ou tabelas sem necessidade.

Fluxo proposto por indice:
1. Gerar o indice normal.
2. Rodar validacao local basica de schema/ids/refs.
3. Rodar `agentCritic<IndexName>` para criticar somente aquele indice.
4. Se houver `errors` ou `warnings` relevantes, rodar `agentRepair<IndexName>` recebendo:
   - indice atual
   - relatorio da critica
   - schema/contrato do indice
   - final plan compacto e dependencias minimas daquele indice
5. A reparadora retorna o indice completo corrigido, nao patches parciais.
6. Rodar a critica novamente, com limite de tentativas para evitar loop.
7. Congelar o indice no manifesto/checkpoint quando aprovado.
8. Somente depois abrir os agentes filhos em paralelo para definitions individuais.

Indices alvo:
- `persistenceIndex`: ownership, tableKind, moduleOwned vs mdm/horizontal/plugin-owned, tables novas realmente necessarias.
- `metricsIndex`: quantidade de metricas, pergunta de negocio, dashboard alvo, fonte de dados, prioridade e relacao com capabilities aprovadas.
- `workflowIndex`: executionMode, createsTask, atores, refs para usecases/tabelas/metricas, ausencia de workflow desnecessario.
- `pageIndex`: paginas necessarias, atores vindos do plano, metric dashboard quando solicitado, flowRefs coerentes, sem hard-code de idioma.
- `pluginPlan`: plugin aceito, draft vs existing, resolution valida, ausencia de plugin inventado.
- `usecasePlan`: cobertura das escritas, lifecycle transitions, BFF commands e atualizacoes de metricas.
- `agentIndex`, quando existir: agentes propostos, triggers, usecaseRefs e relacao com workflows/paginas.

Tratamento de warnings:
- Warnings que representam escolha de modelagem aceitavel nao devem bloquear o usuario no fim.
- Exemplo: page input pode ser um objeto que contem internamente o id; isso deve ser aceito quando o contrato do objeto estiver claro, em vez de exigir sempre `{entity}Id` separado.
- Warnings tecnicos podem ir para trace/manifesto como `planHealthReport`, sem marcar a task como failed depois de tudo gerado.

Criterio de aceite:
- Cada indice passa por critica e reparo antes de liberar seus filhos.
- A quantidade de metricas fica muito menos sensivel entre execucoes, porque o `metricsIndex` e criticado, reparado e congelado antes das metric table definitions.
- Definitions individuais deixam de decidir escopo; elas apenas detalham o selector de um indice congelado.
- A coverage final, se mantida, nao bloqueia usuario final; serve para rastreamento tecnico e melhoria posterior do fluxo.

**EXECUTED** (2026-06-07):
- Implementacao com 2 agentes genericos parametrizados por indice (decisao confirmada com o usuario): `agentCriticPlanIndex.ts` e `agentRepairPlanIndex.ts`. Cada indice continua tendo sua propria chamada LLM de critica e de reparo, com contrato, schema, prompt focus e contexto minimo proprios definidos em `agentPlanIndexReview.ts` (`contractFocus`, `resultSchema`, `buildReviewContext`, `runLocalCheckpoint`, `validateRepairedOutput`, `createChildrenIntents` por indice).
- Indices cobertos: `persistenceIndex`, `metricsIndex`, `workflowIndex`, `pageIndex`, `pluginPlan`, `usecasePlan` (todos os 6). `agentIndex` fica para quando existir indice proprio.
- Orquestracao (restricao descoberta no `collab-messages`: `setStepCompletedIfChildrenCompleted` auto-completa pai com filhos todos terminais):
  - O agente de indice, quando `status=ok`, NAO completa o step; retorna `in_progress` + add-step do critic como filho do proprio step do indice (`createHoldIndexForReviewIntents`). Assim os steps downstream que dependem do planId do indice continuam travados ate aprovacao.
  - Critic com erros: adiciona o repair como filho do indice ANTES de completar o proprio step (mantem sempre um filho nao-terminal sob o indice, evitando auto-complete prematuro).
  - Repair valido: adiciona o proximo critic (attempt+1) antes de completar; repair invalido ou `needs_input`: falha repair + indice (payload preservado para debug).
  - Aprovacao: congela checkpoint, completa critic + indice (cleaner input) e dispara o fan-out existente (chain de table/metric defs, paralelo de workflows/pages). Plugins e usecases salvam seus artefatos incrementais (TODO-FINAL-011) neste ponto, ja com o plano possivelmente reparado.
  - Limite: `MAX_PLAN_INDEX_CRITIC_ATTEMPTS=3` (critica inicial + ate 2 rodadas de reparo); estourou, critic e indice falham com resumo dos erros.
- A reparadora retorna o indice completo corrigido (tool `submitRepaired{IndexName}` registrado com o schema do indice original) e o resultado e validado com o mesmo normalize/validate do agente original.
- Getters repair-aware: `getPlannerOutputWithRepair` em `agentPlanningShared.ts`; os 6 getters (`getPlanPersistenceIndexOutput`, etc.) preferem o ultimo repair completado, entao todos os consumidores downstream (definitions, coverage, prompts) usam automaticamente o indice corrigido.
- Tratamento de warnings: nao bloqueiam; vao para o healthReport do checkpoint (`l2/{module}/trace/checkpoint-{indexName}.json`). O prompt do critic instrui explicitamente que escolha de modelagem aceitavel (ex.: page input como objeto contendo o id) e warning, nunca error.
- Falha do proprio critic (payload invalido/status failed): fallback aprova com warning registrado no checkpoint, preservando o comportamento pre-critica em vez de criar um novo bloqueio.
- Atalho sem LLM: indice vazio/desabilitado (`skipCriticWhen`) congela direto; erro deterministico local pula a LLM de critica e vai direto ao reparo com critica sintetica.
- Riscos residuais (sem teste automatizado para o loop critic/repair):
  - confianca no padrao ja usado em producao de `beforePromptStep` retornar update-status/add-step sem prompt_ready (mesmo padrao do `agentNewSolutionPlanner`);
  - schema do tool de repair so e registrado quando `agentPlanIndexReview` e carregado; sem ele a extracao cai na validacao do normalize (mais permissiva), sem quebrar.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

**FIX (run 2026-06-08) - flowRefs bucket determinismo + falha de repair**:
- Sintoma: `agentRepairPlanIndex` falhava repetidamente o `pageIndex` com "page X flowRefs.taskWorkflows references workflow Y with executionMode=entityLifecycle; expected entityLifecycles". O bucket de um `flowRef` e 100% determinado pelo `executionMode` do workflow, entao era erro deterministico que o LLM reparador nao conseguia consertar, derrubando o indice e a task.
- Correcao: `validatePageFlowRefsAgainstWorkflowIndex` deixou de lancar erro em bucket errado e passou a AUTO-CORRIGIR — re-bucketiza cada workflow id pelo seu `executionMode` e deduplica, mutando `flowRefs` in place. So lanca erro em workflow id desconhecido. Aplica em geracao do pageIndex, no reparo e no page definition (todos chamam a funcao).
- Robustez do restart: os caminhos de falha do critic (`failIndexIntents`) e do repair so emitem o `update-status` que falha o STEP do indice quando o pai dele resolve como step `agent`. Antes, alcancar um avo cujo id nao resolve mais (apos restart manual) fazia o backend lancar "Parent step not found", quebrando o restart (409 + recursao em `_processIntentsStream`). Ver TODO-FINAL-029 para a robustez mais profunda no `collab-messages`.
- Build: `tsc -p tsconfig.frontend.json` ok.

### TODO-FINAL-029 - Robustez de restart de step de critic/repair (collab-messages)

Problema:
- Ao clicar "restart" num step de critic/repair que falhou, o frontend (`mls-102025`/`aiAgentOrchestration.js`) re-executa o `afterPromptStep`, que pode emitir `update-status` para um step ancestral cujo id nao resolve mais -> backend `intentUpdateStatus` lanca `DomainError: Parent step not found in intentUpdateStatus: <id>`, retorna 409 Conflict em `/exec`, e o `_processIntentsStream` entra em recursao/loop.
- O guard adicionado no agente (so falha o indice quando o pai resolve) evita o crash vindo do agente, mas a robustez do mecanismo de restart de subarvore critic/repair e do tratamento de pai ausente e do `collab-messages`/frontend.

Acao (collab-messages + mls-102025):
- `intentUpdateStatus`: tratar pai/step ausente de forma defensiva (ignorar/trace em vez de lancar) durante restart, ou validar antes de aplicar.
- `restartStep` (aiAgentOrchestration): ao reiniciar um step de critic/repair, reconciliar a subarvore (o indice pai e os checkpoints) em vez de re-emitir intents para ancestrais possivelmente removidos; evitar recursao infinita em `_processIntentsStream` quando o backend responde 409.
- Considerar: para steps de critic/repair, o restart deveria reiniciar o STEP DO INDICE (re-gerar) em vez do filho critic/repair isolado.

Criterio de aceite:
- Restart de um critic/repair falho nao gera "Parent step not found", 409 em loop, nem recursao infinita.
- O usuario consegue reiniciar o planejamento de um indice de forma consistente.

### TODO-FINAL-030 - Manter a task leve: reduzir inputs e limpar payloads cedo (teto ~400KB)

Problema:
- A task acumula muito rapido e pode passar ~400KB, ponto em que fica indisponivel. Se o usuario deixa rodando e so volta depois (ex.: 20 min), a task pode nao estar mais acessivel para ver o erro.
- Baseline medido (run30, `agents/newSolution/run30/tasks2Analise.json`): total ~539KB. O peso esta nos INPUTS (human prompts), nao nos payloads:
  - inputs: workflowIndex ~112KB, usecaseEntities ~94KB, metricsIndex ~67KB, persistenceIndex ~42KB, coverage ~21KB, pageIndex ~13KB (~349KB).
  - payloads: finalize ~29KB, usecase ~16KB, pageIndex ~15KB, criticPlanIndex ~10KB, coverage ~8.5KB, metrics/persistence/workflowIndex ~20KB (~104KB).
- Causa raiz dos inputs: os agentes de INDICE `persistenceIndex/metricsIndex/workflowIndex/usecaseEntities` ainda despejam `finalPlan` completo + todos os outputs anteriores no prompt. A reducao de tokens (TODO-006..009) so cobriu definitions + pageIndex + coverage; os indices grandes ficaram de fora.
- Causa dos payloads remanescentes: os indices guardam payload (`cleaner="input"`) porque os getters (`getPlanXIndexOutput` via `getPlannerOutputWithRepair`) ainda leem da task; falta fallback por checkpoint.

Decisao/estrategia: limpar CEDO e incrementalmente, nunca tarde. Dois eixos: (A) gerar inputs menores; (B) limpar payloads assim que o consumidor terminou e o artefato/checkpoint ja existe.

Rotinas propostas:

R1 — Reduzir inputs dos 4 indices grandes (maior ganho, baixo risco, so prompt; mesmo padrao de TODO-006..009):
- `agentPlanPersistenceIndex`, `agentPlanMetricsIndex`, `agentPlanWorkflowIndex`, `agentPlanUsecaseEntities`: trocar o dump completo por um snapshot compacto (final plan compacto + so os refs/ids que o indice precisa). Estimativa: corta a maior parte dos ~315KB de input desses 4.

**EXECUTED R1** (2026-06-08):
- Helper compartilhado `compactFinalPlan(finalPlan.result, includeOntologyFields=false)` em `agentPlanningShared.ts`: resume modulo/actors/capabilities/userActions/rules + ontologyEntities SEM os `fields` (o grosso) + approvedArtifacts por id/title. Os indices nao precisam de fields (vem nas table definitions depois).
- `agentPlanPersistenceIndex`: prompt agora envia `{ finalPlan: compact, mdmDomains(summary), horizontalModules(summary), plugins(summary), initialMetricsRequested }` em vez dos planos completos.
- `agentPlanMetricsIndex`: `{ finalPlan: compact, persistenceTables(summary), tableDefinitions(so ids/nome), initialMetricsRequested }` — dropou table definitions completas.
- `agentPlanWorkflowIndex`: `{ finalPlan: compact, persistenceTables(summary), metricTables(ids/title), usecases(id/title/actor) }` — dropou final plan completo, table/metric definitions completas e usecase plan completo.
- `agentPlanUsecaseEntities`: `{ finalPlan: compact, persistenceTables(summary), excludedEntities(id/ownership), metricTables(summary) }` — dropou table/metric definitions completas (usecases referenciam por nome/ownership, nao por coluna).
- Esperado: corta a maior parte dos ~315KB de input desses 4 (o `fields` da ontologia + dumps completos eram o grosso) e acelera a geracao (prompt menor).
- Build: `tsc -p tsconfig.frontend.json` ok.

**EXECUTED R7** (2026-06-08) - telemetria de tamanho:
- `estimateTaskBytes(context)` + `logTaskSizeIfLarge(context, label)` em `agentNewSolutionArtifacts.ts`. Chamado em `saveNewSolutionAgentTracePayload` (que todo agente invoca no afterPrompt), entao loga o tamanho aproximado da task a cada step. WARN >=300KB, CRITICAL >=400KB. So loga, sem mudar comportamento — serve para confirmar se R1 basta e detectar crescimento cedo.

**R2** - ja atendido: inputs sao limpos no complete (`cleaner="input"`/`input_output`); nenhum input sobrevive ao complete do proprio step.

**DEFERIDO R3-R6** (decisao tecnica, 2026-06-08):
- R3 (fallback por checkpoint nos getters de indice) e o pre-requisito de R4/R5/R6, e exige tornar `getPlanXIndexOutput`/`getFinalizeSolutionPlanOutput` ASSINCRONOS — confirmado que NAO ha leitura sincrona de conteudo no stor (`getContent` e sempre `Promise`). Isso cascateia para dentro do fluxo critic/repair recem-criado: a interface `getCurrentOutput` e sincrona e helpers como `getModuleTableIds`/`getUsecaseIds` em `agentPlanIndexReview.ts` usam `safe(() => ...)` sincrono. Mesmo muro que adiou a limpeza do usecase.
- Custo/beneficio: apos R1, os inputs grandes (~315KB) sairam; os payloads de indice/plan somam ~104KB (finalize ~29KB, usecase ~16KB, pageIndex ~15KB, etc.), entao o pico deve ficar com folga abaixo de 400KB sem R3-R6. A telemetria (R7) confirma em runs reais.
- Recomendacao: so investir em R3-R6 (migracao coordenada dos getters de indice + finalize para fallback por checkpoint/arquivo, async) SE a telemetria mostrar CRITICAL em modulos realistas. Caso necessario, fazer junto com a limpeza do usecase (mesma migracao), e mover a coverage para ler do persistido (R6).
- Ganho seguro PARCIAL ja aplicado (sem async): o step de critic APROVADOR e limpo com `cleaner="input_output"` (a critica e morta apos aprovacao; healthReport ja congelado no checkpoint). Cobre o caso comum (1 tentativa -> aprova). Payloads de repair NAO sao limpos (sao a fonte do indice via `getPlannerOutputWithRepair` ate existir fallback por checkpoint). Critic de tentativas anteriores (caso raro multi-attempt) ainda ficam — poderiam ser limpos varrendo os filhos, mas o ganho e marginal.

R2 — Garantir limpeza imediata de input no complete: confirmar que TODO step de indice/def completa com `cleaner` (input ja limpa; indices via `approveIndexIntents` usam `input`). Inputs nunca devem sobreviver ao complete do proprio step.

R3 — Fallback por checkpoint nos getters de indice (pre-requisito para limpar payload de indice):
- `getPlanPersistenceIndexOutput/getPlanMetricsIndexOutput/getPlanWorkflowIndexOutput/getPlanPageIndexOutput` (e `getPlanUsecaseEntitiesOutput`): quando o payload da task nao existir, ler do `checkpoint-{indexName}.json` (ja gravado por `saveNewSolutionIndexCheckpoint`, TODO-023). Espelha o que ja foi feito para definitions folha (fallback por arquivo).

R4 — Limpeza de payload de indice apos consumidores (cedo):
- Apos o fan-out de table definitions completar -> limpar payload do `persistenceIndex`.
- Apos metric table definitions -> limpar `metricsIndex`.
- Apos workflow definitions -> limpar `workflowIndex`.
- Apos page definitions -> limpar `pageIndex`.
- `usecasePlan` -> apos workflowIndex/defs + pageIndex/defs + coverage; persistir o plano completo em checkpoint e limpar.
- Mecanismo: emitir `update-status` com `cleaner="input_output"` no step (ja completo) do indice quando o pai do fan-out completa. `intentUpdateStatus` ja re-limpa step completo (mesmo status + cleaner). Disparo no ponto de conclusao do parent paralelo (orquestracao) ou via o agente que fecha o grupo.

R5 — `finalize` plan payload (~29KB, consumido por quase todos):
- E o backbone. Persistir em `l5/{module}/module.defs.ts` (ja salvo) e dar fallback por arquivo em `getFinalizeSolutionPlanOutput`; entao limpar o payload da task no fim (apos o ultimo consumidor / na coverage).

R6 — Coverage valida o PERSISTIDO, nao a task:
- `agentValidateSolutionCoverage` deve montar o snapshot a partir do manifesto + checkpoints + `.defs` salvos (nao dos payloads da task). Assim todos os payloads de indice/plan podem ser limpos ANTES da coverage. Alinhado com TODO-023/024 (coverage = relatorio nao-bloqueante).

R7 — Telemetria opcional de tamanho:
- Helper para estimar bytes da task em pontos-chave (apos cada grupo) e logar/trace, para detectar regressao de tamanho cedo.

Ordem recomendada: R1 (ganho imediato, isolado) -> R3 -> R4/R5 -> R6 -> R2/R7. R1 sozinho provavelmente ja traz a task para baixo de 400KB no pico; R3-R6 garantem que ela encolhe ao longo do fluxo.

Criterio de aceite:
- Pico de tamanho da task fica com folga abaixo de 400KB num modulo realista (ex.: petShop/barbershop com ~5 dominios, ~5 workflows, ~10 paginas).
- Indices/plan payloads nao permanecem na task depois que seus consumidores terminaram; coverage roda sobre artefatos persistidos.
- Retry/coverage/materializacao continuam funcionando lendo de checkpoint/arquivo (nada quebra por payload ausente).

### TODO-FINAL-025 - Reaproveitar plugins existentes e evitar drafts duplicados em `l2/plugins`

Problema:
- A pasta `l2/plugins` acumulou plugins duplicados para a mesma integracao, por exemplo `stripe` e `stripePayments`.
- Isso indica que o fluxo de `pluginPlan` e/ou da tela de geracao nao esta reaproveitando corretamente plugins ja existentes antes de criar um novo draft.
- Duplicar plugin global por variacao de nome piora manutencao, confunde o usuario e pode espalhar conexoes de modulos para implementacoes quase identicas.

Acao:
- Antes de decidir `resolution=create_draft`, o fluxo deve inspecionar `l2/plugins` existente no projeto atual.
- Criar uma etapa de matching de reuso com pelo menos:
  - `pluginId` normalizado
  - nome/titulo normalizado
  - descricao/resumo da integracao
  - provider principal ou capability principal, quando existir
- Se houver plugin existente com alta similaridade, preferir `resolution=existing` e referenciar o plugin encontrado, em vez de criar novo draft.
- Se houver ambiguidade entre dois plugins parecidos, emitir warning tecnico ou pedir revisao interna antes de criar mais um draft duplicado.
- Registrar no trace/manifesto por que o plugin foi reaproveitado ou por que um novo draft foi realmente necessario.
- Incluir essa verificacao tanto no `pluginPlan` quanto na tela/etapa que materializa ou apresenta a lista de plugins para o usuario.

Criterio de aceite:
- Integracoes equivalentes, como `stripe` e `stripePayments`, nao geram dois plugins globais separados sem justificativa forte.
- O plano de plugin tenta reaproveitar primeiro e so cria draft novo quando nao houver candidato suficientemente proximo.
- O usuario ve menos plugins repetidos em `l2/plugins`, e os modulos passam a apontar para um plugin global coerente.

**EXECUTED** (2026-06-07):
- A causa do duplicado era o match exato por `pluginId`: antes, `buildPluginInventorySync` so reconhecia `existing` quando havia `l2/plugins/{pluginId}/plugin.defs.ts` com id identico; `stripe` e `stripePayments` viravam dois ids distintos -> ambos `create_draft`.
- Em `agentPlanPlugins.ts`:
  - Novo `scanExistingPlugins(searchProjects)` varre todos os `l2/plugins/*/plugin.defs.ts` (no projeto atual + dependencias) uma vez, e `isReusableExistingPlugin` exclui drafts criados pelo plano atual.
  - `buildPluginInventorySync`: quando NAO ha match exato, tenta reuso por brand via `findExistingPluginsByBrand`. Se houver exatamente 1 plugin existente do mesmo brand -> `resolution="existing"`, `pluginDefsFileRef`/`sourceProject` apontando para o plugin existente, e `reusedFromPluginId` registrado. Sem novo draft global.
  - Matching conservador (evita falso positivo): mesmo primeiro token de brand (`pluginBrandToken`) E pelo menos um lado e o plugin "brand-only" (`normalizePluginKey === brand`). Casa `stripe` <-> `stripePayments`; nao casa `mailChimp` <-> `mailGun`.
  - Ambiguidade (mais de 1 existente do mesmo brand): nao auto-reaproveita; adiciona `reuseWarnings` e mantem `create_draft` para revisao manual.
- O reuso e exposto a LLM: `pluginInventory` (com `reuseWarnings` e `reusedFromPluginId` por item) ja vai no prompt; novas regras no systemPrompt instruem "reuse first" e respeitar `reuseWarnings`.
- A validacao existente (`validatePlanPluginsOutput`) ja forca o output a bater com o inventario (resolution/pluginDefsFileRef/sourceProject), entao o reuso e efetivamente aplicado, nao apenas sugerido.
- Registro: `console.warn` por reuso; o checkpoint do critic de `pluginPlan` (TODO-FINAL-024) ja grava warning de provider duplicado no `healthReport` congelado.
- ESCOPO: aplicado ao `pluginPlan`. A "tela/etapa que materializa" (apresentacao de plugins ao usuario) fica fora desta task, junto com materialize (coerente com o escopo do plano).
- Limitacao conhecida: no reuso por brand, o `pluginId` planejado permanece o solicitado (ex.: `stripePayments`) e a conexao do modulo aponta para o plugin global existente (`stripe`); o objetivo do TODO (nao criar segundo draft global em `l2/plugins`) e atendido, mas o nome da conexao do modulo pode diferir do plugin global. Normalizar tambem o id da conexao seria um passo adicional.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

### TODO-FINAL-026 - Adotar `<!-- x-tool-strict: true -->` nos agentes com schema compativel

Problema:
- Parte dos erros recorrentes de planejamento vem de payload tool-call que nao casa exatamente com o JSON schema esperado.
- Foi implementado suporte ao modo string/strict da OpenAI via comentario no system prompt, por exemplo `<!-- x-tool-strict: true -->`.
- Esse modo ajuda a reduzir drift de payload, mas nao pode ser ligado de forma cega: o agente precisa ter schema compativel.

Restricao:
- Para usar `x-tool-strict: true`, o schema do tool precisa ser revisado agente por agente.
- Se o contrato do agente depender de estruturas abertas ou incompatibilidades do schema atual, esse agente nao deve entrar em strict ate o schema ser fechado o suficiente.
- Se for necessario manter flexibilidade estrutural, o agente continua fora do strict e isso deve ficar documentado no proprio TODO/trace.

Acao:
- Fazer um inventario dos agentes de `agentNewSolution` e classificar cada um em:
  - `strict-ready`
  - `strict-ready-after-schema-fix`
  - `not-strict-compatible-for-now`
- Para os agentes `strict-ready`:
  - adicionar `<!-- x-tool-strict: true -->` ao system prompt
  - revisar o schema do tool para ficar totalmente fechado e deterministico
  - remover brechas que geram mismatch frequente entre prompt, schema e validator
- Para os agentes `strict-ready-after-schema-fix`:
  - primeiro corrigir o schema
  - depois ativar strict
- Para os agentes que nao puderem usar strict agora:
  - registrar o motivo tecnico
  - manter validacao/normalizacao defensiva no afterPrompt

Escopo prioritario:
- Comecar pelos agentes com mais recorrencia de erro de payload/schema:
  - `agentPlanPageDefinition`
  - `agentPlanWorkflowDefinition`
  - `agentPlanTableDefinition`
  - `agentPlanMetricTableDefinition`
  - `agentPlanPlugins`
  - `agentFinalizeSolutionPlan`
  - agentes de indice que forem migrados para critica/reparo por LLM

Criterio de aceite:
- Todo agente compativel com schema estrito usa `<!-- x-tool-strict: true -->`.
- A taxa de erro de payload incompatível com schema cai de forma perceptivel nos traces.
- Cada agente fora do strict fica explicitamente identificado com a justificativa tecnica para isso.

**EXECUTED** (2026-06-07):
- Mecanismo confirmado em `collab-llm` (`helpers/strictToolSchema.ts` + `layer_2_controllers/proxy.ts`): `<!-- x-tool-strict: true -->` no system prompt e opt-in; o schema do tool e auto-transformado para strict da OpenAI (opcionais viram nullable, `additionalProperties:false` e `required` totais forcados). Incompatibilidade nao quebra: o proxy envia sem strict nativo e registra warning no trace. A validacao ajv contra o schema original sempre roda.
- Bloqueadores de strict (de `strictToolSchema.ts`): `additionalProperties: true`, `oneOf`/`allOf`/`not`, e objeto com `type:"object"` sem `properties` (inclui mapas via `additionalProperties: <schema>`).
- Inventario completo dos agentes de `agentNewSolution`:
  - `strict-ready` (recebeu `<!-- x-tool-strict: true -->`): `agentPlanPersistenceIndex`, `agentPlanTableDefinition`, `agentPlanMetricsIndex`, `agentPlanMetricTableDefinition`, `agentPlanUsecaseEntities`, `agentPlanWorkflowIndex`, `agentPlanWorkflowDefinition`, `agentPlanPageIndex`, `agentPlanPlugins`, `agentPlanMDM`, `agentPlanHorizontals`, `agentPlanAgents`, `agentBlueprintReview`, `agentDiscoverSolutionScope`, `agentRecommendImplementations`, `agentCriticPlanIndex`, `agentRepairPlanIndex`. (`agentPlanPageDefinition` ja tinha — ver ressalva abaixo.)
  - `not-strict-compatible-for-now` (NAO recebeu, com motivo):
    - `agentFinalizeSolutionPlan` e `agentSolutionBlueprint`: compartilham `ontologySchema` em `agentSolutionPlanSchemas.ts`, onde `ontology.entities` e mapa dinamico (`additionalProperties: ontologyEntitySchema`, sem `properties`); fechar exigiria conhecer os entity ids em tempo de schema, o que nao e possivel.
    - `agentValidateSolutionCoverage`: `checklistResults` usa `additionalProperties: true` (mapa dinamico de codigos de checagem).
    - `agentPlanPageDefinition`: ja tem o comentario; o BFF `input`/`output` eram objetos livres (`additionalProperties: true`) que impediam o strict nativo. RESOLVIDO em 2026-06-08 (ver AJUSTE abaixo): input/output viraram arrays de campos tipados, agora o agente e totalmente strict-ready.
  - `N/A` (nao usam tool schema de planner): `agentNewSolution` (saida JSON flexible), `agentNewSolutionRequirements` (clarification), `agentNewSolutionPlanner` (wrapper sem LLM).
- Verificacao: todos os 17 strict-ready tem `additionalProperties:false` em todos os objetos do schema (contagem `type:object == additionalProperties:false`, sem mapas nem combinadores). `agentRepairPlanIndex` usa os schemas de indice (todos fechados) e `agentCriticPlanIndex` usa o schema de critica fechado.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.
- Risco residual: sem teste end-to-end com provider; a eficacia (queda de erro de payload) so e observavel nos traces de execucao real. A incompatibilidade e nao-fatal por design, entao um falso "strict-ready" so geraria warning, nao quebra.

**AJUSTE (run 2026-06-08) - page definition agora strict-ready**:
- Sintoma no trace: `tool 'submitPageDefinitionPlan': schema not strict-ready (additionalProperties: true not supported in strict mode) — sent without native strict`, e o step falhou (sem strict nativo, o gpt-5.2-codex divergia do schema e o ajv rejeitava).
- Causa: `bffCommandSchema.input`/`output` eram objetos livres (`{ type:'object', additionalProperties:true }`).
- Correcao (consistente com o ajuste de commands do usecase): input/output viraram arrays de campos tipados fechados — `input: [{name,type,required}]`, `output: [{name,type}]`. Schema, `BffCommandSpec` (+ `BffCommandInputField`/`BffCommandOutputField`), normalizer (`normalizeBffInputFields`/`normalizeBffOutputFields`) e prompt atualizados.
- Agora `agentPlanPageDefinition` e totalmente strict-ready: nenhum `additionalProperties:true`, o strict nativo engata e o erro do trace some.
- Build: `tsc -p tsconfig.frontend.json` ok.

**FIX (run 2026-06-08) - `const` rejeitado pelo provider strict (collab-llm)**:
- Sintoma: `x-tool-strict: ERROR — provider rejected strict tool schemas (HTTP 400) — retried without native strict` (ex.: `agentPlanMetricTableDefinition`). O schema era strict-ready pelo nosso transformer, mas o provider (azure/gpt-5.2-codex) rejeitava por causa do keyword `const` (OpenAI/Azure structured outputs so aceitam `enum`). Resultado: fallback silencioso para nao-strict em TODO agente que usa `const` (persistence, metrics, usecase, table, metricTable, ...).
- Correcao no transformer do `collab-llm` (`src/helpers/strictToolSchema.ts`, `transformNode`): converte `const: X` -> `enum: [X]` em qualquer no, inferindo `type` quando ausente (string/boolean/integer/number/null). Semanticamente identico; agora o strict nativo e aceito. `strictIncompatibilityReason` deixa de considerar `const` um problema.
- Teste adicionado em `src/tests/strictToolSchema.test.ts` (const string/boolean/integer + sem type). Logica validada via transpile standalone (vitest/tsx nao rodam no sandbox por binarios nativos de macOS); `tsc` do collab-llm ok.
- Requer deploy do `collab-llm`. Beneficia todos os agentes strict de uma vez, sem editar schema por schema.

### TODO-FINAL-027 - Enriquecer `l4/workflows/*.defs.ts` com metadata explicita de modulos afetados

Problema:
- Os workflows ficam em `l4/workflows/{workflowId}.defs.ts` como artefatos globais, o que faz sentido por desenho quando um workflow cruza mais de um modulo, por exemplo `petShop`, `financeiro` e `stripe`.
- Hoje, porem, o workflow global nao deixa claro o suficiente quais modulos, paginas, entidades, plugins e artefatos ele realmente afeta.
- Isso dificulta o objetivo futuro de ter um agente de manutencao que leia um workflow e consiga decidir com seguranca quais modulos e quais arquivos precisam ser alterados.

Decisao:
- Manter os workflows em `l4/workflows` como artefatos globais.
- Nao mover workflow para dentro de um modulo.
- Enriquecer o proprio `.defs.ts` do workflow com metadata de escopo e impacto, para que a LLM consiga entender a fronteira entre workflow global e artefatos modulares dependentes.

Acao:
- Adicionar no contrato de `workflowDefinition` campos explicitos para rastrear impacto por modulo, por exemplo:
  - `moduleRefs` ou equivalente: lista dos modulos participantes
  - `pageRefsByModule` ou refs de pagina com `moduleId`
  - `entityRefsByModule` quando a mesma entidade/nome puder aparecer em modulos diferentes
  - `pluginRefs` e `externalRefs` com indicacao do modulo consumidor quando aplicavel
  - `writesArtifacts` ou metadata equivalente para mostrar quais artefatos modulares o workflow pode exigir alterar
- Garantir que `relatedPages`, `persistenceRefs`, `usecaseRefs`, `metricRefs` e outros refs consigam ser reconciliados com um `moduleId` quando o workflow tocar mais de um contexto.
- Incluir essa metadata nos checkpoints/trace para permitir analise de impacto por agente no futuro.
- Ajustar prompts e validadores para que a LLM declare explicitamente quando um workflow e:
  - somente de um modulo
  - multi-modulo
  - multi-modulo com integracao externa dominante

Criterio de aceite:
- Continuamos com `l4/workflows` global, sem perder a capacidade de saber quais modulos o workflow afeta.
- Um agente futuro de manutencao consegue ler um workflow e identificar com mais precisao quais paginas, plugins, usecases, tabelas e modulos entram no blast radius da mudanca.
- Workflows que cruzam `petShop`, `financeiro`, `stripe` ou outros contextos ficam semanticamente claros no `.defs.ts`, e nao apenas implicitos no texto livre.

**EXECUTED** (2026-06-07):
- `agentPlanWorkflowDefinition` ganhou metadata de impacto por modulo no `workflowDefinition` (campos obrigatorios; arrays podem vir vazios; objetos fechados, strict-compatível):
  - `workflowScope`: enum `singleModule` | `multiModule` | `multiModuleExternal`.
  - `moduleRefs`: ids de todos os modulos que o workflow toca (inclui o modulo atual).
  - `pageRefsByModule`: `{ moduleId, pageId }[]` reconciliando `relatedPages` com o modulo dono.
  - `entityRefsByModule`: `{ moduleId, entity }[]` para desambiguar entidades de mesmo nome em modulos diferentes.
  - `writesArtifacts`: `{ moduleId, artifactType, artifactId }[]` (artifactType em table/metricTable/usecase/page/pluginConnection/workflow) = artefatos modulares que o workflow pode exigir alterar (blast radius).
- Schema (tool), `PlanWorkflowDefinitionResult`, normalizers e validacao atualizados; novos helpers `normalizeWorkflowScope`, `normalizePageRefByModule`, `normalizeEntityRefByModule`, `normalizeWritesArtifact`.
- Validacao de coerencia: `workflowScope=singleModule` exige <=1 modulo em `moduleRefs`; `multiModule`/`multiModuleExternal` exigem >=2.
- Prompt atualizado com secao "Module-impact metadata" instruindo como classificar escopo e preencher os refs por modulo.
- Persistencia: como o workflow e salvo como artefato `workflow` com `data={ workflowDefinition, defsPlan }` (TODO-FINAL-011/014), a metadata vai automaticamente para `l4/workflows/{workflowId}.defs.ts` e para o trace — sem mudanca no writer.
- Decisao mantida: workflows continuam globais em `l4/workflows` (nao movidos para dentro de modulo).
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base.

### TODO-FINAL-028 - Surfacar erro de payload `type:"result"` no status, titulo e mensagem da task

Problema:
- Quando um agente do planejamento retorna um payload `type:"result"` (erro de negocio, nao um plano), por exemplo o root `agentNewSolution` recusando um nome de modulo ja existente:
```
[
  {
    "type": "result",
    "result": "The module \"barbershopProUsa\" already exists. Please choose a different module name.",
    "status": "completed",
    "stepId": 27,
    "interaction": null,
    "nextSteps": null
  }
]
```
- Hoje o `afterPromptStep` do `agentNewSolution` detecta `payload.type === 'result'` e marca o step como `failed`, MAS nao propaga a string de erro: o `createUpdateStatusIntent` e chamado sem `traceMsg`. Resultado: a task falha, porem a explicacao so aparece ao inspecionar o payload manualmente (foi assim que o erro foi descoberto). Nao fica no titulo da task nem na mensagem da task.
- Isso vale potencialmente para qualquer agente cujo contrato permita retornar `type:"result"` como erro de negocio.

Esperado:
- Status do step/task = `failed` (ja ocorre).
- O texto do erro (`payload.result`) deve aparecer:
  - no `traceMsg` do step,
  - no titulo da task (ou em campo visivel equivalente),
  - na mensagem que carrega a task (explicacao do erro para o usuario), sem precisar abrir o payload.

Acao (provavelmente em dois pontos):
- Agente (`agentNewSolution.afterPromptStep`, e revisar outros agentes que aceitam `type:"result"`): ao detectar `payload.type === 'result'`, passar `payload.result` como `traceMsg` no `update-status` `failed`; avaliar tambem setar titulo/`last_update_log` da task com a mensagem de erro.
- Backend `collab-messages` (`updateStepStatus`/`updateTaskDetails`): garantir que, em falha, a `traceMsg`/motivo seja persistida e enviada na atualizacao da mensagem da task (`taskTitle`/conteudo), nao apenas o status.
- Frontend `mls-102025` (collab-messages): renderizar o motivo da falha (traceMsg/result) no titulo/cartao da task e na mensagem, de forma visivel ao usuario.

Decisao em aberto:
- Para o caso especifico de nome de modulo, hoje `reserveModuleNameFromFolders` ja auto-incrementa para um nome livre; avaliar se o root deveria auto-resolver (renomear) em vez de retornar erro, OU manter o erro mas surfaca-lo bem. Esta TODO trata do surfacing generico de `type:"result"`; a politica de auto-rename do nome de modulo pode ser uma sub-decisao.

Criterio de aceite:
- Um run que recebe `type:"result"` (ex.: "module already exists") mostra status `failed` E o texto do erro no titulo da task e na mensagem da task, sem necessidade de abrir o payload.
- Comportamento consistente para qualquer agente que possa retornar `type:"result"` como erro.

**EXECUTED (run 2026-06-08 - cafeFlow)**:
- Sintoma: no passo 1 (`agentNewSolution`), com payload da LLM valido (`type:"flexible"`), a task ficava `failed` sem explicar o motivo; o step ficava `waiting_after_prompt`.
- Causa raiz (diagnostico de codigo):
  1. O step raiz `agentNewSolution` nao tem step-pai que resolva em `getStepById`. Quando o `afterPromptStep` lancava (unica I/O sem try/catch: `reserveNewSolutionModuleArtifacts`), `aiAgentOrchestration.getHookFailureIntents` montava o `update-status failed` com `traceMsg`, MAS so emite quando `step && parentStep` resolvem (linha 313). Para o root, `parentStep` e null -> intent descartado -> step preso em `waiting_after_prompt`, motivo perdido.
  2. `agentNewSolution.createUpdateStatusIntent` usava `parentStep.stepId` (NPE para o root) e nunca passava `traceMsg` (o caminho `type:"result"` falhava sem motivo).
  3. Backend `updateStepStatus` (collab-messages) nunca passava `traceMsg` para `updateTaskDetails` -> a mensagem/titulo da task nao carregava o motivo.
  4. Frontend `collabMessagesChatMessage.renderMessageResultByLanguage` so renderizava `taskResults` quando `taskStatus === 'done'` -> falhas nunca exibiam o motivo.
- Mudancas (escopo: agente + surfacing TODO-FINAL-028):
  - `agentNewSolution.afterPromptStep`: corpo inteiro envolvido em try/catch; qualquer falha (inclusive `type:"result"`) retorna `update-status failed` com `traceMsg` = motivo real, auto-direcionado ao proprio step.
  - `agentNewSolution.createUpdateStatusIntent`: novo parametro `traceMsg`; `parentStepId` agora cai para `step.stepId` quando `parentStep` e null (self-parent; o root e um step `agent`, aceito por `intentUpdateStatus`).
  - `collab-messages/tasks.ts.updateStepStatus`: nos dois ramos de falha (`newTaskStatus==='failed'` e `status==='failed'`), o `traceMsg` agora vai para `last_update_log` e para `updateTaskDetails({ taskResults: [traceMsg] })`.
  - `mls-102025/collabMessagesChatMessage.ts`: `renderMessageResultByLanguage` renderiza o motivo tambem para `taskStatus === 'failed'` (classe `.task-failed`); estilo minimo no `.less`.
- Builds: `tsc -p tsconfig.frontend.json` (mls-base) sem erros novos (erro pre-existente em `agentMaterializeSolution/agentMaterializePage.ts`, fora de escopo); `tsc --build` (collab-messages) ok.
- Observacao: a causa concreta do throw original (provavelmente a escrita stor de `reserveNewSolutionModuleArtifacts`) agora aparece como `traceMsg` na mensagem da task, permitindo diagnostico no Studio sem abrir o payload.

### TODO-FINAL-001 - Encerrar a task de planejamento sem materializar (DONE)

**Evidence** (from this final.md and code inspection):
- Diagnostico run30: root `agentNewSolution` step 1 em `waiting_after_prompt`, `org-materialization` waiting_dependency, 1 orphan frontend pooling hook on completed `agentPlanPageIndex` (step 23), mesmo apos validate completed.
- No code: root status nunca atualizado no seu afterPromptStep (apenas spawna os org-* e retorna add-steps).
- Materialization ja esta como 'manual_later' no buildPlannedTree.
- Orphan hooks sao mencionados em queueFrontEnd de iaCompressed (similar ao padrao antigo em requirements).

**Change made** (minimal, evidence-based):
- Em `agentValidateSolutionCoverage.ts` (afterPromptStep):
  - Adicionado import `getAgentStepByAgentName`.
  - Quando status === 'completed' do validate, envia adicional update-status para completar o root `agentNewSolution` step.
  - traceMsg registra "plan-only" e que materializacao fica pendente.
  - Nao mexe em materialization step (permanece manual_later).
  - Nao usa mls.api direto (evita bug_arq_1).
  - Cleaner ja estava presente no update do validate.

**No side effects**:
- Materializacao continua manual (nao e liberada).
- Outros fluxos (se materializacao for trigger manual) nao impactados.
- Apenas adiciona update de status no final do planejamento.
- Atualizacao deste arquivo com secao Executed.

Proxima task: TODO-FINAL-006 (quando solicitado).

### TODO-FINAL-022 - Integrar save incremental com execucao paralela

Problema:
- Com paralelismo, varios steps podem tentar salvar arquivos ao mesmo tempo.
- O writer precisa ser seguro contra concorrencia e retry.
Resposta: Como o afterPrompt é executado do lado cliente após receber uma intenção , não terá problemas de concorrencia.

Acao:
- Salvar cada artefato em caminho unico derivado do selector.
- Usar escrita atomica quando possivel: gerar conteudo, escrever temporario, trocar pelo final.
- Atualizar manifesto/checkpoint de forma idempotente.
- Ao concluir save de um child, limpar payload grande daquele child e manter apenas referencia/hash.
- Se um child falhar, preservar payload/trace desse child para debug e nao limpar.

Criterio de aceite:
- Execucao paralela nao corrompe arquivos `.defs.ts` nem manifesto.
- Reexecutar um item sobrescreve apenas seu proprio artefato.
- Task fica menor conforme os itens paralelos terminam.

**EXECUTED** (2026-06-06):
- Cada artefato usa caminho unico derivado de tipo + selector/id.
- O save e idempotente: reexecutar o mesmo item sobrescreve o mesmo arquivo.
- O manifesto e atualizado por chave `artifactType + artifactId + filePath`, evitando duplicatas em retry.
- Cada entrada do manifesto registra checksum, stepId, planId, agentName, schemaVersion e status.
- Nao foi implementado rename atomico porque a API `stor` atual expõe create/overwrite, nao temp+rename; no runtime atual o afterPrompt client-side e serializado, entao o risco pratico de concorrencia e baixo.
- Se um child falhar, o writer nao grava draft e o payload/trace ficam preservados.

## Ordem recomendada

1. Corrigir encerramento da task e hook orfao: `TODO-FINAL-001` (feito).
2. Corrigir gate de coverage: `TODO-FINAL-002` (feito).
3. Resolver os 3 erros reais da coverage: `TODO-FINAL-003`, `TODO-FINAL-004`, `TODO-FINAL-005` (feito).
4. Implementar gravacao incremental plan-only e limpeza por arquivo salvo: `TODO-FINAL-010` (safe-part), `TODO-FINAL-011`, `TODO-FINAL-012`, `TODO-FINAL-014`, `TODO-FINAL-022` (feito).
5. Converter grupos independentes para paralelo controlado: `TODO-FINAL-021` (feito).
6. Criar checkpoints de validacao incremental e critica/reparo por indice antes das definitions: `TODO-FINAL-023`, `TODO-FINAL-024` (feito; falta follow-up de limpeza de payload por referencia).
7. Corrigir reuso de plugin global antes de criar draft novo: `TODO-FINAL-025` (feito; reuso por brand no pluginPlan, tela de materializacao fora de escopo).
8. Adotar strict tool mode nos agentes compativeis: `TODO-FINAL-026` (feito; finalize/blueprint/coverage/pageDefinition fora do strict por schema com mapa dinamico/objeto livre).
9. Reduzir tokens nos maiores consumidores: `TODO-FINAL-006`, `TODO-FINAL-007`, `TODO-FINAL-008`, `TODO-FINAL-009` (feito).
10. Completar mapeamento/metadata de artefatos plan, incluindo workflow global com refs de modulo: `TODO-FINAL-013` (obsoleto, coberto pelo writer/014), `TODO-FINAL-015` (feito), `TODO-FINAL-016` (feito/ja cumprido), `TODO-FINAL-027` (feito).
11. Criar testes e politica de trace: `TODO-FINAL-017`, `TODO-FINAL-018` (feito — flag `_saveTrace` na memoria da task).
12. Consolidar regras transversais: `TODO-FINAL-019` (feito), `TODO-FINAL-020` (feito).
13. Manter a task leve (teto ~400KB): `TODO-FINAL-030` — R1 (reduzir inputs dos 4 indices) + R2 + R7 (telemetria) feitos; critic aprovador limpo (input_output). R3-R6 (limpeza de payload via fallback async por checkpoint) deferidos: so se a telemetria mostrar CRITICAL.

Resposta: um exemplo de módule dentro do <module>/l2, pode ser achada em /Volumes/WagnerSSD1/collab/mls-base/mls-102020/l2/agents/newSolution/run30/module.ts
