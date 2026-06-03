/// <mls fileReference="_102020_/l2/plugins/selectProject.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { setProjectDetails, loadPluginProject, openElementInServiceDetails } from '/_102027_/l2/libCommom.js';
import { getAuraState, setAuraState, saveAuraProject } from '/_102020_/l2/auraState.js';
import { convertFileToTag } from '/_102020_/l2/utils';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Project',
    desc: 'A project is a deliverable within an organization — it contains pages, components, and all generated code.',
    allTitle: 'All Projects',
    allDesc: 'Overview of all projects in this organization.',
    customTitle: 'New Project',
    customDesc: 'Create a new project within this organization.',
    needsOrg: 'Select an organization first to see the available projects.',
    selectBtn: 'Select Project',
    actualProject: 'actual project',
    noResults: 'No projects match your search.',
    createNew: 'New Project',
    searchPlaceholder: 'Search projects…',
    loadingPlugins: 'Loading plugins…',
    noPlugins: 'No configuration plugins found for this project.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Projeto',
        desc: 'Um projeto é uma entrega dentro de uma organização — contém páginas, componentes e todo o código gerado.',
        allTitle: 'Todos os Projetos',
        allDesc: 'Visão geral de todos os projetos desta organização.',
        customTitle: 'Novo Projeto',
        customDesc: 'Crie um novo projeto dentro desta organização.',
        needsOrg: 'Selecione uma organização primeiro para ver os projetos disponíveis.',
        selectBtn: 'Selecionar Projeto',
        actualProject: 'projeto atual',
        noResults: 'Nenhum projeto corresponde à sua busca.',
        createNew: 'Novo Projeto',
        searchPlaceholder: 'Buscar projetos…',
        loadingPlugins: 'Carregando plugins…',
        noPlugins: 'Nenhum plugin de configuração encontrado para este projeto.',
    },
    es: {
        title: 'Proyecto',
        desc: 'Un proyecto es un entregable dentro de una organización — contiene páginas, componentes y todo el código generado.',
        allTitle: 'Todos los Proyectos',
        allDesc: 'Visión general de todos los proyectos de esta organización.',
        customTitle: 'Nuevo Proyecto',
        customDesc: 'Cree un nuevo proyecto dentro de esta organización.',
        needsOrg: 'Seleccione una organización primero para ver los proyectos disponibles.',
        selectBtn: 'Seleccionar Proyecto',
        actualProject: 'proyecto actual',
        noResults: 'Ningún proyecto coincide con su búsqueda.',
        createNew: 'Nuevo Proyecto',
        searchPlaceholder: 'Buscar proyectos…',
        loadingPlugins: 'Cargando plugins…',
        noPlugins: 'No se encontraron plugins de configuración para este proyecto.',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IProject {
    project: number;
    name: string;
    doSelect: boolean;
}

interface IOrg {
    name: string;
    created_at: string;
    description: string;
    key: string;
    index: number;
    projects: IProject[];
}

interface IMenuAction {
    category: string | null;
    scope: string[];
    priority?: number;
    auth: string[];
    widget: string;
    widgetConfig?: string;
}

interface IPluginItem {
    action: IMenuAction;
    title: string;
    getSvg: (() => unknown) | null;
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-project-102020')
export class PluginSelectProject extends StateLitElement {

    @property({ attribute: false }) selectedOrg: IOrg | null = null;
    @property({ attribute: false }) value: number | null = null;

    @state() private _search: string = '';
    @state() private _pluginsByCategory: Record<string, IPluginItem[]> = {};
    @state() private _openCategories: Set<string> = new Set();
    @state() private _pluginsLoading: boolean = false;
    @state() private _selectedPlugin: string | null = null;

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('value') || changed.has('selectedOrg')) {
            this._search = '';
            const project = this._selectedProject;
            if (project) this._loadPlugins(project.project);
            else { this._pluginsByCategory = {}; this._openCategories = new Set(); }
        }
    }

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    private get _isAll(): boolean {
        return this.value === 0;
    }

    private get _isCustom(): boolean {
        return this.selectedOrg !== null && this.value !== null && this.value > this.selectedOrg.projects.length;
    }

    private get _selectedProject(): IProject | null {
        if (!this.selectedOrg || this.value === null || this.value <= 0 || this.value > this.selectedOrg.projects.length) return null;
        return this.selectedOrg.projects[this.value - 1];
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.selectedOrg) return this._renderNeedsOrg();
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    // ─── Plugin load ──────────────────────────────────────────────────

    private async _loadPlugins(projectId: number) {
        this._pluginsByCategory = {};
        this._pluginsLoading = true;
        // @ts-ignore
        this.requestUpdate();
        try {
            // @ts-ignore
            const array: IMenuAction[] = await loadPluginProject(projectId, 'l5Project', false);
            const byCategory: Record<string, IMenuAction[]> = {};
            array.forEach((item) => {
                const cat = item.category ?? 'General';
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(item);
            });

            const result: Record<string, IPluginItem[]> = {};
            for (const [cat, actions] of Object.entries(byCategory)) {
                result[cat] = await Promise.all(actions.map(async (action) => {
                    let title = action.widget;
                    let getSvg: (() => unknown) | null = null;
                    try {
                        const match = action.widget.match(/^_(\d+)_(.+)$/);
                        if (match) {
                            const mod = await import(`/_${match[1]}_/l2/${match[2]}.js`);
                            const pd = mod?.pluginData;
                            if (pd) {
                                title = pd.title ?? title;
                                getSvg = pd.getSvg ?? null;
                            }
                        }
                    } catch { /* ignore */ }
                    return { action, title, getSvg };
                }));
            }

            this._pluginsByCategory = result;
            this._openCategories = new Set(Object.keys(result));
        } catch {
            this._pluginsByCategory = {};
        }
        this._pluginsLoading = false;
        // @ts-ignore
        this.requestUpdate();
    }

    private _toggleCategory(cat: string) {
        const next = new Set(this._openCategories);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        this._openCategories = next;
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderNeedsOrg() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, this.msg.desc)}
                ${this._renderNotice(this.msg.needsOrg)}
            </div>
        `;
    }

    private _renderSelected() {
        const project = this._selectedProject;
        const org = this.selectedOrg!;
        const max = (org?.projects.length ?? 0) + 1;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${project?.name ?? ''}
                    .desc=${this.msg.desc}
                    .value=${this.value ?? 0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                ${project
                    ? getAuraState().actualProject === project.project
                        ? html`<span class="
                            self-end text-sm px-2 py-0.5 rounded-full font-medium
                            bg-emerald-100 dark:bg-emerald-900/30
                            text-emerald-600 dark:text-emerald-400
                        ">${this.msg.actualProject}</span>`
                        : html`<button
                            class="
                                self-end text-sm px-2.5 py-1 rounded
                                bg-indigo-500 dark:bg-indigo-600 text-white
                                hover:bg-indigo-600 dark:hover:bg-indigo-500
                                transition-colors whitespace-nowrap cursor-pointer
                            "
                            @click=${() => {
                                saveAuraProject();
                                mls.setActualProject(project.project);
                                const orgIndex = mls.l5.getProjectOrgIndex(project.project);
                                mls.l5.setActualOrg(orgIndex);
                                setProjectDetails(project.project);
                                setAuraState('actualProject', project.project);
                                window.location.reload();
                            }}
                        >${this.msg.selectBtn}</button>`
                    : nothing}
                ${project ? this._renderSelectedProjectDetail(project, org) : nothing}
            </div>
        `;
    }

    private _renderSelectedProjectDetail(project: IProject, org: IOrg) {
        const isActual = getAuraState().actualProject === project.project;
        return html`
            <div class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5">
                <div class="flex items-center gap-2">
                    <span class="shrink-0 text-sm text-gray-400 dark:text-gray-600 font-mono">${org.name}</span>
                    <span class="shrink-0 text-gray-300 dark:text-gray-700">/</span>
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-300" style="max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${project.name}</span>
                    <span class="shrink-0 ml-auto text-sm font-mono text-gray-400 dark:text-gray-600">#${project.project}</span>
                </div>
            </div>
            ${isActual ? this._renderPluginPanels() : nothing}
        `;
    }

    private _renderPluginPanels() {
        if (this._pluginsLoading) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.loadingPlugins}</span>`;
        }
        const categories = Object.entries(this._pluginsByCategory);
        if (categories.length === 0) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noPlugins}</span>`;
        }
        return html`
            <div class="flex flex-col gap-1.5">
                ${categories.map(([cat, items]) => this._renderCategoryPanel(cat, items))}
            </div>
        `;
    }

    private _renderCategoryPanel(cat: string, items: IPluginItem[]) {
        const isOpen = this._openCategories.has(cat);
        return html`
            <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button
                    class="
                        w-full flex items-center gap-2 px-3 py-2
                        bg-gray-100 dark:bg-gray-800/60
                        hover:bg-gray-200 dark:hover:bg-gray-800
                        transition-colors cursor-pointer
                    "
                    @click=${() => this._toggleCategory(cat)}
                >
                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex-1 text-left">${cat}</span>
                    <span class="text-base font-mono leading-none text-gray-400 dark:text-gray-600">${isOpen ? '−' : '+'}</span>
                </button>
                ${isOpen ? html`
                    <div class="flex flex-col divide-y divide-gray-100 dark:divide-gray-800/60">
                        ${items.map(item => this._renderPluginItem(item))}
                    </div>
                ` : nothing}
            </div>
        `;
    }

    private _renderPluginItem(item: IPluginItem) {
        const isSelected = this._selectedPlugin === item.action.widget;
        return html`
            <div
                class="
                    flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors
                    ${isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}
                "
                @click=${() => this._onPluginItemClick(item)}
            >
                ${item.getSvg ? html`
                    <span class="shrink-0 w-5 h-5 flex items-center justify-center
                        ${isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}">
                        ${item.getSvg()}
                    </span>
                ` : nothing}
                <span class="text-sm flex-1
                    ${isSelected
                        ? 'font-medium text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-700 dark:text-gray-300'}
                ">${item.title}</span>
                ${isSelected ? html`<div class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0"></div>` : nothing}
            </div>
        `;
    }

    private _onPluginItemClick(item: IPluginItem) {
        this._selectedPlugin = item.action.widget;
        const match = item.action.widget.match(/^_(\d+)_(.+)$/);
        if (!match) return;
        // @ts-ignore
        const storFileItem = Object.values(mls.stor.files as Record<string, any>)
            .find((f: any) => f.project === Number(match[1]) && f.shortName === match[2]);
        if (!storFileItem) return;
        const tag = convertFileToTag(storFileItem);
        const el = document.createElement(tag);
        el.setAttribute('autoPrepare', 'true');
        openElementInServiceDetails(el);
    }

    private _renderAll() {
        const org = this.selectedOrg!;
        const q = this._search.toLowerCase();
        const filtered = org.projects
            .map((p, i) => ({ p, selectValue: i + 1 }))
            .filter(({ p }) => !q || p.name.toLowerCase().includes(q) || String(p.project).includes(q))
            .sort((a, b) => {
                const actualProject = getAuraState().actualProject;
                if (a.p.project === actualProject) return -1;
                if (b.p.project === actualProject) return 1;
                return 0;
            });
        const max = org.projects.length + 1;

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

                ${org.projects.length === 0
                    ? nothing
                    : filtered.length === 0
                        ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ p, selectValue }) => this._renderProjectCard(p, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        const max = (this.selectedOrg?.projects.length ?? 0) + 1;
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
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderHeader(title: string, description: string) {
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span class="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">${title}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                    ${description}
                </span>
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
                <span class="text-sm text-amber-600 dark:text-amber-400 leading-relaxed">
                    ${message}
                </span>
            </div>
        `;
    }

    private _renderProjectCard(project: IProject, selectValue?: number) {
        const org = this.selectedOrg!;
        const clickable = selectValue !== undefined;
        const isActive = mls.actualProject === project.project;
        return html`
            <div
                class="
                    rounded-lg border
                    ${isActive
                        ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/10'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'}
                    px-3 py-2.5 flex items-center gap-2
                    ${clickable
                        ? isActive
                            ? 'cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors'
                            : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors'
                        : ''}
                "
                @click=${clickable ? () => this._dispatchSelect(selectValue!) : nothing}
            >
                ${isActive ? html`<div class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0"></div>` : nothing}
                <span class="text-sm text-gray-400 dark:text-gray-600 font-mono">${org.name}</span>
                <span class="text-gray-300 dark:text-gray-700">/</span>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300" style="max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${project.name}</span>
                <span class="ml-auto text-sm font-mono text-gray-400 dark:text-gray-600">#${project.project}</span>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-project', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
