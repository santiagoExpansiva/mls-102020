/// <mls fileReference="_102020_/l2/newModule/widgetModuleDashboard.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, TemplateResult, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { getThreadByName } from '/_102025_/l2/collabMessagesIndexedDB.js';
import { createThread, getTemporaryContext, getUserId } from '/_102025_/l2/collabMessagesHelper.js';
import { executeBeforePrompt, loadAgent } from '/_102027_/l2/aiAgentOrchestration.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MlsFile {
    project: number;
    shortName: string;
    extension: string;
    folder: string;
    getContent: () => Promise<string>;
}

interface MaterializeStep {
    id: string;
    agent: string;
}

type PageStatus = 'draft' | 'materialized' | 'unknown';

interface PageInfo {
    key: string;
    shortName: string;
    folder: string;
    moduleName: string;
    pageName: string;
    status: PageStatus;
    steps: MaterializeStep[];
    fileRef: string;
}

interface ModuleGroup {
    moduleName: string;
    folder: string;
    pages: PageInfo[];
}

declare const mls: {
    actualProject: number;
    stor: {
        files: Record<string, MlsFile>;
        convertFileToFileReference: (f: MlsFile) => string;
    };
    events: {
        fire: (a: number[], b: string[], c: string) => void;
    };
};

declare const window: Window & { mls: typeof mls };

const THREAD_NAME = '_102020_/l2/newModule/widgetModuleDashboard.ts';

const STEP_LABELS: Record<string, string> = {
    contract: 'Contract',
    shared: 'Shared',
    desktop: 'Page',
};

// ─── Component ───────────────────────────────────────────────────────────────

@customElement('new-module--widget-module-dashboard-102020')
export class WidgetModuleDashboard102020 extends StateLitElement {

    @state() private _loading = true;
    @state() private _modules: ModuleGroup[] = [];
    @state() private _running: Set<string> = new Set();
    @state() private _error: string | null = null;

