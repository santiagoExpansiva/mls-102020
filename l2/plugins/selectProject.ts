/// <mls fileReference="_102020_/l2/plugins/selectProject.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { setProjectDetails } from '/_102027_/l2/libCommom.js';
import '/_102020_/l2/plugins/markdownViewer.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Select Project',
    desc: 'A project is a deliverable within an organization — it contains pages, components, and all generated code.',
    allTitle: 'All Projects',
    allDesc: 'Overview of all projects in this organization.',
    customTitle: 'New Project',
    customDesc: 'Create a new project within this organization.',
    needsOrg: 'Select an organization first to see the available projects.',
    loading: 'Loading README…',
    selectBtn: 'Select Project',
    actualProject: 'actual project',
    noReadme: 'No README found — click Edit and save to add one.',
    noResults: 'No projects match your search.',
    createNew: 'New Project',
    searchPlaceholder: 'Search projects…',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Selecionar Projeto',
        desc: 'Um projeto é uma entrega dentro de uma organização — contém páginas, componentes e todo o código gerado.',
        allTitle: 'Todos os Projetos',
        allDesc: 'Visão geral de todos os projetos desta organização.',
        customTitle: 'Novo Projeto',
        customDesc: 'Crie um novo projeto dentro desta organização.',
        needsOrg: 'Selecione uma organização primeiro para ver os projetos disponíveis.',
        loading: 'Carregando README…',
        selectBtn: 'Selecionar Projeto',
        actualProject: 'projeto atual',
        noReadme: 'Nenhum README encontrado — clique em Editar e salve para adicionar.',
        noResults: 'Nenhum projeto corresponde à sua busca.',
        createNew: 'Novo Projeto',
        searchPlaceholder: 'Buscar projetos…',
    },
    es: {
        title: 'Seleccionar Proyecto',
        desc: 'Un proyecto es un entregable dentro de una organización — contiene páginas, componentes y todo el código generado.',
        allTitle: 'Todos los Proyectos',
        allDesc: 'Visión general de todos los proyectos de esta organización.',
        customTitle: 'Nuevo Proyecto',
        customDesc: 'Cree un nuevo proyecto dentro de esta organización.',
        needsOrg: 'Seleccione una organización primero para ver los proyectos disponibles.',
        loading: 'Cargando README…',
        selectBtn: 'Seleccionar Proyecto',
        actualProject: 'proyecto actual',
        noReadme: 'No se encontró README — haga clic en Editar y guarde para añadir uno.',
        noResults: 'Ningún proyecto coincide con su búsqueda.',
        createNew: 'Nuevo Proyecto',
        searchPlaceholder: 'Buscar proyectos…',
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

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-project-102020')
export class PluginSelectProject extends StateLitElement {

    @property({ attribute: false }) selectedOrg: IOrg | null = null;
    @property({ attribute: false }) value: number | null = null;

    @state() private _readme: string | null = null;
    @state() private _readmeLoading: boolean = false;
    @state() private _search: string = '';

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('value') || changed.has('selectedOrg')) {
            this._search = '';
            this._readme = null;
            const project = this._selectedProject;
            if (project) this._loadReadme(project.project);
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

    // ─── Async README load ────────────────────────────────────────────

    private async _loadReadme(projectId: number) {
        this._readmeLoading = true;
        this.requestUpdate();

        try {
            const key = mls.stor.getKeyToFile({ project: projectId, level: 0, shortName: 'README', folder: '', extension: '.md' });
            const storFile = mls.stor.files[key];
            this._readme = storFile ? await storFile.getContent() as string : null;
        } catch {
            this._readme = null;
        }

        this._readmeLoading = false;
        this.requestUpdate();
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderNeedsOrg() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, null, this.msg.desc)}
                ${this._renderNotice(this.msg.needsOrg)}
            </div>
        `;
    }

    private _renderSelected() {
        const project = this._selectedProject;
        const org = this.selectedOrg!;
        return html`
            <div class="flex flex-col gap-3">
                <button
                    class="self-start flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    @click=${() => this._dispatchSelect(0)}
                >
                    <span>&#8249;</span>
                    <span>${this.msg.title}</span>
                </button>
                <div class="flex items-start justify-between gap-2">
                    ${this._renderHeader(this.msg.title, null, this.msg.desc)}
                    ${project
                        ? mls.actualProject === project.project
                            ? html`<span class="
                                shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium
                                bg-emerald-100 dark:bg-emerald-900/30
                                text-emerald-600 dark:text-emerald-400
                            ">${this.msg.actualProject}</span>`
                            : html`<button
                                class="
                                    shrink-0 text-[10px] px-2.5 py-1 rounded
                                    bg-indigo-500 dark:bg-indigo-600 text-white
                                    hover:bg-indigo-600 dark:hover:bg-indigo-500
                                    transition-colors whitespace-nowrap
                                "
                                @click=${() => {
                                    mls.setActualProject(project.project);
                                    const orgIndex = mls.l5.getProjectOrgIndex(project.project);
                                    mls.l5.setActualOrg(orgIndex);
                                    setProjectDetails(project.project);
                                    window.location.reload();
                                }}
                            >${this.msg.selectBtn}</button>`
                        : nothing}
                </div>
                ${project ? this._renderSelectedProjectDetail(project, org) : nothing}
            </div>
        `;
    }

    private _renderSelectedProjectDetail(project: IProject, org: IOrg) {
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5
            ">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-400 dark:text-gray-600 font-mono">${org.name}</span>
                    <span class="text-gray-300 dark:text-gray-700">/</span>
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${project.name}</span>
                </div>
            </div>

            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-3
            ">
                ${this._readmeLoading
                    ? html`<span class="text-xs text-gray-400 dark:text-gray-600 italic">${this.msg.loading}</span>`
                    : html`
                        <plugins--markdown-viewer-102020
                            .text=${this._readme ?? this.msg.noReadme}
                            @md-save=${(e: CustomEvent) => { this._readme = e.detail.value; }}
                        ></plugins--markdown-viewer-102020>
                    `}
            </div>
        `;
    }

    private _renderAll() {
        const org = this.selectedOrg!;
        const q = this._search.toLowerCase();
        const filtered = org.projects
            .map((p, i) => ({ p, selectValue: i + 1 }))
            .filter(({ p }) => !q || p.name.toLowerCase().includes(q) || String(p.project).includes(q));

        return html`
            <div class="flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2">
                    ${this._renderHeader(this.msg.allTitle, null, this.msg.allDesc)}
                    <button
                        class="
                            shrink-0 text-[10px] px-2.5 py-1 rounded
                            bg-indigo-500 dark:bg-indigo-600 text-white
                            hover:bg-indigo-600 dark:hover:bg-indigo-500
                            transition-colors whitespace-nowrap
                        "
                        @click=${() => this._dispatchSelect(org.projects.length + 1)}
                    >+ ${this.msg.createNew}</button>
                </div>

                <input
                    type="text"
                    .value=${this._search}
                    placeholder=${this.msg.searchPlaceholder}
                    class="
                        w-full text-xs px-2.5 py-1.5 rounded-md
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
                        ? html`<span class="text-[11px] text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ p, selectValue }) => this._renderProjectCard(p, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.customTitle, null, this.msg.customDesc)}
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderHeader(title: string, badge: string | null, description: string) {
        return html`
            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-lg font-semibold text-gray-700 dark:text-gray-200">${title}</span>
                    ${badge ? html`
                        <span class="
                            text-[10px] font-mono px-1.5 py-0.5 rounded
                            bg-gray-100 dark:bg-gray-800
                            text-gray-500 dark:text-gray-400
                        ">${badge}</span>
                    ` : nothing}
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
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
                <span class="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    ${message}
                </span>
            </div>
        `;
    }

    private _renderProjectCard(project: IProject, selectValue?: number) {
        const org = this.selectedOrg!;
        const clickable = selectValue !== undefined;
        return html`
            <div
                class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    px-3 py-2.5 flex items-center gap-2
                    ${clickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors' : ''}
                "
                @click=${clickable ? () => this._dispatchSelect(selectValue!) : nothing}
            >
                <span class="text-[10px] text-gray-400 dark:text-gray-600 font-mono">${org.name}</span>
                <span class="text-gray-300 dark:text-gray-700">/</span>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${project.name}</span>
                <span class="ml-auto text-[10px] font-mono text-gray-400 dark:text-gray-600">#${project.project}</span>
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
