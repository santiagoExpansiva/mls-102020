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

### TODO-FINAL-007 - Reduzir input do `agentPlanWorkflowDefinition`

Problema:
- `agentPlanWorkflowDefinition` consumiu aproximadamente 90780 tokens em 5 chamadas.

Acao:
- Enviar apenas o workflow selecionado, suas entidades, usecases, regras, metric refs e tabelas relevantes.
- Nao enviar todos os workflows e todas as definicoes de metric tables quando o workflow selecionado nao usa tudo.

Criterio de aceite:
- Cada workflow definition recebe contexto especifico ao workflow selector.

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

### TODO-FINAL-015 - Planejar arquivos de horizontais e MDM

Problema:
- `agentPlanHorizontals` e `agentPlanMDM` geram plano conceitual, mas o destino `.defs.ts` ainda nao esta fechado.

Acao:
- Definir se horizontais (`finance`, `notifications`) geram arquivos em `l2/{horizontal}/...` nesta task ou apenas referencias para modulos existentes.
- Definir se dominios MDM geram `.defs.ts` nesta task ou ficam como referencias/governance no `module.defs.ts`.

Criterio de aceite:
- Flush nao ignora horizontais/MDM nem inventa estrutura fora da arquitetura.

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

### TODO-FINAL-019 - Ajustar contrato de atores sem hard-code

Problema:
- Validadores nao devem depender de nomes como `admin`, `administrator` ou traducoes.

Acao:
- Todos os agentes devem usar apenas `finalPlan.result.actors[].actorId`.
- Validadores devem comparar contra actorIds do plano final.
- Quando um artefato aprovado declarar `actor`, esse valor deve existir em `actors[].actorId`.

Criterio de aceite:
- O fluxo funciona igual em pt-BR, en-US ou qualquer idioma, desde que os actorIds sejam consistentes.

### TODO-FINAL-020 - Revisar consistencia entre plano final e planos especializados

Problema:
- O plano final lista 11 `usecaseEntities`, mas o plano especializado detalhou 1 `usecaseEntity` e varios `usecases`.
- Isso pode estar correto por diferenca de granularidade, mas precisa estar explicito.

Acao:
- Definir a diferenca entre `approvedArtifacts.usecaseEntities`, `usecaseEntities` e `usecases`.
- Ajustar nomes e validators para nao confundir entidade de caso de uso com caso de uso individual.

Criterio de aceite:
- Coverage consegue validar usecases sem falso positivo nem lacuna escondida.

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
- NAO EXECUTADO (follow-up, igual ao safe-part do TODO-FINAL-010): a troca de payload por referencia (`cleaner="input_output"`) ainda nao foi ligada; os getters sincronos continuam lendo da task. O fallback por arquivo ja existe, falta migrar os consumidores.
- Build: `tsc -p tsconfig.frontend.json` ok em mls-base (erros pre-existentes de mls-102030 no backend nao tem relacao).

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

## Executed (one at a time, with evidence, no side effects)

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
7. Corrigir reuso de plugin global antes de criar draft novo: `TODO-FINAL-025`.
8. Adotar strict tool mode nos agentes compativeis: `TODO-FINAL-026`.
9. Reduzir tokens nos maiores consumidores: `TODO-FINAL-006`, `TODO-FINAL-007`, `TODO-FINAL-008`, `TODO-FINAL-009`.
10. Completar mapeamento de artefatos plan: `TODO-FINAL-013`, `TODO-FINAL-015`, `TODO-FINAL-016`.
11. Criar testes e politica de trace: `TODO-FINAL-017`, `TODO-FINAL-018`.
12. Consolidar regras transversais: `TODO-FINAL-019`, `TODO-FINAL-020`.

Resposta: um exemplo de módule dentro do <module>/l2, pode ser achada em /Volumes/WagnerSSD1/collab/mls-base/mls-102020/l2/agents/newSolution/run30/module.ts