    override async connectedCallback(): Promise<void> {
        super.connectedCallback();
        await this._scan();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    override render(): TemplateResult {
        if (this._loading) return html`<div class="state-box">Varrendo módulos...</div>`;
        if (this._error) return html`<div class="state-box error">Erro: ${this._error}</div>`;
        if (this._modules.length === 0) return html`<div class="state-box">Nenhum módulo encontrado no projeto atual.</div>`;
        return html`
            <div class="md-root">
                <header class="md-header">
                    <span class="md-title">⚙ Module Dashboard</span>
                    <button class="md-refresh" title="Re-escanear" @click=${this._scan}>↺</button>
                </header>
                ${this._modules.map(m => this._renderModule(m))}
            </div>
        `;
    }

    private _renderModule(mod: ModuleGroup): TemplateResult {
        const total = mod.pages.length;
        const done = mod.pages.filter(p => p.status === 'materialized').length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return html`
            <section class="md-module">
                <div class="md-module-head">
                    <span class="md-module-name">${mod.moduleName}</span>
                    <span class="md-pct">${done}/${total} &nbsp;${pct}%</span>
                </div>
                <div class="md-progress">
                    <div class="md-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="md-pages">
                    ${mod.pages.map(p => this._renderPage(p))}
                </div>
            </section>
        `;
    }

    private _renderPage(page: PageInfo): TemplateResult {
        const busy = this._running.has(page.key);
        if (page.status === 'materialized') return this._renderMaterializedPage(page, busy);
        return this._renderDraftPage(page, busy);
    }

    private _renderDraftPage(page: PageInfo, busy: boolean): TemplateResult {
        const badgeClass = page.status === 'unknown' ? 'md-badge--unknown' : 'md-badge--draft';
        const badgeLabel = page.status === 'unknown' ? 'desconhecido' : 'draft';
        const pageClass = page.status === 'unknown' ? 'unknown' : 'draft';
        return html`
            <div class="md-page md-page--${pageClass}">
                <div class="md-page-top">
                    <span class="md-page-name">${page.pageName}</span>
                    <span class="md-badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div class="md-page-actions">
                    <button
                        class="md-btn md-btn--primary"
                        ?disabled=${busy}
                        @click=${() => this._generateAll(page)}
                        title="Gera contract + shared + page via agentToBePage"
                    >${busy ? 'Gerando...' : 'Gerar tudo'}</button>
                </div>
            </div>
        `;
    }

    private _renderMaterializedPage(page: PageInfo, busy: boolean): TemplateResult {
        return html`
            <div class="md-page md-page--done">
                <div class="md-page-top">
                    <span class="md-page-name">${page.pageName}</span>
                    <span class="md-badge md-badge--done">gerado</span>
                </div>
                <div class="md-page-actions">
                    <button
                        class="md-btn md-btn--secondary"
                        ?disabled=${busy}
                        @click=${() => this._generateAll(page)}
                        title="Regenerar tudo via agentToBePage"
                    >${busy ? '...' : 'Gerar tudo'}</button>
                    ${page.steps.map(step => html`
                        <button
                            class="md-btn md-btn--step"
                            ?disabled=${busy}
                            @click=${() => this._generateStep(page, step)}
                            title="Rodar apenas ${STEP_LABELS[step.id] ?? step.id} (${step.agent})"
                        >${busy ? '...' : (STEP_LABELS[step.id] ?? step.id)}</button>
                    `)}
                </div>
            </div>
        `;
    }

    // ── Scan ──────────────────────────────────────────────────────────────────

    private async _scan(): Promise<void> {
        this._loading = true;
        this._error = null;

        try {
            const files = mls.stor.files;
            const project = mls.actualProject;

            const moduleKeys = Object.keys(files).filter(k => {
                const f = files[k];
                return f.project === project && f.shortName === 'module' && f.extension === '.defs.ts';
            });

            if (moduleKeys.length === 0) {
                this._modules = [];
                return;
            }

            const groups: ModuleGroup[] = [];

            for (const moduleKey of moduleKeys) {
                const mf = files[moduleKey];
                const folder = mf.folder;
                const moduleName = folder.split('/').pop() || folder;

                const pageKeys = Object.keys(files).filter(k => {
                    const f = files[k];
                    return (
                        f.project === project &&
                        f.folder === folder &&
                        f.extension === '.defs.ts' &&
                        f.shortName !== 'module' && f.shortName !== "index"
                    );
                });

                const pages: PageInfo[] = await Promise.all(
                    pageKeys.map(async (key): Promise<PageInfo> => {
                        const f = files[key];
                        const pageName = f.shortName;
                        const fileRef = mls.stor.convertFileToFileReference(f);
                        let status: PageStatus = 'draft';
                        let steps: MaterializeStep[] = [];

                        try {
                            const raw = await f.getContent();
                            if (/export\s+const\s+materializeIndex/.test(raw)) {
                                status = 'materialized';
                                steps = this._parseSteps(raw);
                            } else if (!/export\s+const\s+definition/.test(raw)) {
                                status = 'unknown';
                            }
                        } catch {
                            status = 'unknown';
                        }

                        return { key, shortName: f.shortName, folder, moduleName, pageName, status, steps, fileRef };
                    })
                );

                pages.sort((a, b) => a.pageName.localeCompare(b.pageName));
                groups.push({ moduleName, folder, pages });
            }

            this._modules = groups;
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
        } finally {
            this._loading = false;
        }
    }

    private _parseSteps(raw: string): MaterializeStep[] {
        try {
            const idxStart = raw.indexOf('materializeIndex');
            if (idxStart === -1) return this._defaultSteps();

            const arrStart = raw.indexOf('[', idxStart);
            if (arrStart === -1) return this._defaultSteps();

            let depth = 0;
            let arrEnd = -1;
            for (let i = arrStart; i < raw.length; i++) {
                if (raw[i] === '[') depth++;
                else if (raw[i] === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
            }
            if (arrEnd === -1) return this._defaultSteps();

            let json = raw.slice(arrStart, arrEnd + 1)
                .replace(/\/\/[^\n]*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*):/g, '$1"$2"$3:');

            const arr = JSON.parse(json) as { id: string; agent: string }[];
            return arr.map(e => ({ id: e.id, agent: e.agent }));
        } catch {
            return this._defaultSteps();
        }
    }

    private _defaultSteps(): MaterializeStep[] {
        return [
            { id: 'contract', agent: 'agentMaterializeContract' },
            { id: 'shared', agent: 'agentMaterializeSharedPage' },
            { id: 'desktop', agent: 'agentMaterializePageLit' },
        ];
    }

    // ── Agent dispatch ────────────────────────────────────────────────────────

    private async _getThread() {
        let thread = await getThreadByName(THREAD_NAME);
        if (!thread) thread = await createThread(THREAD_NAME, [], 'company');
        return thread;
    }

    private async _generateAll(page: PageInfo): Promise<void> {
        if (this._running.has(page.key)) return;
        this._running = new Set([...this._running, page.key]);

        try {
            const thread = await this._getThread();
            if (!thread) return;

            const userId = getUserId();
            if (!userId) return;

            const agent = await loadAgent('agentToBePage');
            if (!agent) throw new Error('agentToBePage não encontrado');

            const msg = JSON.stringify({ page: page.fileRef, moduleName: page.moduleName, device: 'web', type: 'page11' });
            executeBeforePrompt(agent, getTemporaryContext(thread.threadId, userId, msg));

            setTimeout(() => {
                window.mls.events.fire([2], ['collabMessages'] as any, JSON.stringify({ type: 'thread-open', threadId: thread!.threadId, taskId: '' }));
            }, 500);
        } finally {
            const next = new Set(this._running);
            next.delete(page.key);
            this._running = next;
        }
    }

    private async _generateStep(page: PageInfo, step: MaterializeStep): Promise<void> {
        if (this._running.has(page.key)) return;
        this._running = new Set([...this._running, page.key]);

        try {
            const thread = await this._getThread();
            if (!thread) return;

            const userId = getUserId();
            if (!userId) return;

            const agent = await loadAgent(step.agent);
            if (!agent) throw new Error(`Agente ${step.agent} não encontrado`);

            const msg = JSON.stringify({ path: page.fileRef, id: step.id, moduleName: page.moduleName, device: 'web', type: 'page11' });
            console.info(msg);
            executeBeforePrompt(agent, getTemporaryContext(thread.threadId, userId, msg));

            setTimeout(() => {
                window.mls.events.fire([2], ['collabMessages'] as any, JSON.stringify({ type: 'thread-open', threadId: thread!.threadId, taskId: '' }));
            }, 500);
        } finally {
            const next = new Set(this._running);
            next.delete(page.key);
            this._running = next;
        }
    }

}
