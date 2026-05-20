/// <mls fileReference="_102020_/l2/plugins/selectOrganization.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/markdownViewer.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Organizations',
    desc: 'An organization groups multiple projects under the same umbrella. Select one to browse the projects available to your team.',
    allTitle: 'All Organizations',
    allDesc: 'Overview of all organizations available in the system.',
    customTitle: 'New Organization',
    customDesc: 'Create a new organization to group your projects.',
    projects: 'projects',
    noOrgs: 'No organizations found.',
    noResults: 'No organizations match your search.',
    createNew: 'New Organization',
    searchPlaceholder: 'Search organizations…',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Organizações',
        desc: 'Uma organização agrupa vários projetos sob o mesmo guarda-chuva. Selecione uma para navegar pelos projetos disponíveis para o seu time.',
        allTitle: 'Todas as Organizações',
        allDesc: 'Visão geral de todas as organizações disponíveis no sistema.',
        customTitle: 'Nova Organização',
        customDesc: 'Crie uma nova organização para agrupar seus projetos.',
        projects: 'projetos',
        noOrgs: 'Nenhuma organização encontrada.',
        noResults: 'Nenhuma organização corresponde à sua busca.',
        createNew: 'Nova Organização',
        searchPlaceholder: 'Buscar organizações…',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        title: 'Organizaciones',
        desc: 'Una organización agrupa múltiples proyectos bajo el mismo paraguas. Seleccione una para explorar los proyectos disponibles para su equipo.',
        allTitle: 'Todas las Organizaciones',
        allDesc: 'Visión general de todas las organizaciones disponibles en el sistema.',
        customTitle: 'Nueva Organización',
        customDesc: 'Cree una nueva organización para agrupar sus proyectos.',
        projects: 'proyectos',
        noOrgs: 'No se encontraron organizaciones.',
        noResults: 'Ninguna organización coincide con su búsqueda.',
        createNew: 'Nueva Organización',
        searchPlaceholder: 'Buscar organizaciones…',
        inDevelopment: 'En desarrollo',
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

@customElement('plugins--select-organization-102020')
export class PluginSelectOrganization extends StateLitElement {

    @property({ attribute: false }) orgs: IOrg[] = [];
    @property({ attribute: false }) value: number | null = null;

    @state() private _search: string = '';

    private readonly _descriptions: Map<string, string> = new Map();

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
        return this.value !== null && this.value > this.orgs.length;
    }

    private get _selectedOrg(): IOrg | null {
        if (this.value === null || this.value <= 0 || this.value > this.orgs.length) return null;
        return this.orgs[this.value - 1];
    }

    createRenderRoot() { return this; }

    render() {
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    private _renderSelected() {
        const org = this._selectedOrg;
        const max = this.orgs.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderNavHeader(this.msg.title, this.msg.desc, this.value ?? 0, 0, max)}
                ${org ? this._renderSelectedOrgDetail(org) : nothing}
            </div>
        `;
    }

    private _renderSelectedOrgDetail(org: IOrg) {
        const date = org.created_at
            ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' }).format(new Date(org.created_at))
            : null;
        const description = this._descriptions.get(org.key) ?? org.description ?? '';
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5
            ">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${org.name}</span>
                    ${date ? html`<span class="text-[10px] text-gray-400 dark:text-gray-600 font-mono">(${date})</span>` : nothing}
                    <span class="text-gray-300 dark:text-gray-700">·</span>
                    <span class="
                        text-[10px] px-2 py-0.5 rounded-full font-medium
                        bg-indigo-100 dark:bg-indigo-900/30
                        text-indigo-600 dark:text-indigo-400
                    ">${org.projects.length} ${this.msg.projects}</span>
                </div>
            </div>

            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-3
            ">
                <plugins--markdown-viewer-102020
                    .text=${description}
                    @md-save=${(e: CustomEvent) => {
                        this._descriptions.set(org.key, e.detail.value);
                        this.requestUpdate();
                    }}
                ></plugins--markdown-viewer-102020>
            </div>
        `;
    }

    private _renderAll() {
        const q = this._search.toLowerCase();
        const filtered = this.orgs
            .map((org, i) => ({ org, selectValue: i + 1 }))
            .filter(({ org }) => !q || org.name.toLowerCase().includes(q));
        const max = this.orgs.length + 1;

        return html`
            <div class="flex flex-col gap-3">
                ${this._renderNavHeader(this.msg.allTitle, this.msg.allDesc, 0, 0, max)}
                <button
                    class="
                        self-end text-[10px] px-2.5 py-1 rounded
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
                        w-full text-xs px-2.5 py-1.5 rounded-md
                        border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900
                        text-gray-700 dark:text-gray-300
                        placeholder-gray-400 dark:placeholder-gray-600
                        focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600
                    "
                    @input=${(e: Event) => { this._search = (e.target as HTMLInputElement).value; }}
                />

                ${this.orgs.length === 0
                    ? html`<span class="text-[11px] text-gray-400 dark:text-gray-600 italic">${this.msg.noOrgs}</span>`
                    : filtered.length === 0
                        ? html`<span class="text-[11px] text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ org, selectValue }) => this._renderOrgCard(org, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        const max = this.orgs.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderNavHeader(this.msg.customTitle, this.msg.customDesc, max, 0, max)}
                <div class="
                    rounded-lg border border-amber-200 dark:border-amber-800/40
                    bg-amber-50 dark:bg-amber-900/10
                    px-3 py-2.5
                ">
                    <span class="text-xs text-amber-600 dark:text-amber-400">${this.msg.inDevelopment}</span>
                </div>
            </div>
        `;
    }

    private _renderNavHeader(title: string, desc: string, value: number, min: number, max: number) {
        const atMin = value <= min;
        const atMax = value >= max;
        const navBtn = (label: string, target: number, disabled: boolean) => html`
            <button
                class="px-1.5 py-1 rounded text-base font-mono leading-none transition-colors
                    ${disabled
                        ? 'text-gray-300 dark:text-gray-700 cursor-default'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'}"
                ?disabled=${disabled}
                @click=${() => { if (!disabled) this._dispatchSelect(target); }}
            >${label}</button>
        `;
        return html`
            <div class="flex flex-col gap-1">
                <div class="flex items-center">
                    <div class="flex items-center gap-0.5">
                        ${navBtn('«', min, atMin)}
                        ${navBtn('‹', value - 1, atMin)}
                    </div>
                    <span class="flex-1 text-center text-lg font-semibold text-gray-700 dark:text-gray-200">${title}</span>
                    <div class="flex items-center gap-0.5">
                        ${navBtn('›', value + 1, atMax)}
                        ${navBtn('»', max, atMax)}
                    </div>
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">${desc}</span>
            </div>
        `;
    }

    private _renderOrgCard(org: IOrg, selectValue?: number) {
        const clickable = selectValue !== undefined;
        return html`
            <div
                class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    px-3 py-2.5 flex items-center justify-between
                    ${clickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors' : ''}
                "
                @click=${clickable ? () => this._dispatchSelect(selectValue!) : nothing}
            >
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${org.name}</span>
                <span class="
                    text-[10px] px-2 py-0.5 rounded-full font-medium
                    bg-indigo-100 dark:bg-indigo-900/30
                    text-indigo-600 dark:text-indigo-400
                ">${org.projects.length} ${this.msg.projects}</span>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-org', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
