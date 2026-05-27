/// <mls fileReference="_102020_/l2/plugins/selectDesignSystem.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Design System',
    desc: 'A design system defines the visual tokens (colors, typography, spacing) applied when generating components for this project.',
    needsProject: 'Select a project first to see the available design systems.',
    allTitle: 'All Design Systems',
    allDesc: 'Design systems configured for this project.',
    customTitle: 'New Design System',
    customDesc: 'Add a new design system to this project.',
    noDs: 'No design systems configured for this project.',
    loading: 'Loading design systems…',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Design System',
        desc: 'Um design system define os tokens visuais (cores, tipografia, espaçamentos) aplicados na geração de componentes do projeto.',
        needsProject: 'Selecione um projeto primeiro para ver os design systems disponíveis.',
        allTitle: 'Todos os Design Systems',
        allDesc: 'Design systems configurados neste projeto.',
        customTitle: 'Novo Design System',
        customDesc: 'Adicione um novo design system a este projeto.',
        noDs: 'Nenhum design system configurado neste projeto.',
        loading: 'Carregando design systems…',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        title: 'Design System',
        desc: 'Un sistema de diseño define los tokens visuales (colores, tipografía, espaciado) aplicados al generar componentes del proyecto.',
        needsProject: 'Seleccione un proyecto primero para ver los sistemas de diseño disponibles.',
        allTitle: 'Todos los Design Systems',
        allDesc: 'Design systems configurados en este proyecto.',
        customTitle: 'Nuevo Design System',
        customDesc: 'Añade un nuevo design system a este proyecto.',
        noDs: 'No hay design systems configurados en este proyecto.',
        loading: 'Cargando design systems…',
        inDevelopment: 'En desarrollo',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IDsEntry {
    key: number;
    name: string;
    skill: string;
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-design-system-102020')
export class PluginSelectDesignSystem extends StateLitElement {

    @property({ attribute: false }) projectId: number | null = null;
    @property({ attribute: false }) value: number | null = null;

    @state() private _entries: IDsEntry[] = [];
    @state() private _loading: boolean = false;

    connectedCallback() {
        super.connectedCallback();
        if (this.projectId) this._loadDsConfig(this.projectId);
    }

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('projectId')) {
            this._entries = [];
            if (this.projectId) this._loadDsConfig(this.projectId);
            else this._dispatchConfig();
        }
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private get _customKey(): number {
        if (!this._entries.length) return 1;
        return this._entries[this._entries.length - 1].key + 1;
    }

    private get _isAll(): boolean { return this.value === 0; }
    private get _isCustom(): boolean { return this.value !== null && this.value === this._customKey; }
    private get _selectedEntry(): IDsEntry | null {
        if (this.value === null || this.value <= 0) return null;
        return this._entries.find(e => e.key === this.value) ?? null;
    }

    // ─── Loading ──────────────────────────────────────────────────────

    private async _loadDsConfig(projectId: number): Promise<void> {
        this._loading = true;
        this.requestUpdate();
        try {
            const mod = await import(`/_${projectId}_/l2/project.js`);
            const dsMap: Record<number, { name: string; skill: string }> = mod?.projectConfig?.designSystems ?? {};
            const keys = Object.keys(dsMap).map(Number).sort((a, b) => a - b);
            this._entries = keys.map(k => ({ key: k, name: dsMap[k].name, skill: dsMap[k].skill ?? '' }));
        } catch {
            this._entries = [];
        }
        this._loading = false;
        this._dispatchConfig();
        this.requestUpdate();
    }

    private _dispatchConfig(): void {
        const labels: Record<number, string> = { 0: 'All' };
        this._entries.forEach(e => { labels[e.key] = e.name; });
        labels[this._customKey] = '+';
        this.dispatchEvent(new CustomEvent('ds-config', {
            detail: { min: 0, max: this._customKey, labels },
            bubbles: true,
            composed: true,
        }));
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.projectId) return this._renderNeedsProject();
        if (this._loading) return this._renderLoading();
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
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

    private _renderAll() {
        const max = this._customKey;
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
                ${this._entries.length === 0
                    ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noDs}</span>`
                    : html`<div class="flex flex-col gap-1.5">
                        ${this._entries.map(e => this._renderDsCard(e))}
                    </div>`}
            </div>
        `;
    }

    private _renderSelected() {
        const entry = this._selectedEntry;
        const max = this._customKey;
        if (!entry) return nothing;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${entry.name}
                    .desc=${this.msg.desc}
                    .value=${this.value ?? 0}
                    .min=${0}
                    .max=${max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                <div class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 flex items-center gap-2">
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">${entry.name}</span>
                    <span class="ml-auto text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">#${entry.key}</span>
                </div>
            </div>
        `;
    }

    private _renderCustom() {
        const max = this._customKey;
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
                ${this._renderNotice(this.msg.inDevelopment)}
            </div>
        `;
    }

    // ─── Shared helpers ───────────────────────────────────────────────

    private _renderDsCard(entry: IDsEntry) {
        return html`
            <div
                class="
                    rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    hover:bg-gray-100 dark:hover:bg-gray-800/70
                    px-3 py-2.5 flex items-center gap-2
                    cursor-pointer transition-colors
                "
                @click=${() => this._dispatchSelect(entry.key)}
            >
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${entry.name}</span>
                <span class="ml-auto text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">#${entry.key}</span>
            </div>
        `;
    }

    private _renderHeader(title: string, description: string) {
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span class="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">${title}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">${description}</span>
            </div>
        `;
    }

    private _renderNotice(text: string) {
        return html`
            <div class="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                <span class="text-sm text-amber-600 dark:text-amber-400 leading-relaxed">${text}</span>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-ds', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
