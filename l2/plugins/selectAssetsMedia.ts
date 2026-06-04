/// <mls fileReference="_102020_/l2/plugins/selectAssetsMedia.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { getAuraState } from '/_102020_/l2/auraState.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    category: 'Assets',
    title: 'Media',
    desc: 'Browse and manage media assets stored in the module assets folder.',
    searchPlaceholder: 'Search files…',
    addBtn: 'Add',
    uploadSelected: 'Selected file',
    uploadBtn: 'Upload',
    clearBtn: 'Clear',
    noFiles: 'No media files found in the assets folder.',
    noResults: 'No files match your search.',
    catAll: 'All',
    catImage: 'Images',
    catIcon: 'Icons',
    catVideo: 'Video',
    catAudio: 'Audio',
    catOther: 'Other',
    loading: 'Loading…',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        category: 'Assets',
        title: 'Mídia',
        desc: 'Navegue e gerencie assets de mídia na pasta de assets do módulo.',
        searchPlaceholder: 'Buscar arquivos…',
        addBtn: 'Adicionar',
        uploadSelected: 'Arquivo selecionado',
        uploadBtn: 'Enviar',
        clearBtn: 'Limpar',
        noFiles: 'Nenhum arquivo de mídia encontrado na pasta assets.',
        noResults: 'Nenhum arquivo corresponde à sua busca.',
        catAll: 'Todos',
        catImage: 'Imagens',
        catIcon: 'Ícones',
        catVideo: 'Vídeo',
        catAudio: 'Áudio',
        catOther: 'Outros',
        loading: 'Carregando…',
    },
    es: {
        category: 'Assets',
        title: 'Medios',
        desc: 'Explore y gestione archivos multimedia en la carpeta de assets del módulo.',
        searchPlaceholder: 'Buscar archivos…',
        addBtn: 'Agregar',
        uploadSelected: 'Archivo seleccionado',
        uploadBtn: 'Subir',
        clearBtn: 'Limpiar',
        noFiles: 'No se encontraron archivos multimedia en la carpeta assets.',
        noResults: 'Ningún archivo coincide con su búsqueda.',
        catAll: 'Todos',
        catImage: 'Imágenes',
        catIcon: 'Iconos',
        catVideo: 'Video',
        catAudio: 'Audio',
        catOther: 'Otros',
        loading: 'Cargando…',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

type MediaCategory = 'image' | 'icon' | 'video' | 'audio' | 'other';
type ViewMode = 'list' | 'preview' | 'grid';

interface IMediaFile {
    key: string;
    shortName: string;
    extension: string;
    folder: string;
    category: MediaCategory;
    size?: number;
}

const EXTENSION_MAP: Record<string, MediaCategory> = {
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image',
    '.webp': 'image', '.bmp': 'image', '.tiff': 'image', '.tif': 'image',
    '.svg': 'icon', '.ico': 'icon',
    '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.avi': 'video',
    '.mkv': 'video', '.wmv': 'video', '.m4v': 'video', '.flv': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio',
    '.aac': 'audio', '.m4a': 'audio', '.opus': 'audio', '.wma': 'audio',
};

const MEDIA_EXTENSIONS = new Set(Object.keys(EXTENSION_MAP));

const MY_SLOT = 3;
const ASSETS_MIN = 1;
const ASSETS_MAX = 3;

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-assets-media-102020')
export class PluginSelectAssetsMedia extends StateLitElement {

    @property({ attribute: false }) selectedModule: IModule | null = null;
    @property({ attribute: false }) device: number | null = null;

    @state() private _files: IMediaFile[] = [];
    @state() private _loading: boolean = false;
    @state() private _search: string = '';
    @state() private _viewMode: ViewMode = 'list';
    @state() private _activeCategory: MediaCategory | 'all' = 'all';
    @state() private _uploadFile: File | null = null;
    @state() private _uploadLoading: boolean = false;
    @state() private _uploadPreviewUrl: string | null = null;
    @state() private _deleteConfirm: string | null = null;

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('selectedModule')) {
            this._files = [];
            this._search = '';
            this._activeCategory = 'all';
            this._clearUpload();
            this._deleteConfirm = null;
            if (this.selectedModule) this._loadFiles();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._revokePreview();
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private _loadFiles() {
        if (!this.selectedModule) return;
        this._loading = true;
        this.requestUpdate();

        const project = getAuraState().actualProject;
        const assetsFolder = `${this.selectedModule.path}/assets`;

        // @ts-ignore
        const all: IMediaFile[] = Object.entries(mls.stor.files as Record<string, any>)
            .filter(([_, f]) =>
                f.project === project &&
                (f.folder === assetsFolder || f.folder.startsWith(assetsFolder + '/')) &&
                MEDIA_EXTENSIONS.has((f.extension ?? '').toLowerCase())
            )
            .map(([key, f]) => ({
                key,
                shortName: f.shortName ?? '',
                extension: (f.extension ?? '').toLowerCase(),
                folder: f.folder ?? '',
                category: (EXTENSION_MAP[(f.extension ?? '').toLowerCase()] ?? 'other') as MediaCategory,
                size: f.size as number | undefined,
            }));

        this._files = all.sort((a, b) =>
            `${a.shortName}${a.extension}`.localeCompare(`${b.shortName}${b.extension}`)
        );
        this._loading = false;
        this.requestUpdate();
    }

    private get _filtered(): IMediaFile[] {
        const q = this._search.toLowerCase();
        return this._files.filter(f => {
            if (this._activeCategory !== 'all' && f.category !== this._activeCategory) return false;
            if (!q) return true;
            return `${f.shortName}${f.extension}`.toLowerCase().includes(q);
        });
    }

    private get _counts(): Record<MediaCategory | 'all', number> {
        const c = { all: this._files.length, image: 0, icon: 0, video: 0, audio: 0, other: 0 };
        for (const f of this._files) c[f.category]++;
        return c;
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
                ${this._uploadFile ? this._renderUploadArea() : nothing}
                ${this._files.length > 0 ? this._renderCategoryTabs() : nothing}
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
                <button
                    class="
                        shrink-0 flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-md
                        bg-indigo-500 dark:bg-indigo-600 text-white
                        hover:bg-indigo-600 dark:hover:bg-indigo-500
                        transition-colors cursor-pointer whitespace-nowrap
                    "
                    @click=${() => this._openFilePicker()}
                >
                    ${this._svgPlus()}
                    ${this.msg.addBtn}
                </button>
                <input type="file" style="display:none" id="_media_file_input"
                    @change=${(e: Event) => this._onFileSelected(e)}
                />
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
                ${btn('list', this._svgList())}
                ${btn('preview', this._svgListPreview())}
                ${btn('grid', this._svgGrid())}
            </div>
        `;
    }

    // ─── Upload Area ─────────────────────────────────────────────────

    private _renderUploadArea() {
        const file = this._uploadFile!;
        const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
        const isImage = EXTENSION_MAP[ext] === 'image';
        return html`
            <div class="
                rounded-lg border border-indigo-200 dark:border-indigo-700/50
                bg-indigo-50 dark:bg-indigo-900/10 px-3 py-2.5 flex flex-col gap-2.5
            ">
                <div class="flex items-start gap-3">
                    <div class="
                        shrink-0 w-12 h-12 rounded-md overflow-hidden
                        bg-white dark:bg-gray-800
                        border border-indigo-100 dark:border-indigo-800
                        flex items-center justify-center
                    ">
                        ${isImage && this._uploadPreviewUrl
                            ? html`<img src=${this._uploadPreviewUrl} class="w-full h-full object-cover" />`
                            : html`<span class="text-indigo-400 dark:text-indigo-500">${this._svgCategoryIcon(EXTENSION_MAP[ext] ?? 'other', 24)}</span>`}
                    </div>
                    <div class="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span class="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                            ${this.msg.uploadSelected}
                        </span>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">${file.name}</span>
                        <div class="flex items-center gap-1.5">
                            ${this._renderExtBadge(ext)}
                            <span class="text-xs text-gray-400 dark:text-gray-500">${this._formatSize(file.size)}</span>
                        </div>
                    </div>
                    <button
                        class="shrink-0 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                        @click=${() => this._clearUpload()}
                    >${this._svgX()}</button>
                </div>
                <div class="flex justify-end gap-2">
                    <button
                        class="text-sm px-2.5 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                        @click=${() => this._clearUpload()}
                    >${this.msg.clearBtn}</button>
                    <button
                        class="
                            flex items-center gap-1.5 text-sm px-3 py-1 rounded-md transition-colors
                            ${this._uploadLoading
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-500 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer'}
                        "
                        ?disabled=${this._uploadLoading}
                        @click=${() => this._handleUpload()}
                    >
                        ${this._uploadLoading ? this._svgSpinner() : ''}
                        ${this.msg.uploadBtn}
                    </button>
                </div>
            </div>
        `;
    }

    // ─── Category Tabs ────────────────────────────────────────────────

    private _renderCategoryTabs() {
        const counts = this._counts;
        const cats: Array<{ key: MediaCategory | 'all'; label: string }> = [
            { key: 'all' as const,   label: this.msg.catAll   },
            { key: 'image' as const, label: this.msg.catImage },
            { key: 'icon' as const,  label: this.msg.catIcon  },
            { key: 'video' as const, label: this.msg.catVideo },
            { key: 'audio' as const, label: this.msg.catAudio },
            { key: 'other' as const, label: this.msg.catOther },
        ].filter(c => c.key === 'all' || counts[c.key as MediaCategory] > 0);

        return html`
            <div class="flex items-center gap-1 flex-wrap">
                ${cats.map(c => html`
                    <button
                        class="
                            flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors cursor-pointer
                            ${this._activeCategory === c.key
                                ? 'bg-indigo-500 dark:bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                        "
                        @click=${() => { this._activeCategory = c.key as any; }}
                    >
                        ${c.label}
                        <span class="font-mono opacity-70">${counts[c.key as MediaCategory | 'all']}</span>
                    </button>
                `)}
            </div>
        `;
    }

    // ─── Content ─────────────────────────────────────────────────────

    private _renderContent() {
        if (this._loading) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.loading}</span>`;
        }
        if (this._files.length === 0) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noFiles}</span>`;
        }
        const filtered = this._filtered;
        if (filtered.length === 0) {
            return html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`;
        }
        if (this._viewMode === 'grid') return this._renderGrid(filtered);
        if (this._viewMode === 'preview') return this._renderListPreview(filtered);
        return this._renderListShort(filtered);
    }

    private _renderListShort(files: IMediaFile[]) {
        return html`
            <div class="flex flex-col">
                ${files.map(f => html`
                    <div class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors group">
                        <span class="shrink-0 text-gray-400 dark:text-gray-500">
                            ${this._svgCategoryIcon(f.category, 14)}
                        </span>
                        <span class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                            ${f.shortName}${f.extension}
                        </span>
                        ${this._renderExtBadge(f.extension)}
                        ${this._renderDeleteBtn(f.key)}
                    </div>
                `)}
            </div>
        `;
    }

    private _renderListPreview(files: IMediaFile[]) {
        return html`
            <div class="flex flex-col gap-1">
                ${files.map(f => html`
                    <div class="
                        flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                        border border-gray-200 dark:border-gray-800
                        bg-gray-50 dark:bg-gray-900/50
                        hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors group
                    ">
                        <div class="
                            shrink-0 w-10 h-10 rounded-md
                            bg-gray-200 dark:bg-gray-700
                            flex items-center justify-center
                        ">
                            <span class="text-gray-500 dark:text-gray-400">
                                ${this._svgCategoryIcon(f.category, 20)}
                            </span>
                        </div>
                        <div class="flex flex-col flex-1 min-w-0">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                ${f.shortName}${f.extension}
                            </span>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                ${this._renderExtBadge(f.extension)}
                                ${f.size !== undefined
                                    ? html`<span class="text-xs text-gray-400 dark:text-gray-600">${this._formatSize(f.size)}</span>`
                                    : nothing}
                            </div>
                        </div>
                        ${this._renderDeleteBtn(f.key)}
                    </div>
                `)}
            </div>
        `;
    }

    private _renderGrid(files: IMediaFile[]) {
        return html`
            <div class="grid grid-cols-2 gap-2">
                ${files.map(f => html`
                    <div class="
                        flex flex-col rounded-xl
                        border border-gray-200 dark:border-gray-800
                        bg-white dark:bg-gray-900
                        overflow-hidden
                        hover:shadow-md dark:hover:shadow-black/30 transition-shadow group
                    ">
                        <div class="flex items-center justify-center bg-gray-100 dark:bg-gray-800/80 h-20">
                            <span class="text-gray-400 dark:text-gray-500">
                                ${this._svgCategoryIcon(f.category, 32)}
                            </span>
                        </div>
                        <div class="flex items-start gap-1 px-2 py-1.5">
                            <div class="flex-1 min-w-0">
                                <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">
                                    ${f.shortName}${f.extension}
                                </span>
                                ${f.size !== undefined
                                    ? html`<span class="text-[10px] text-gray-400 dark:text-gray-600">${this._formatSize(f.size)}</span>`
                                    : nothing}
                            </div>
                            ${this._renderDeleteBtn(f.key)}
                        </div>
                    </div>
                `)}
            </div>
        `;
    }

    // ─── Shared pieces ────────────────────────────────────────────────

    private _renderDeleteBtn(key: string) {
        const isPending = this._deleteConfirm === key;
        return html`
            <button
                class="
                    shrink-0 p-1 rounded transition-all cursor-pointer
                    ${isPending
                        ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400'}
                "
                @click=${(e: Event) => { e.stopPropagation(); this._handleDeleteClick(key); }}
            >${this._svgTrash()}</button>
        `;
    }

    private _renderExtBadge(ext: string) {
        return html`
            <span class="
                shrink-0 text-[10px] font-mono font-semibold px-1 py-0.5 rounded
                bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase
            ">${ext.replace('.', '')}</span>
        `;
    }

    // ─── Logic ───────────────────────────────────────────────────────

    private _openFilePicker() {
        const input = this.querySelector<HTMLInputElement>('#_media_file_input');
        input?.click();
    }

    private _onFileSelected(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        if (!file) return;
        this._revokePreview();
        this._uploadFile = file;
        const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
        if (EXTENSION_MAP[ext] === 'image') {
            this._uploadPreviewUrl = URL.createObjectURL(file);
        }
        input.value = '';
    }

    private async _handleUpload() {
        if (!this._uploadFile || !this.selectedModule) return;
        this._uploadLoading = true;
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('media-upload', {
            detail: {
                file: this._uploadFile,
                folder: `${this.selectedModule.path}/assets`,
            },
            bubbles: true,
            composed: true,
        }));
        this._uploadLoading = false;
        this._clearUpload();
    }

    private _handleDeleteClick(key: string) {
        if (this._deleteConfirm === key) {
            this._handleDelete(key);
        } else {
            this._deleteConfirm = key;
            setTimeout(() => {
                if (this._deleteConfirm === key) { this._deleteConfirm = null; this.requestUpdate(); }
            }, 3000);
        }
    }

    private async _handleDelete(key: string) {
        try {
            // @ts-ignore
            const f = mls.stor.files[key] as any;
            if (f?.deleteFile) await f.deleteFile();
            else if (f?.delete) await f.delete();
            this._files = this._files.filter(x => x.key !== key);
        } catch { /* ignore */ }
        this._deleteConfirm = null;
        this.requestUpdate();
    }

    private _clearUpload() {
        this._revokePreview();
        this._uploadFile = null;
        this._uploadPreviewUrl = null;
        this._uploadLoading = false;
    }

    private _revokePreview() {
        if (this._uploadPreviewUrl) URL.revokeObjectURL(this._uploadPreviewUrl);
    }

    private _formatSize(bytes?: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // ─── SVG Icons ───────────────────────────────────────────────────

    private _svgCategoryIcon(cat: MediaCategory | 'other', size = 16) {
        const s = size;
        switch (cat) {
            case 'image': return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
            case 'icon':  return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
            case 'video': return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="15" height="16" rx="2"/><path d="M17 8l5-4v16l-5-4V8z"/></svg>`;
            case 'audio': return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
            default:      return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
        }
    }

    private _svgPlus() {
        return html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    }
    private _svgTrash() {
        return html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    }
    private _svgX() {
        return html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    }
    private _svgList() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    }
    private _svgListPreview() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><line x1="12" y1="6.5" x2="21" y2="6.5"/><line x1="12" y1="12.5" x2="21" y2="12.5"/><line x1="12" y1="18.5" x2="21" y2="18.5"/></svg>`;
    }
    private _svgGrid() {
        return html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
    }
    private _svgSpinner() {
        return html`<div class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"></div>`;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-assets', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
