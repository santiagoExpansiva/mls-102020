/// <mls fileReference="_102020_/l2/agentNewSolution/widgetNewSolutionResume.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { getAllSteps } from '/_102027_/l2/aiAgentHelper.js';
import { createThread, getTemporaryContext, getUserId } from '/_102025_/l2/collabMessagesHelper.js';
import { executeBeforePrompt, loadAgent, continuePoolingTask } from '/_102027_/l2/aiAgentOrchestration.js';
import {
  readNewSolutionProcess,
  writeNewSolutionProcessRun,
  deleteNewSolutionTraceFolder,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import type {
  NewSolutionProcessRun,
  NewSolutionProcessNextStep,
  NewSolutionProcessNextStepKind,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';

// Target agent (mention) used to open the task for each next-step kind. Blank by default — to be
// filled once the corresponding agents exist. Example: NEXT_STEP_AGENTS.horizontalModule =
// '@@agentImproveModule'. When blank, the task is opened with just the descriptive prompt.
const NEXT_STEP_AGENTS: Record<NewSolutionProcessNextStepKind, string> = {
  horizontalModule: '',
  plugin: '',
  materialize: '',
};

// Texts longer than this (in bytes) are collapsed behind a "see more" toggle.
const SEE_MORE_BYTES = 100;

interface ResumeValue {
  taskId: string;
  moduleId: string;
  stepId: number;
  parentStepId: number;
  hookSequential: number;
  senderId: string;
  threadId: string;
  messageId: string;
}

interface HealthSummary {
  passed?: boolean;
  errorCount?: number;
  warningCount?: number;
}

interface HealthIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path: string;
}

interface HealthReport {
  summary?: HealthSummary;
  issues?: HealthIssue[];
  readyToSaveDefs?: boolean;
}

/// **collab_i18n_start**
const message_en = {
  title: 'Final planning summary',
  prompt: 'Initial prompt',
  decisions: 'Decisions',
  openDetails: 'Open details',
  health: 'Health report',
  nextSteps: 'Next steps',
  seeMore: 'see more',
  seeLess: 'see less',
  none: 'Nothing here.',
  passed: 'Passed',
  failed: 'Has issues',
  errors: 'errors',
  warnings: 'warnings',
  readyToSave: 'Ready to save defs',
  notReady: 'Not ready to save defs',
  clearTraces: 'Clear traces (delete this run\'s trace files)',
  finish: 'Finish',
  finishing: 'Finishing…',
  finished: 'Finished. You can close this screen.',
  loading: 'Loading…',
  noRun: 'No process run found for this module yet.',
  taskOpened: 'task opened',
};
const message_ptbr: typeof message_en = {
  title: 'Resumo final do planejamento',
  prompt: 'Prompt inicial',
  decisions: 'Decisões',
  openDetails: 'Pontos em aberto',
  health: 'Relatório de saúde',
  nextSteps: 'Próximos passos',
  seeMore: 'ver mais',
  seeLess: 'ver menos',
  none: 'Nada por aqui.',
  passed: 'Aprovado',
  failed: 'Com pendências',
  errors: 'erros',
  warnings: 'avisos',
  readyToSave: 'Pronto para salvar defs',
  notReady: 'Ainda não pronto para salvar defs',
  clearTraces: 'Limpar traces (apagar os arquivos de trace desta execução)',
  finish: 'Encerrar',
  finishing: 'Encerrando…',
  finished: 'Encerrado. Você já pode fechar esta tela.',
  loading: 'Carregando…',
  noRun: 'Nenhuma execução de processo encontrada para este módulo ainda.',
  taskOpened: 'task aberta',
};
const messages: Record<string, typeof message_en> = { en: message_en, 'pt-br': message_ptbr };
/// **collab_i18n_end**

@customElement('widget-new-solution-resume-102020')
export class WidgetNewSolutionResume102020 extends StateLitElement {

  @property({ type: Object }) value: ResumeValue | null = null;

  @state() private _loading = true;
  @state() private _run: NewSolutionProcessRun | null = null;
  @state() private _health: HealthReport | null = null;
  @state() private _clearTraces = true;
  @state() private _selected: Set<string> = new Set();
  @state() private _promptExpanded = false;
  @state() private _finishing = false;
  @state() private _finished = false;
  @state() private _error: string | null = null;

  private _loadedFor: string | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._load();
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    if (changed.has('value') && this.value && this.value.moduleId !== this._loadedFor) {
      void this._load();
    }
  }

  private get _msg(): typeof message_en {
    const lang = (this._run?.userLanguage || document.documentElement.lang || 'en').toLowerCase();
    return lang.startsWith('pt') ? messages['pt-br'] : messages.en;
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  private async _load(): Promise<void> {
    if (!this.value) return;
    this._loadedFor = this.value.moduleId;
    this._loading = true;
    this._error = null;
    try {
      const process = await readNewSolutionProcess(this.value.moduleId);
      const run = process?.runs?.length
        ? (process.runs.find(r => r.runId === 'newSolution') || process.runs[process.runs.length - 1])
        : null;
      this._run = run;
      this._health = (run?.healthReport as HealthReport) || (await this._readHealthFallback());
      // Default: all still-pending next steps are selected.
      this._selected = new Set((run?.nextSteps || []).filter(s => s.status !== 'dismissed').map(s => s.id));
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
    }
  }

  private async _readHealthFallback(): Promise<HealthReport | null> {
    try {
      if (!this.value) return null;
      const fileInfo = {
        project: mls.actualProject || 0,
        level: 2,
        folder: `${this.value.moduleId}/trace`,
        shortName: 'plan-health-report',
        extension: '.json',
      };
      const file = mls.stor.files[mls.stor.getKeyToFile(fileInfo)];
      if (!file) return null;
      const raw = await file.getContent();
      if (typeof raw !== 'string') return null;
      const doc = JSON.parse(raw);
      return (doc?.report as HealthReport) || null;
    } catch {
      return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  override render(): TemplateResult {
    const m = this._msg;
    if (this._loading) return html`<div class="ns-resume"><div class="ns-state">${m.loading}</div></div>`;
    if (this._error) return html`<div class="ns-resume"><div class="ns-state ns-error">${this._error}</div></div>`;
    if (!this._run) return html`<div class="ns-resume"><div class="ns-state">${m.noRun}</div></div>`;

    return html`
      <div class="ns-resume">
        <h3 class="ns-title">${m.title}</h3>
        ${this._renderPrompt()}
        ${this._renderDecisions()}
        ${this._renderOpenDetails()}
        ${this._renderHealth()}
        ${this._renderNextSteps()}
        ${this._renderActions()}
      </div>
    `;
  }

  private _section(title: string, body: TemplateResult, open = false): TemplateResult {
    return html`
      <details class="ns-section" ?open=${open}>
        <summary class="ns-section-head">${title}</summary>
        <div class="ns-section-body">${body}</div>
      </details>
    `;
  }

  private _renderPrompt(): TemplateResult {
    const m = this._msg;
    const text = this._run?.initialPrompt || '';
    const isLong = new TextEncoder().encode(text).length > SEE_MORE_BYTES;
    const shown = isLong && !this._promptExpanded ? `${text.slice(0, SEE_MORE_BYTES)}…` : text;
    const body = html`
      <p class="ns-prompt">${shown || m.none}</p>
      ${isLong ? html`
        <button class="ns-link" @click=${() => { this._promptExpanded = !this._promptExpanded; }}>
          ${this._promptExpanded ? m.seeLess : m.seeMore}
        </button>` : nothing}
    `;
    return this._section(m.prompt, body, true);
  }

  private _renderDecisions(): TemplateResult {
    const m = this._msg;
    const decisions = (this._run?.decisions || []) as Record<string, unknown>[];
    const body = decisions.length === 0
      ? html`<p class="ns-muted">${m.none}</p>`
      : html`<ul class="ns-list">${decisions.map(d => html`<li>${this._decisionLabel(d)}</li>`)}</ul>`;
    return this._section(`${m.decisions} (${decisions.length})`, body);
  }

  private _decisionLabel(d: Record<string, unknown>): string {
    if (typeof d === 'string') return d;
    const title = typeof d.title === 'string' ? d.title : '';
    const decided = typeof d.decidedPriority === 'string' ? ` — ${d.decidedPriority}` : '';
    return title ? `${title}${decided}` : JSON.stringify(d);
  }

  private _renderOpenDetails(): TemplateResult {
    const m = this._msg;
    const items = this._run?.openDetails || [];
    const body = items.length === 0
      ? html`<p class="ns-muted">${m.none}</p>`
      : html`<ul class="ns-list">${items.map(i => html`
          <li><strong>${i.title}</strong>${i.description ? html`: ${i.description}` : nothing}</li>`)}</ul>`;
    return this._section(`${m.openDetails} (${items.length})`, body);
  }

  private _renderHealth(): TemplateResult {
    const m = this._msg;
    const h = this._health;
    if (!h) return this._section(m.health, html`<p class="ns-muted">${m.none}</p>`);
    const summary = h.summary || {};
    const issues = h.issues || [];
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const passed = !!summary.passed;
    const body = html`
      <div class="ns-health-head">
        <span class="ns-badge ${passed ? 'ns-badge--ok' : 'ns-badge--bad'}">${passed ? m.passed : m.failed}</span>
        <span class="ns-counts">${summary.errorCount ?? errors.length} ${m.errors} · ${summary.warningCount ?? warnings.length} ${m.warnings}</span>
        <span class="ns-ready ${h.readyToSaveDefs ? 'ns-ready--ok' : 'ns-ready--no'}">${h.readyToSaveDefs ? m.readyToSave : m.notReady}</span>
      </div>
      ${this._renderIssues(errors, 'error')}
      ${this._renderIssues(warnings, 'warning')}
    `;
    return this._section(m.health, body, !passed);
  }

  private _renderIssues(issues: HealthIssue[], severity: 'error' | 'warning'): TemplateResult {
    if (issues.length === 0) return html``;
    return html`
      <ul class="ns-issues ns-issues--${severity}">
        ${issues.map(i => html`
          <li>
            <span class="ns-issue-code">${i.code}</span>
            <span class="ns-issue-msg">${i.message}</span>
            ${i.path ? html`<span class="ns-issue-path">${i.path}</span>` : nothing}
          </li>`)}
      </ul>
    `;
  }

  private _renderNextSteps(): TemplateResult {
    const m = this._msg;
    const steps = this._run?.nextSteps || [];
    const body = steps.length === 0
      ? html`<p class="ns-muted">${m.none}</p>`
      : html`<ul class="ns-next">${steps.map(s => this._renderNextStep(s))}</ul>`;
    return this._section(`${m.nextSteps} (${steps.length})`, body, steps.length > 0);
  }

  private _renderNextStep(step: NewSolutionProcessNextStep): TemplateResult {
    const m = this._msg;
    const mention = NEXT_STEP_AGENTS[step.kind] || '';
    const checked = this._selected.has(step.id);
    const opened = step.status === 'taskOpened';
    return html`
      <li class="ns-next-item ${opened ? 'ns-next-item--opened' : ''}">
        <label>
          <input
            type="checkbox"
            ?checked=${checked}
            ?disabled=${this._finishing || this._finished || opened}
            @change=${(e: Event) => this._toggleStep(step.id, (e.target as HTMLInputElement).checked)}
          />
          <span class="ns-next-kind">${step.kind}</span>
          <span class="ns-next-title">${step.title}</span>
        </label>
        ${step.description ? html`<div class="ns-next-desc">${step.description}</div>` : nothing}
        <div class="ns-next-agent">${mention ? `${mention} …` : '@@… '}</div>
        ${opened ? html`<span class="ns-next-opened">${m.taskOpened}${step.taskId ? `: ${step.taskId}` : ''}</span>` : nothing}
      </li>
    `;
  }

  private _renderActions(): TemplateResult {
    const m = this._msg;
    if (this._finished) return html`<div class="ns-done">${m.finished}</div>`;
    return html`
      <div class="ns-actions">
        <label class="ns-clear">
          <input
            type="checkbox"
            ?checked=${this._clearTraces}
            ?disabled=${this._finishing}
            @change=${(e: Event) => { this._clearTraces = (e.target as HTMLInputElement).checked; }}
          />
          ${m.clearTraces}
        </label>
        <button class="ns-finish" ?disabled=${this._finishing} @click=${() => this._onFinish()}>
          ${this._finishing ? m.finishing : m.finish}
        </button>
      </div>
    `;
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  private _toggleStep(id: string, checked: boolean): void {
    const next = new Set(this._selected);
    if (checked) next.add(id); else next.delete(id);
    this._selected = next;
  }

  private async _onFinish(): Promise<void> {
    if (!this.value || !this._run || this._finishing) return;
    this._finishing = true;
    try {
      const run = this._run;
      const moduleId = this.value.moduleId;

      // 1. Open a task for each selected next step; mark the rest dismissed. (Permanent record.)
      for (const step of run.nextSteps) {
        if (step.status === 'taskOpened') continue;
        if (this._selected.has(step.id)) {
          const taskId = await this._openNextStepTask(step);
          step.status = 'taskOpened';
          if (taskId) step.taskId = taskId;
        } else {
          step.status = 'dismissed';
        }
      }
      run.finishedAt = new Date().toISOString();
      await writeNewSolutionProcessRun(moduleId, run);

      // 2. Clear traces (after permanent files are written). Default deletes l2/{module}/trace/*.
      if (this._clearTraces) {
        await deleteNewSolutionTraceFolder(moduleId);
      }

      // 3. Complete the "Dados finais" clarification step (and clean its input/output).
      const ret = await this._completeClarificationStep();

      // 4. Clean leftover step inputs/outputs now that everything permanent is saved.
      if (ret?.task) await this._cleanLeftoverPayloads(ret.task);

      this._finished = true;
      this._run = { ...run };
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._finishing = false;
    }
  }

  private async _openNextStepTask(step: NewSolutionProcessNextStep): Promise<string | undefined> {
    try {
      const mention = NEXT_STEP_AGENTS[step.kind] || '';
      const prompt = `${mention} ${step.title}: ${step.description}`.trim();
      const thread = await createThread(`newSolution:${this.value!.moduleId}:${step.id}`, [], 'company');
      if (!thread) return undefined;
      const userId = getUserId();
      if (!userId) return undefined;

      const context = getTemporaryContext(thread.threadId, userId, prompt);
      const agentName = mention.startsWith('@@') ? mention.slice(2).trim().split(/\s+/)[0] : '';
      if (agentName) {
        const agent = await loadAgent(agentName);
        if (agent) await executeBeforePrompt(agent, context);
      }

      setTimeout(() => {
        (mls as unknown as { events?: { fire?: (a: number[], b: string[], c: string) => void } }).events?.fire?.(
          [2], ['collabMessages'], JSON.stringify({ type: 'thread-open', threadId: thread.threadId, taskId: '' })
        );
      }, 300);

      return thread.threadId;
    } catch (error) {
      console.warn('[widgetNewSolutionResume](openNextStepTask) failed', error);
      return undefined;
    }
  }

  private async _completeClarificationStep(): Promise<mls.msg.ResponseApplyIntents | null> {
    const v = this.value!;
    const intent: mls.msg.AgentIntentUpdateStatus = {
      type: 'update-status',
      hookSequential: v.hookSequential ?? 0,
      messageId: v.messageId,
      threadId: v.threadId,
      taskId: v.taskId,
      parentStepId: v.parentStepId,
      stepId: v.stepId,
      status: 'completed',
      cleaner: 'input_output',
    };
    const response = await mls.api.msgApplyIntents({ userId: v.senderId, intents: [intent] });
    if (!response || response.statusCode !== 200) {
      throw new Error((response as mls.msg.ResponseBase | undefined)?.msg || 'Error finishing resume step');
    }
    const ret = response as mls.msg.ResponseApplyIntents;
    await this._continuePooling(ret);
    return ret;
  }

  // Issue cleaner='input_output' for every completed step that still carries a payload, except the
  // root agentNewSolution step (its flexible payload holds moduleName/prompt, reused on reopen).
  private async _cleanLeftoverPayloads(task: mls.msg.TaskData): Promise<void> {
    try {
      const v = this.value!;
      const tree = task.iaCompressed?.nextSteps || [];
      const parentOf = this._buildParentMap(tree);
      const intents: mls.msg.AgentIntent[] = [];

      for (const step of getAllSteps(tree)) {
        const s = step as mls.msg.AIAgentStep & { agentName?: string };
        if (s.stepId === v.stepId) continue;
        if (s.status !== 'completed') continue;
        if (!s.interaction?.payload) continue;
        if (s.type === 'agent' && s.agentName === 'agentNewSolution') continue;
        const parentStepId = parentOf.get(s.stepId);
        if (parentStepId === undefined) continue;
        intents.push({
          type: 'update-status',
          hookSequential: 0,
          messageId: v.messageId,
          threadId: v.threadId,
          taskId: v.taskId,
          parentStepId,
          stepId: s.stepId,
          status: 'completed',
          cleaner: 'input_output',
        });
      }

      if (intents.length === 0) return;
      await mls.api.msgApplyIntents({ userId: v.senderId, intents });
    } catch (error) {
      console.warn('[widgetNewSolutionResume](cleanLeftoverPayloads) failed', error);
    }
  }

  private _buildParentMap(tree: mls.msg.AIPayload[]): Map<number, number> {
    const map = new Map<number, number>();
    const walk = (nodes: mls.msg.AIPayload[], parentId: number | null) => {
      for (const node of nodes) {
        const id = (node as { stepId: number }).stepId;
        if (parentId !== null) map.set(id, parentId);
        const children = (node as { nextSteps?: mls.msg.AIPayload[] }).nextSteps || [];
        if (children.length) walk(children, id);
      }
    };
    walk(tree, null);
    return map;
  }

  private async _continuePooling(ret: mls.msg.ResponseApplyIntents): Promise<void> {
    try {
      const queue = ret.task?.iaCompressed?.queueFrontEnd || [];
      const hasHook = queue.some(hook => hook.type !== 'pooling');
      if (!hasHook) return;
      const context = { message: ret.message, task: ret.task } as unknown as mls.msg.ExecutionContext;
      await continuePoolingTask(context);
    } catch (error) {
      console.warn('[widgetNewSolutionResume](continuePooling) failed', error);
    }
  }
}
