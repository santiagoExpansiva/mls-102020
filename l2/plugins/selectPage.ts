/// <mls fileReference="_102020_/l2/plugins/selectPage.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Pages',
    desc: 'Pages of the selected module. Filtered by active device when one is selected.',
    allTitle: 'All Pages',
    allDesc: 'All pages found for the selected module and device.',
    customTitle: 'New Page',
    customDesc: 'Create a new page in this module.',
    noModule: 'No module selected.',
    noPages: 'No pages found for this module.',
    noResults: 'No pages match your search.',
    createNew: 'New Page',
    searchPlaceholder: 'Search pages…',
    inDevelopment: 'In development',
    devices: 'Devices',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Páginas',
        desc: 'Páginas do módulo selecionado. Filtradas pelo device ativo quando um estiver selecionado.',
        allTitle: 'Todas as Páginas',
        allDesc: 'Todas as páginas encontradas para o módulo e device selecionados.',
        customTitle: 'Nova Página',
        customDesc: 'Crie uma nova página neste módulo.',
        noModule: 'Nenhum módulo selecionado.',
        noPages: 'Nenhuma página encontrada para este módulo.',
        noResults: 'Nenhuma página corresponde à sua busca.',
        createNew: 'Nova Página',
        searchPlaceholder: 'Buscar páginas…',
        inDevelopment: 'Em desenvolvimento',
        devices: 'Dispositivos',
    },
    es: {
        title: 'Páginas',
        desc: 'Páginas del módulo seleccionado. Filtradas por dispositivo activo cuando hay uno seleccionado.',
        allTitle: 'Todas las Páginas',
        allDesc: 'Todas las páginas encontradas para el módulo y dispositivo seleccionados.',
        customTitle: 'Nueva Página',
        customDesc: 'Cree una nueva página en este módulo.',
        noModule: 'Ningún módulo seleccionado.',
        noPages: 'No se encontraron páginas para este módulo.',
        noResults: 'Ninguna página coincide con su búsqueda.',
        createNew: 'Nueva Página',
        searchPlaceholder: 'Buscar páginas…',
        inDevelopment: 'En desarrollo',
        devices: 'Dispositivos',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

interface IPageEntry {
    name: string;
    devices: string[];
    file: mls.stor.IFileInfo;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEVICE_SUB_PATHS: Record<number, string> = {
    1: 'web/desktop',
    2: 'web/mobile',
    3: 'android',
    4: 'ios',
};

const DEVICE_LABELS: Record<string, string> = {
    'web/desktop': 'Web Desktop',
    'web/mobile': 'Web Mobile',
    'android': 'Android',
    'ios': 'iOS',
};

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-page-102020')
export class PluginSelectPage extends StateLitElement {

    @property({ attribute: false }) selectedModule: IModule | null = null;
    @property({ attribute: false }) value: number | null = null;

    @state() private _pages: IPageEntry[] = [];
    @state() private _search: string = '';
    @state() private _activeDevice: string | null = null;

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('selectedModule')) {
            this._search = '';
            this._loadPages();
        }
        if (changed.has('value')) {
            this._search = '';
        }
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private get _isAll(): boolean { return this.value === 0; }
    private get _isCustom(): boolean { return this.value !== null && this.value > this._pages.length; }
    private get _selectedPage(): IPageEntry | null {
        if (this.value === null || this.value <= 0 || this.value > this._pages.length) return null;
        return this._pages[this.value - 1];
    }

    // ─── Page Loading ─────────────────────────────────────────────────

    private _loadPages() {
        this._pages = [];
        if (!this.selectedModule) {
            this._dispatchConfig();
            return;
        }

        // @ts-ignore
        const project: number = mls.actualProject;
        // @ts-ignore
        const actualDevice: number | undefined = mls.actualDevice;

        const modulePath = this.selectedModule.path;
        const devicePaths = (actualDevice && DEVICE_SUB_PATHS[actualDevice])
            ? [DEVICE_SUB_PATHS[actualDevice]]
            : Object.values(DEVICE_SUB_PATHS);

        this._activeDevice = (actualDevice && DEVICE_SUB_PATHS[actualDevice])
            ? DEVICE_LABELS[DEVICE_SUB_PATHS[actualDevice]] ?? null
            : null;

        const pageMap = new Map<string, { devices: Set<string>; file: mls.stor.IFileInfo }>();

        // @ts-ignore
        for (const f of Object.values(mls.stor.files as Record<string, any>)) {
            if (f.project !== project) continue;
            const folder: string = f.folder ?? '';
            const shortName: string = f.shortName ?? '';
            if (!shortName) continue;

            for (const devicePath of devicePaths) {
                const prefix = `${modulePath}/${devicePath}`;
                if (!folder.startsWith(prefix + '/')) continue;

                const afterPrefix = folder.slice(prefix.length + 1); // "page11"
                if (/^page\d+$/.test(afterPrefix)) {
                    if (!pageMap.has(shortName)) pageMap.set(shortName, { devices: new Set(), file: f });
                    pageMap.get(shortName)!.devices.add(devicePath);
                }
            }
        }

        this._pages = Array.from(pageMap.entries())
            .map(([name, { devices, file }]) => ({ name, devices: Array.from(devices).sort(), file }))
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log('[selectPage] pages found:', this._pages);

        this._dispatchConfig();
        this.requestUpdate();
    }

    private _dispatchConfig() {
        const labels: Record<number, string> = { 0: 'All' };
        this._pages.forEach((p, i) => { labels[i + 1] = p.name; });
        labels[this._pages.length + 1] = '+';
        this.dispatchEvent(new CustomEvent('page-config', {
            detail: {
                min: 0,
                max: this._pages.length + 1,
                labels,
                pages: this._pages.map(p => ({ name: p.name, file: p.file })),
            },
            bubbles: true,
            composed: true,
        }));
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.selectedModule) return this._renderNoModule();
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderNoModule() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader()}
                <div class="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                    <span class="text-sm text-amber-600 dark:text-amber-400">${this.msg.noModule}</span>
                </div>
            </div>
        `;
    }

    private _renderHeader(value = 0, max = 1) {
        return html`
            <plugins--nav-header-102020
                .fixedLabel=${this.msg.title}
                .itemName=${this.msg.allTitle}
                .desc=${this.msg.desc}
                .value=${value}
                .min=${0}
                .max=${max}
                @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
            ></plugins--nav-header-102020>
        `;
    }

    private _renderSelected() {
        const page = this._selectedPage;
        const max = this._pages.length + 1;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${page?.name ?? ''}
                    .desc=${this.msg.desc}
                    .value=${this.value ?? 0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                ${page ? this._renderPageDetail(page) : nothing}
            </div>
        `;
    }

    private _renderPageDetail(page: IPageEntry) {
        return html`
            <div class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 flex flex-col gap-2">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">${page.name}</span>
                <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-xs text-gray-400 dark:text-gray-600">${this.msg.devices}:</span>
                    ${page.devices.map(d => html`
                        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            ${DEVICE_LABELS[d] ?? d}
                        </span>
                    `)}
                </div>
            </div>
        `;
    }

    private _renderAll() {
        const q = this._search.toLowerCase();
        const filtered = this._pages
            .map((p, i) => ({ p, selectValue: i + 1 }))
            .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
        const max = this._pages.length + 1;

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

                ${this._activeDevice ? html`
                    <div class="flex items-center gap-1.5 px-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                        <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">${this._activeDevice}</span>
                    </div>
                ` : nothing}

                <button
                    class="
                        self-end text-sm px-2.5 py-1 rounded
                        bg-indigo-500 dark:bg-indigo-600 text-white
                        hover:bg-indigo-600 dark:hover:bg-indigo-500
                        transition-colors whitespace-nowrap cursor-pointer
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

                ${this._pages.length === 0
                    ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noPages}</span>`
                    : filtered.length === 0
                        ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                        : html`
                            <div class="flex flex-col gap-1.5">
                                ${filtered.map(({ p, selectValue }) => this._renderPageCard(p, selectValue))}
                            </div>
                        `}
            </div>
        `;
    }

    private _renderCustom() {
        const max = this._pages.length + 1;
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
                <div class="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                    <span class="text-sm text-amber-600 dark:text-amber-400">${this.msg.inDevelopment}</span>
                </div>
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderPageCard(page: IPageEntry, selectValue: number) {
        return html`
            <div
                class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    hover:bg-gray-100 dark:hover:bg-gray-800/70
                    px-3 py-2.5 flex items-center gap-2
                    cursor-pointer transition-colors
                "
                @click=${() => this._dispatchSelect(selectValue)}
            >
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">${page.name}</span>
                <div class="flex items-center gap-1">
                    ${page.devices.map(d => html`
                        <span class="text-[10px] font-medium px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            ${DEVICE_LABELS[d]?.replace('Web ', '') ?? d}
                        </span>
                    `)}
                </div>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        const entry = value > 0 && value <= this._pages.length ? this._pages[value - 1] : null;
        this.dispatchEvent(new CustomEvent('select-page', {
            detail: { value, file: entry?.file ?? null },
            bubbles: true,
            composed: true,
        }));
    }
}
