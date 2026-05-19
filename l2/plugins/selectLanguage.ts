/// <mls fileReference="_102020_/l2/plugins/selectLanguage.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Select Language',
    desc: 'The language defines the locale used for i18n content generation. Each language produces translated variations of the project pages.',
    needsProject: 'Select a project first to see the available languages.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Selecionar Idioma',
        desc: 'O idioma define o locale usado para geração de conteúdo i18n. Cada idioma produz variações traduzidas das páginas do projeto.',
        needsProject: 'Selecione um projeto primeiro para ver os idiomas disponíveis.',
    },
    es: {
        title: 'Seleccionar Idioma',
        desc: 'El idioma define el locale para la generación de contenido i18n. Cada idioma produce variaciones traducidas de las páginas del proyecto.',
        needsProject: 'Seleccione un proyecto primero para ver los idiomas disponibles.',
    },
};
/// **collab_i18n_end**

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-language-102020')
export class PluginSelectLanguage extends StateLitElement {

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
                    : this.value !== null ? this._renderLangCard() : nothing}
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

    private _renderLangCard() {
        const langCode = this._selectedLabel!;
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5 flex items-center gap-2
            ">
                <span class="
                    text-[10px] font-mono px-1.5 py-0.5 rounded
                    bg-emerald-100 dark:bg-emerald-900/30
                    text-emerald-600 dark:text-emerald-400
                    font-semibold uppercase tracking-wider
                ">${langCode}</span>
            </div>
        `;
    }
}
