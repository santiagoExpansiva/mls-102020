/// <mls fileReference="_102020_/l2/plugins/selectModule.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { setLastModule } from '/_102027_/l2/libCommom.js';
import { getAuraState, setAuraState, saveAuraProject } from '/_102020_/l2/auraState.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Module',
    desc: 'A module organizes the project source files into logical areas, each with its own pages, components, and shared code.',
    allTitle: 'All Modules',
    allDesc: 'Overview of all modules in this project.',
    customTitle: 'New Module',
    customDesc: 'Add a new module to organize a new area of the project.',
    noModules: 'No modules found in this project.',
    noResults: 'No modules match your search.',
    createNew: 'New Module',
    searchPlaceholder: 'Search modules…',
    inDevelopment: 'In development',
    selectBtn: 'Select Module',
    actualModule: 'actual module',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Módulo',
        desc: 'Um módulo organiza os arquivos fonte do projeto em áreas lógicas, cada uma com suas próprias páginas, componentes e código compartilhado.',
        allTitle: 'Todos os Módulos',
        allDesc: 'Visão geral de todos os módulos deste projeto.',
        customTitle: 'Novo Módulo',
        customDesc: 'Adicione um novo módulo para organizar uma nova área do projeto.',
        noModules: 'Nenhum módulo encontrado neste projeto.',
        noResults: 'Nenhum módulo corresponde à sua busca.',
        createNew: 'Novo Módulo',
        searchPlaceholder: 'Buscar módulos…',
        inDevelopment: 'Em desenvolvimento',
        selectBtn: 'Selecionar Módulo',
        actualModule: 'módulo atual',
    },
    es: {
        title: 'Módulo',
        desc: 'Un módulo organiza los archivos fuente del proyecto en áreas lógicas, cada una con sus propias páginas, componentes y código compartido.',
        allTitle: 'Todos los Módulos',
        allDesc: 'Visión general de todos los módulos de este proyecto.',
        customTitle: 'Nuevo Módulo',
        customDesc: 'Añade un nuevo módulo para organizar una nueva área del proyecto.',
        noModules: 'No se encontraron módulos en este proyecto.',
        noResults: 'Ningún módulo coincide con su búsqueda.',
        createNew: 'Nuevo Módulo',
        searchPlaceholder: 'Buscar módulos…',
        inDevelopment: 'En desarrollo',
        selectBtn: 'Seleccionar Módulo',
        actualModule: 'módulo actual',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-module-102020')
export class PluginSelectModule extends StateLitElement {

    @property({ attribute: false }) modules: IModule[] = [];
    @property({ attribute: false }) value: number | null = null;

    @state() private _search: string = '';

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('value')) this._search = '';
    }

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    private get _isAll(): boolean {
        return this.value === 0;
    }

    private get _isCustom(): boolean {
        return this.value !== null && this.value > this.modules.length;
    }

    private get _selectedModule(): IModule | null {
        if (this.value === null || this.value <= 0 || this.value > this.modules.length) return null;
        return this.modules[this.value - 1];
    }

    private _doSelectModule(name: string) {
        const actualPrj = getAuraState().actualProject
        if (!actualPrj) return;
        setLastModule(actualPrj, name);
        mls.setActualModule(name);
        setAuraState('actualModule', name);
        saveAuraProject();
        this.requestUpdate();
    }

    createRenderRoot() { return this; }

    render() {
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderSelected() {
        const module = this._selectedModule;
        const max = this.modules.length + 1;
        const isActual = module !== null && getAuraState().actualModule === module.name;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${module?.name ?? ''}
                    .desc=${this.msg.desc}
                    .value=${this.value ?? 0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                ${module
                    ? isActual
                        ? html`<span class="
                            self-end text-sm px-2 py-0.5 rounded-full font-medium
                            bg-emerald-100 dark:bg-emerald-900/30
                            text-emerald-600 dark:text-emerald-400
                        ">${this.msg.actualModule}</span>`
                        : html`<button
                            class="
                                self-end text-sm px-2.5 py-1 rounded
                                bg-indigo-500 dark:bg-indigo-600 text-white
                                hover:bg-indigo-600 dark:hover:bg-indigo-500
                                transition-colors whitespace-nowrap cursor-pointer
                            "
                            @click=${() => this._doSelectModule(module.name)}
                        >${this.msg.selectBtn}</button>`
                    : nothing}
                ${module ? this._renderModuleDetail(module) : nothing}
            </div>
        `;
    }

    private _renderModuleDetail(module: IModule) {
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5
            ">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${module.name}</span>
                    <span
                        class="ml-auto text-sm font-mono text-gray-400 dark:text-gray-600"
                        style="max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"
                    >${module.path}</span>
                </div>
            </div>
        `;
    }

    private _renderAll() {
        const q = this._search.toLowerCase();
        const actualModule = getAuraState().actualModule;
        const filtered = this.modules
            .map((m, i) => ({ m, selectValue: i + 1 }))
            .filter(({ m }) => !q || m.name.toLowerCase().includes(q) || m.path.toLowerCase().includes(q))
            .sort((a, b) => {
                if (a.m.name === actualModule) return -1;
                if (b.m.name === actualModule) return 1;
                return 0;
            });
        const max = this.modules.length + 1;

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

                ${this.modules.length === 0
                    ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noModules}</span>`
                    : filtered.length === 0
                        ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ m, selectValue }) => this._renderModuleCard(m, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        const max = this.modules.length + 1;
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
                <div class="
                    rounded-lg border border-amber-200 dark:border-amber-800/40
                    bg-amber-50 dark:bg-amber-900/10
                    px-3 py-2.5
                ">
                    <span class="text-sm text-amber-600 dark:text-amber-400">${this.msg.inDevelopment}</span>
                </div>
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderModuleCard(module: IModule, selectValue: number) {
        const isActive = getAuraState().actualModule === module.name;
        return html`
            <div
                class="
                    rounded-lg border
                    ${isActive
                        ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/70'}
                    px-3 py-2.5 flex items-center gap-2
                    cursor-pointer transition-colors
                "
                @click=${() => this._dispatchSelect(selectValue)}
            >
                ${isActive ? html`<div class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0"></div>` : nothing}
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${module.name}</span>
                <span
                    class="ml-auto text-sm font-mono text-gray-400 dark:text-gray-600"
                    style="max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"
                >${module.path}</span>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-module', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
