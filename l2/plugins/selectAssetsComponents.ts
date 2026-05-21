/// <mls fileReference="_102020_/l2/plugins/selectAssetsComponents.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { mutationGroups, renderIcon, MutationGroupEntry, SkillCategory } from '/_102020_/l2/molecules/index.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    category: 'Assets',
    title: 'Components',
    desc: 'Browse reusable component groups available for this module.',
    searchPlaceholder: 'Search groups…',
    catAll: 'All',
    noResults: 'No groups match your search.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        category: 'Assets',
        title: 'Componentes',
        desc: 'Navegue pelos grupos de componentes reutilizáveis disponíveis para este módulo.',
        searchPlaceholder: 'Buscar grupos…',
        catAll: 'Todos',
        noResults: 'Nenhum grupo corresponde à sua busca.',
    },
    es: {
        category: 'Assets',
        title: 'Componentes',
        desc: 'Explore los grupos de componentes reutilizables disponibles para este módulo.',
        searchPlaceholder: 'Buscar grupos…',
        catAll: 'Todos',
        noResults: 'Ningún grupo coincide con su búsqueda.',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

type ViewMode = 'list' | 'preview' | 'grid';

const MY_SLOT = 1;
const ASSETS_MIN = 1;
const ASSETS_MAX = 3;

const CATEGORY_META: Record<string, { label: string; classes: string; chipActive: string }> = {
    dataEntry:      { label: 'Data Entry',      classes: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',         chipActive: 'bg-sky-500 dark:bg-sky-600 text-white'      },
    dataDiscovery:  { label: 'Data Discovery',  classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',  chipActive: 'bg-amber-500 dark:bg-amber-600 text-white'  },
    dataDisplay:    { label: 'Data Display',    classes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', chipActive: 'bg-emerald-500 dark:bg-emerald-600 text-white' },
    actions:        { label: 'Actions',         classes: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',      chipActive: 'bg-rose-500 dark:bg-rose-600 text-white'    },
    navigation:     { label: 'Navigation',      classes: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400', chipActive: 'bg-violet-500 dark:bg-violet-600 text-white' },
    feedback:       { label: 'Feedback',        classes: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', chipActive: 'bg-orange-500 dark:bg-orange-600 text-white' },
    identity:       { label: 'Identity',        classes: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',     chipActive: 'bg-teal-500 dark:bg-teal-600 text-white'    },
};

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-assets-components-102020')
export class PluginSelectAssetsComponents extends StateLitElement {

    @property({ attribute: false }) selectedModule: IModule | null = null;
    @property({ attribute: false }) device: number | null = null;

    @state() private _selected: string | null = null;
    @state() private _filterCategory: SkillCategory | '' = '';
    @state() private _search: string = '';
    @state() private _viewMode: ViewMode = 'preview';

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('selectedModule')) {
            this._selected = null;
            this._filterCategory = '';
            this._search = '';
        }
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private get _filteredGroups(): MutationGroupEntry[] {
        const q = this._search.toLowerCase();
        return (mutationGroups as MutationGroupEntry[]).filter(g => {
            if (this._filterCategory && g.category !== this._filterCategory) return false;
            if (!q) return true;
            return g.label.toLowerCase().includes(q) || (g.shortDescription ?? '').toLowerCase().includes(q);
        });
    }

    private get _activeCategories(): SkillCategory[] {
        const cats = new Set((mutationGroups as MutationGroupEntry[]).map(g => g.category));
        return Array.from(cats) as SkillCategory[];
    }

    createRenderRoot() { return this; }

    render() {
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.category}
                    .itemName=${this.msg.title}
                    .desc=${this.msg.desc}
                    .value=${MY_SLOT}
                    .min=${ASSETS_MIN}
                    .max=${ASSETS_MAX}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>

                ${this._renderToolbar()}
                ${this._renderCategoryFilter()}
                ${this._renderContent()}
            </div>
        `;
    }

    // ─── Toolbar ─────────────────────────────────────────────────────

    private _renderToolbar() {
        return html`
            <div class="flex items-center gap-1.5">
                <input
                    type="text"
                    .value=${this._search}
                    placeholder=${this.msg.searchPlaceholder}
                    class="
                        flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-md
                        border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900
                        text-gray-700 dark:text-gray-300
                        placeholder-gray-400 dark:placeholder-gray-600
                        focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600
                    "
                    @input=${(e: Event) => { this._search = (e.target as HTMLInputElement).value; }}
                />
                ${this._renderViewToggle()}
            </div>
        `;
    }

    private _renderViewToggle() {
        const btn = (mode: ViewMode, icon: unknown) => html`
            <button
                class="p-1.5 rounded transition-colors cursor-pointer
                    ${this._viewMode === mode
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300'}
                "
                @click=${() => { this._viewMode = mode; }}
            >${icon}</button>
        `;
        return html`
            <div class="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
                ${btn('list',    this._svgList())}
                ${btn('preview', this._svgListPreview())}
                ${btn('grid',    this._svgGrid())}
            </div>
        `;
    }

    // ─── Category Filter ─────────────────────────────────────────────

    private _renderCategoryFilter() {
        const cats = this._activeCategories;
        return html`
            <div class="flex items-center gap-1 flex-wrap">
                <button
                    class="
                        text-xs px-2 py-1 rounded-full transition-colors cursor-pointer
                        ${this._filterCategory === ''
                            ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                    "
                    @click=${() => { this._filterCategory = ''; }}
                >${this.msg.catAll}</button>
                ${cats.map(cat => {
                    const meta = CATEGORY_META[cat];
                    const isActive = this._filterCategory === cat;
                    return html`
                        <button
                            class="
                                text-xs px-2 py-1 rounded-full transition-colors cursor-pointer
                                ${isActive
                                    ? (meta?.chipActive ?? 'bg-indigo-500 text-white')
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                            "
                            @click=${() => { this._filterCategory = cat; }}
                        >${meta?.label ?? cat}</button>
                    `;
                })}
            </div>
        `;
    }

    // ─── Content ─────────────────────────────────────────────────────

    private _renderContent() {
        const groups = this._filteredGroups;
        if (groups.length === 0) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`;
        }
        if (this._viewMode === 'list')    return this._renderListShort(groups);
        if (this._viewMode === 'preview') return this._renderListPreview(groups);
        return this._renderGrid(groups);
    }

    private _renderListShort(groups: MutationGroupEntry[]) {
        return html`
            <div class="flex flex-col">
                ${groups.map(g => {
                    const meta = CATEGORY_META[g.category];
                    const isSelected = this._selected === g.name;
                    const iconSvg = renderIcon(g.icon, 14);
                    return html`
                        <div
                            class="
                                flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors
                                ${isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800/70 text-gray-500 dark:text-gray-400'}
                            "
                            @click=${() => this._onGroupClick(g)}
                        >
                            ${isSelected
                                ? html`<div class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0"></div>`
                                : html`<span class="shrink-0">${unsafeHTML(iconSvg)}</span>`}
                            <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">${g.label}</span>
                            <span class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta?.classes ?? ''}">${meta?.label ?? g.category}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    private _renderListPreview(groups: MutationGroupEntry[]) {
        return html`
            <div class="flex flex-col gap-1">
                ${groups.map(g => {
                    const meta = CATEGORY_META[g.category];
                    const isSelected = this._selected === g.name;
                    const iconSvg = renderIcon(g.icon, 20);
                    return html`
                        <div
                            class="
                                flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all
                                border
                                ${isSelected
                                    ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700'}
                            "
                            @click=${() => this._onGroupClick(g)}
                        >
                            <div class="
                                shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                                ${isSelected
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                            ">${unsafeHTML(iconSvg)}</div>
                            <div class="flex flex-col flex-1 min-w-0">
                                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">${g.label}</span>
                                <span class="text-xs text-gray-400 dark:text-gray-500 truncate">${g.shortDescription ?? ''}</span>
                            </div>
                            <span class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta?.classes ?? ''}">${meta?.label ?? g.category}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    private _renderGrid(groups: MutationGroupEntry[]) {
        return html`
            <div class="grid grid-cols-2 gap-2">
                ${groups.map(g => this._renderGroupCard(g))}
            </div>
        `;
    }

    private _renderGroupCard(group: MutationGroupEntry) {
        const meta = CATEGORY_META[group.category];
        const isSelected = this._selected === group.name;
        const iconSvg = renderIcon(group.icon, 22);

        return html`
            <div
                class="
                    flex flex-col gap-2 rounded-xl p-2.5 cursor-pointer
                    border transition-all
                    ${isSelected
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm'}
                "
                @click=${() => this._onGroupClick(group)}
            >
                <div class="flex items-start justify-between gap-1">
                    <div class="
                        w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                        ${isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                    ">
                        ${unsafeHTML(iconSvg)}
                    </div>
                    ${isSelected
                        ? html`<div class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1 shrink-0"></div>`
                        : nothing}
                </div>
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                        ${group.label}
                    </span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500 leading-snug line-clamp-2">
                        ${group.shortDescription ?? ''}
                    </span>
                </div>
                <div class="mt-auto">
                    <span class="
                        text-[10px] font-medium px-1.5 py-0.5 rounded-full
                        ${meta?.classes ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500'}
                    ">${meta?.label ?? group.category}</span>
                </div>
            </div>
        `;
    }

    // ─── Logic ───────────────────────────────────────────────────────

    private _onGroupClick(group: MutationGroupEntry) {
        this._selected = group.name;
        this.findIndex(group.name);
    }

    private findIndex(groupName: string) {
        const folder = `molecules/${groupName.toLowerCase()}`;
        // @ts-ignore
        const found = Object.values(mls.stor.files as Record<string, any>)
            .filter((f: any) => f.folder === folder && f.shortName === 'index');
        console.log(`[selectAssetsComponents] findIndex("${groupName}") →`, found);
    }

    // ─── SVG Icons ───────────────────────────────────────────────────

    private _svgList() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    }
    private _svgListPreview() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><line x1="12" y1="6.5" x2="21" y2="6.5"/><line x1="12" y1="12.5" x2="21" y2="12.5"/><line x1="12" y1="18.5" x2="21" y2="18.5"/></svg>`;
    }
    private _svgGrid() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-assets', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
