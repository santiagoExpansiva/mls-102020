/// <mls fileReference="_102020_/l2/plugins/selectDesignSystem.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Design System',
    desc: 'A design system defines the visual tokens (colors, typography, spacing) applied when generating components for this project.',
    needsProject: 'Select a project first to see the available design systems.',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Design System',
        desc: 'Um design system define os tokens visuais (cores, tipografia, espaçamentos) aplicados na geração de componentes do projeto.',
        needsProject: 'Selecione um projeto primeiro para ver os design systems disponíveis.',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        title: 'Design System',
        desc: 'Un sistema de diseño define los tokens visuales (colores, tipografía, espaciado) aplicados al generar componentes del proyecto.',
        needsProject: 'Seleccione un proyecto primero para ver los sistemas de diseño disponibles.',
        inDevelopment: 'En desarrollo',
    },
};
/// **collab_i18n_end**

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-design-system-102020')
export class PluginSelectDesignSystem extends StateLitElement {

    @property({ type: Boolean }) projectSelected: boolean = false;
    @property({ attribute: false }) value: number | null = null;
    @property({ attribute: false }) labels: Record<number, string> = {};
    @property({ type: Number }) min: number = 1;
    @property({ type: Number }) max: number = 3;

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.projectSelected || this.value === null) {
            return html`
                <div class="flex flex-col gap-3">
                    ${this._renderStaticHeader(this.msg.title, this.msg.desc)}
                    ${this._renderNotice(this.msg.needsProject)}
                </div>
            `;
        }
        const v = this.value;
        const itemName = this.labels[v] ?? `${v}`;
        return html`
            <div class="flex flex-col gap-3">
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.title}
                    .itemName=${itemName}
                    .desc=${this.msg.desc}
                    .value=${v}
                    .min=${this.min}
                    .max=${this.max}
                    @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
                ></plugins--nav-header-102020>
                ${this._renderInDevelopment()}
            </div>
        `;
    }

    private _renderStaticHeader(title: string, description: string) {
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

    private _renderInDevelopment() {
        return html`
            <div class="
                rounded-lg border border-amber-200 dark:border-amber-800/40
                bg-amber-50 dark:bg-amber-900/10
                px-3 py-2.5
            ">
                <span class="text-sm text-amber-600 dark:text-amber-400">${this.msg.inDevelopment}</span>
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
