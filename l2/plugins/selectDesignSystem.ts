/// <mls fileReference="_102020_/l2/plugins/selectDesignSystem.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Select Design System',
    desc: 'A design system defines the visual tokens (colors, typography, spacing) applied when generating components for this project.',
    needsProject: 'Select a project first to see the available design systems.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Selecionar Design System',
        desc: 'Um design system define os tokens visuais (cores, tipografia, espaçamentos) aplicados na geração de componentes do projeto.',
        needsProject: 'Selecione um projeto primeiro para ver os design systems disponíveis.',
    },
    es: {
        title: 'Seleccionar Design System',
        desc: 'Un sistema de diseño define los tokens visuales (colores, tipografía, espaciado) aplicados al generar componentes del proyecto.',
        needsProject: 'Seleccione un proyecto primero para ver los sistemas de diseño disponibles.',
    },
};
/// **collab_i18n_end**

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-design-system-102020')
export class PluginSelectDesignSystem extends StateLitElement {

    @property({ type: Boolean }) projectSelected: boolean = false;
    @property({ attribute: false }) value: number | null = null;
    @property({ attribute: false }) labels: Record<number, string> = {};

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    private get _selectedLabel(): string | null {
        if (this.value === null) return null;
        return this.labels[this.value] ?? null;
    }

    createRenderRoot() { return this; }

    render() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, this._selectedLabel, this.msg.desc)}
                ${!this.projectSelected
                    ? this._renderNotice(this.msg.needsProject)
                    : this.value !== null ? this._renderDsCard() : nothing}
            </div>
        `;
    }

    private _renderHeader(title: string, badge: string | null, description: string) {
        return html`
            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">${title}</span>
                    ${badge ? html`
                        <span class="
                            text-[10px] font-mono px-1.5 py-0.5 rounded
                            bg-gray-100 dark:bg-gray-800
                            text-gray-500 dark:text-gray-400
                        ">${badge}</span>
                    ` : nothing}
                </div>
                <span class="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
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

    private _renderDsCard() {
        const label = this._selectedLabel!;
        const isCustom = label === 'Custom';
        return html`
            <div class="
                rounded-lg border
                ${isCustom
                    ? 'border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/10'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'}
                px-3 py-2.5
            ">
                <span class="
                    text-xs font-medium
                    ${isCustom ? 'text-violet-600 dark:text-violet-400' : 'text-gray-700 dark:text-gray-300'}
                ">${label}</span>
            </div>
        `;
    }
}
