/// <mls fileReference="_102020_/l2/plugins/selectLanguage.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { getConfigProject, updateConfigProject } from '/_102027_/l2/libProjectConfig.js';
import { languages as allLanguages, ICollabLanguage } from '/_102027_/l2/collabLanguages.js';
import { executeBeforePrompt, loadAgent } from '/_102027_/l2/aiAgentOrchestration.js';
import { createThread, getUserId } from '/_102025_/l2/collabMessagesHelper.js';
import { getThreadByName } from '/_102025_/l2/collabMessagesIndexedDB.js';
import { getTemporaryContext } from '/_102027_/l2/aiAgentHelper.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Language',
    desc: 'The language defines the locale used for i18n content generation. Each language produces translated variations of the project pages.',
    needsProject: 'Select a project first to see the available languages.',
    allTitle: 'All Languages',
    allDesc: 'Languages configured for this project.',
    customTitle: 'Add Language',
    customDesc: 'Add a new language to this project.',
    noLanguages: 'No languages configured for this project.',
    noResults: 'No languages match your search.',
    searchPlaceholder: 'Search languages…',
    add: 'Add',
    loading: 'Loading languages…',
    createNew: 'Add Language',
    removeTitle: 'Remove Language',
    removeDesc: 'This language will be permanently removed from the selected project.',
    removeBtn: 'Remove',
    followTask: 'Follow task',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Idioma',
        desc: 'O idioma define o locale usado para geração de conteúdo i18n. Cada idioma produz variações traduzidas das páginas do projeto.',
        needsProject: 'Selecione um projeto primeiro para ver os idiomas disponíveis.',
        allTitle: 'Todos os Idiomas',
        allDesc: 'Idiomas configurados neste projeto.',
        customTitle: 'Adicionar Idioma',
        customDesc: 'Adicione um novo idioma a este projeto.',
        noLanguages: 'Nenhum idioma configurado neste projeto.',
        noResults: 'Nenhum idioma corresponde à sua busca.',
        searchPlaceholder: 'Buscar idiomas…',
        add: 'Adicionar',
        loading: 'Carregando idiomas…',
        createNew: 'Adicionar Idioma',
        removeTitle: 'Remover Idioma',
        removeDesc: 'Este idioma será removido permanentemente do projeto selecionado.',
        removeBtn: 'Remover',
        followTask: 'Acompanhar task',
    },
    es: {
        title: 'Idioma',
        desc: 'El idioma define el locale para la generación de contenido i18n. Cada idioma produce variaciones traducidas de las páginas del proyecto.',
        needsProject: 'Seleccione un proyecto primero para ver los idiomas disponibles.',
        allTitle: 'Todos los Idiomas',
        allDesc: 'Idiomas configurados en este proyecto.',
        customTitle: 'Agregar Idioma',
        customDesc: 'Agregue un nuevo idioma a este proyecto.',
        noLanguages: 'No hay idiomas configurados en este proyecto.',
        noResults: 'Ningún idioma coincide con su búsqueda.',
        searchPlaceholder: 'Buscar idiomas…',
        add: 'Agregar',
        loading: 'Cargando idiomas…',
        createNew: 'Agregar Idioma',
        removeTitle: 'Eliminar Idioma',
        removeDesc: 'Este idioma será eliminado permanentemente del proyecto seleccionado.',
        removeBtn: 'Eliminar',
        followTask: 'Seguir tarea',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IProject {
    project: number;
    name: string;
    doSelect: boolean;
}

type TaskStatus = 'running' | 'done' | 'error';

interface IPendingTask {
    status: TaskStatus;
    startedAt: number;
    message?: string;
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-language-102020')
export class PluginSelectLanguage extends StateLitElement {

    @property({ attribute: false }) selectedProject: IProject | null = null;
    @property({ attribute: false }) value: number | null = null;

    @state() private _languages: string[] = [];
    @state() private _loading: boolean = false;
    @state() private _search: string = '';
    @state() private _addSearch: string = '';
    @state() private _addSelected: string[] = [];
    @state() private _dropdownOpen: boolean = false;
    @state() private _pendingTasks = new Map<string, IPendingTask>();
    @state() config: mls.l5_common.ProjectConfig | undefined;

    private threadCache = new Map<string, Promise<any>>();

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('selectedProject')) {
            this._languages = [];
            this._search = '';
            this._addSearch = '';
            this._addSelected = [];
            if (this.selectedProject) this._loadLanguages(this.selectedProject.project);
        }
        if (changed.has('value')) {
            this._search = '';
            this._addSearch = '';
            this._addSelected = [];
            this._dropdownOpen = false;
        }
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private get _isAll(): boolean { return this.value === 0; }

    private get _isCustom(): boolean {
        return this.value !== null && this.value > this._languages.length;
    }

    private get _selectedLang(): string | null {
        if (this.value === null || this.value <= 0 || this.value > this._languages.length) return null;
        return this._languages[this.value - 1];
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.selectedProject) return this._renderNeedsProject();
        if (this._loading) return this._renderLoading();
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    // ─── Async ───────────────────────────────────────────────────────

    private async _loadLanguages(projectId: number) {
        this._loading = true;
        this.requestUpdate();
        try {
            this.config = await getConfigProject(projectId);
            this._languages = (this.config as any)?.languages?.map((i: any) => i.language) ?? [];
        } catch {
            this._languages = [];
        }
        this._loading = false;
        this._dispatchConfig();
        this.requestUpdate();
    }

    private async _executeRemoveLanguage() {
        const lang = this._selectedLang;
        if (!lang || !this.selectedProject) return;
        const hasRunning = [...this._pendingTasks.values()].some(t => t.status === 'running');
        if (hasRunning) return;

        const langObj = (allLanguages as ICollabLanguage[]).find(l => l.code === lang);
        const taskKey = `remove:${lang}`;
        const prompt = JSON.stringify([{ languages: [{ code: lang, name: langObj?.name ?? lang }], projectId: this.selectedProject.project }]);

        this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { status: 'running', startedAt: Date.now() });
        this.requestUpdate();

        try {
            await this.executeAgent('agentRemoveLanguage', prompt);
            if (this.config && this.selectedProject) {
                const existing: any[] = (this.config as any).languages ?? [];
                const updated = { ...(this.config as any), languages: existing.filter((i: any) => i.language !== lang) };
                await updateConfigProject(this.selectedProject.project, updated);
                this.config = updated as any;
                this._languages = updated.languages.map((i: any) => i.language);
                this._dispatchConfig();
                this._dispatchSelect(0);
            }
            this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { ...this._pendingTasks.get(taskKey)!, status: 'done' });
        } catch (e: any) {
            this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { ...this._pendingTasks.get(taskKey)!, status: 'error', message: e?.message });
        }
        this.requestUpdate();
    }

    private async executeAgent(agentName: string, prompt: string) {
        const fullName = '_102020_/l2/serviceExploreProjects';

        let threadPromise = this.threadCache.get(fullName);
        if (!threadPromise) {
            threadPromise = (async () => {
                let thread = await getThreadByName(fullName);
                if (!thread) thread = await createThread(fullName, [], 'company');
                return thread;
            })();
            this.threadCache.set(fullName, threadPromise);
        }

        const thread = await threadPromise;
        const userId = getUserId();
        if (!userId) return;

        const threadId = thread?.threadId;
        if (!threadId) return;

        const moduleAgent = await loadAgent(agentName);
        if (!moduleAgent) throw new Error('Invalid agent');
        const context = getTemporaryContext(threadId, userId, prompt);
        await executeBeforePrompt(moduleAgent, context);
    }

    private async _executeAddLanguage() {
        if (this._addSelected.length === 0) return;
        const hasRunning = [...this._pendingTasks.values()].some(t => t.status === 'running');
        if (hasRunning) return;

        const langs = [...this._addSelected];
        const taskKey = langs.join('+');
        const langObjs = langs.map(code => {
            const obj = (allLanguages as ICollabLanguage[]).find(l => l.code === code);
            return { code, name: obj?.name ?? code };
        });
        const prompt = JSON.stringify([{ languages: langObjs, projectId: this.selectedProject?.project ?? 0 }]);

        this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { status: 'running', startedAt: Date.now() });
        this._addSelected = [];
        this._addSearch = '';
        this.requestUpdate();

        try {
            await this.executeAgent('agentAddLanguage', prompt);
            if (this.config && this.selectedProject) {
                const existing: any[] = (this.config as any).languages ?? [];
                const newEntries = langs
                    .filter(code => !existing.some((i: any) => i.language === code))
                    .map(code => {
                        const info = (allLanguages as ICollabLanguage[]).find(l => l.code === code);
                        return { language: code, name: info?.name ?? code, path: `/${code}` };
                    });
                const updated = { ...(this.config as any), languages: [...existing, ...newEntries] };
                await updateConfigProject(this.selectedProject.project, updated);
                this.config = updated as any;
                this._languages = updated.languages.map((i: any) => i.language);
                this._dispatchConfig();
            }
            this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { ...this._pendingTasks.get(taskKey)!, status: 'done' });
        } catch (e: any) {
            this._pendingTasks = new Map(this._pendingTasks).set(taskKey, { ...this._pendingTasks.get(taskKey)!, status: 'error', message: e?.message });
        }
        this.requestUpdate();
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderNeedsProject() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, this.msg.desc)}
                ${this._renderNotice(this.msg.needsProject)}
            </div>
        `;
    }

    private _renderLoading() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, this.msg.desc)}
                <span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.loading}</span>
            </div>
        `;
    }

    private _renderSelected() {
        const lang = this._selectedLang!;
        const langObj = (allLanguages as any[]).find(l => l.code === lang);
        const fullName = langObj?.name ?? lang;
        const svg = langObj?.svg ?? '';
        const max = this._languages.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${fullName}
                    .desc=${this.msg.desc}
                    .value=${this.value ?? 0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                <div class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    px-3 py-2.5 flex items-center gap-2
                ">
                    <div class="shrink-0 w-[30px] h-7 overflow-hidden rounded-sm">${unsafeHTML(svg)}</div>
                    <span class="text-sm text-gray-700 dark:text-gray-300">${fullName}</span>
                    <span class="
                        ml-auto text-sm font-mono px-1.5 py-0.5 rounded
                        bg-emerald-100 dark:bg-emerald-900/30
                        text-emerald-600 dark:text-emerald-400
                        font-semibold uppercase tracking-wider
                    ">${lang}</span>
                </div>
                ${(() => {
                    const taskKey = `remove:${lang}`;
                    const removing = this._pendingTasks.get(taskKey)?.status === 'running';
                    const hasRunning = [...this._pendingTasks.values()].some(t => t.status === 'running');
                    return html`
                        <fieldset class="rounded-lg border border-red-200 dark:border-red-800/40 px-3 py-2.5 flex flex-col gap-2">
                            <legend class="text-sm font-medium text-red-500 dark:text-red-400 px-1">${this.msg.removeTitle}</legend>
                            <span class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">${this.msg.removeDesc}</span>
                            <button
                                class="
                                    self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors
                                    ${hasRunning
                                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                        : 'bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer'}
                                "
                                ?disabled=${hasRunning}
                                @click=${() => this._executeRemoveLanguage()}
                            >
                                ${removing ? this._renderSpinner('border-gray-400 dark:border-gray-500') : ''}
                                ${removing ? 'processing…' : this.msg.removeBtn}
                            </button>
                        </fieldset>
                    `;
                })()}
            </div>
        `;
    }

    private _renderAll() {
        const q = this._search.toLowerCase();
        const filtered = this._languages
            .map((lang, i) => ({ lang, selectValue: i + 1 }))
            .filter(({ lang }) => {
                if (!q) return true;
                const name = (allLanguages as ICollabLanguage[]).find(l => l.code === lang)?.name ?? '';
                return lang.toLowerCase().includes(q) || name.toLowerCase().includes(q);
            });

        const max = this._languages.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${this.msg.allTitle}
                    .desc=${this.msg.allDesc}
                    .value=${0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                <button
                    class="
                        self-end text-sm px-2.5 py-1 rounded
                        bg-indigo-500 dark:bg-indigo-600 text-white
                        hover:bg-indigo-600 dark:hover:bg-indigo-500
                        transition-colors whitespace-nowrap
                    "
                    @click=${() => this._dispatchSelect(max)}
                >+ ${this.msg.createNew}</button>

                <input
                    type="text"
                    .value=${this._search}
                    placeholder=${this.msg.searchPlaceholder}
                    class="
                        w-full text-sm px-2.5 py-1.5 rounded-md
                        border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900
                        text-gray-700 dark:text-gray-300
                        placeholder-gray-400 dark:placeholder-gray-600
                        focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600
                    "
                    @input=${(e: Event) => { this._search = (e.target as HTMLInputElement).value; }}
                />

                ${this._languages.length === 0
                    ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noLanguages}</span>`
                    : filtered.length === 0
                        ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ lang, selectValue }) => this._renderLangCard(lang, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        const hasRunning = [...this._pendingTasks.values()].some(t => t.status === 'running');
        const q = this._addSearch.toLowerCase();
        const alreadyAdded = new Set(this._languages);
        const selectedSet = new Set(this._addSelected);
        const filtered = (allLanguages as ICollabLanguage[]).filter(l =>
            !alreadyAdded.has(l.code) &&
            (!q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
        ).slice(0, 80);

        const max = this._languages.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${this.msg.customTitle}
                    .desc=${this.msg.customDesc}
                    .value=${max}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>

                <input
                    type="text"
                    .value=${this._addSearch}
                    placeholder=${this.msg.searchPlaceholder}
                    class="
                        w-full text-sm px-2.5 py-1.5 rounded-md
                        border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900
                        text-gray-700 dark:text-gray-300
                        placeholder-gray-400 dark:placeholder-gray-600
                        focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600
                    "
                    @focus=${() => { this._dropdownOpen = true; }}
                    @blur=${() => { setTimeout(() => { this._dropdownOpen = false; this.requestUpdate(); }, 150); }}
                    @input=${(e: Event) => { this._addSearch = (e.target as HTMLInputElement).value; this._dropdownOpen = true; }}
                />

                ${this._dropdownOpen ? html`
                    <div class="flex flex-col gap-0.5 max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 py-0.5">
                        ${filtered.length === 0
                            ? html`<span class="px-3 py-2 text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                            : filtered.map(l => {
                                const isSelected = selectedSet.has(l.code);
                                return html`
                                    <div
                                        class="
                                            flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors
                                            ${isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                                        "
                                        @mousedown=${(e: Event) => {
                                            e.preventDefault();
                                            this._addSelected = isSelected
                                                ? this._addSelected.filter(c => c !== l.code)
                                                : [...this._addSelected, l.code];
                                            this._dropdownOpen = false;
                                        }}
                                    >
                                        <span class="shrink-0 w-3.5 text-center text-sm text-indigo-500 dark:text-indigo-400">
                                            ${isSelected ? '✓' : ''}
                                        </span>
                                        <div class="shrink-0 w-[30px] h-7 overflow-hidden rounded-sm">${unsafeHTML((l as any).svg ?? '')}</div>
                                        <span class="text-sm text-gray-700 dark:text-gray-300">${l.name}</span>
                                        <span class="
                                            ml-auto shrink-0 text-sm font-mono px-1.5 py-0.5 rounded
                                            bg-gray-100 dark:bg-gray-800
                                            text-gray-500 dark:text-gray-400
                                            uppercase tracking-wider
                                        ">${l.code}</span>
                                    </div>
                                `;
                            })}
                    </div>
                ` : ''}

                ${this._addSelected.length > 0 ? html`
                    <div class="flex flex-wrap gap-1.5">
                        ${this._addSelected.map(code => {
                            const langObj = (allLanguages as ICollabLanguage[]).find(l => l.code === code);
                            return html`
                                <div class="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md
                                    border border-indigo-200 dark:border-indigo-700
                                    bg-indigo-50 dark:bg-indigo-900/10
                                ">
                                    <div class="shrink-0 w-[30px] h-6 overflow-hidden rounded-sm">${unsafeHTML((langObj as any)?.svg ?? '')}</div>
                                    <span class="text-sm font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">${code}</span>
                                    ${langObj ? html`<span class="text-sm text-gray-500 dark:text-gray-400">${langObj.name}</span>` : ''}
                                    <button
                                        class="ml-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors leading-none"
                                        @click=${() => { this._addSelected = this._addSelected.filter(c => c !== code); }}
                                    >&#x2715;</button>
                                </div>
                            `;
                        })}
                    </div>
                ` : ''}

                <button
                    class="
                        self-end text-sm px-3 py-1.5 rounded
                        transition-colors
                        ${this._addSelected.length === 0 || hasRunning
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'bg-indigo-500 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer'}
                    "
                    ?disabled=${this._addSelected.length === 0 || hasRunning}
                    @click=${() => this._executeAddLanguage()}
                >${this.msg.add}</button>

                ${this._pendingTasks.size > 0 ? html`
                    <div class="flex flex-col gap-1">
                        ${[...this._pendingTasks.entries()].map(([taskKey, task]) => {
                            const codes = taskKey.split('+');
                            return html`
                                <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md
                                    ${task.status === 'running' ? 'bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-700'
                                    : task.status === 'done'    ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700'
                                    :                            'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700'}
                                ">
                                    ${task.status === 'running' ? this._renderSpinner() : ''}
                                    ${task.status === 'done'  ? html`<span class="text-sm text-emerald-500 dark:text-emerald-400">✓</span>` : ''}
                                    ${task.status === 'error' ? html`<span class="text-sm text-red-500 dark:text-red-400">✕</span>` : ''}
                                    <span class="text-sm font-mono uppercase tracking-wider
                                        ${task.status === 'running' ? 'text-indigo-600 dark:text-indigo-400'
                                        : task.status === 'done'    ? 'text-emerald-600 dark:text-emerald-400'
                                        :                             'text-red-600 dark:text-red-400'}
                                    ">${codes.join(', ')}</span>
                                    ${task.status === 'running' ? html`<span class="text-sm text-indigo-400 dark:text-indigo-500 italic">processing…</span>` : ''}
                                    ${task.message ? html`<span class="text-sm text-red-400 dark:text-red-500 truncate">${task.message}</span>` : ''}
                                    <button
                                        class="ml-auto text-sm text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
                                        @click=${() => {
                                            // TODO: acompanhar task
                                        }}
                                    >${this.msg.followTask}</button>
                                </div>
                            `;
                        })}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderSpinner(color: string = 'border-indigo-500 dark:border-indigo-400') {
        return html`<div class="w-3 h-3 border-2 ${color} border-t-transparent rounded-full animate-spin shrink-0"></div>`;
    }

    private _renderHeader(title: string, description: string) {
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span class="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">${title}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">${description}</span>
            </div>
        `;
    }

    private _renderNotice(message: string) {
        return html`
            <div class="
                rounded-lg border border-amber-200 dark:border-amber-800/40
                bg-amber-50 dark:bg-amber-900/10
                px-3 py-2.5
            ">
                <span class="text-sm text-amber-600 dark:text-amber-400 leading-relaxed">${message}</span>
            </div>
        `;
    }

    private _renderLangCard(lang: string, selectValue: number) {
        const langObj = (allLanguages as any[]).find(l => l.code === lang);
        const fullName = langObj?.name ?? lang;
        const svg = langObj?.svg ?? '';
        return html`
            <div
                class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    px-3 py-2.5 flex items-center gap-2
                    cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors
                "
                @click=${() => this._dispatchSelect(selectValue)}
            >
                <div class="shrink-0 w-[30px] h-7 overflow-hidden rounded-sm">${unsafeHTML(svg)}</div>
                <span class="text-sm text-gray-700 dark:text-gray-300">${fullName}</span>
                <span class="
                    ml-auto text-sm font-mono px-1.5 py-0.5 rounded
                    bg-emerald-100 dark:bg-emerald-900/30
                    text-emerald-600 dark:text-emerald-400
                    font-semibold uppercase tracking-wider
                ">${lang}</span>
            </div>
        `;
    }

    private _dispatchConfig() {
        const labels: Record<number, string> = { 0: 'All' };
        this._languages.forEach((lang, i) => { labels[i + 1] = lang; });
        labels[this._languages.length + 1] = '+';
        this.dispatchEvent(new CustomEvent('lang-config', {
            detail: { min: 0, max: this._languages.length + 1, labels },
            bubbles: true,
            composed: true,
        }));
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-language', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
