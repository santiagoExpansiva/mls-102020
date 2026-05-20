/// <mls fileReference="_102020_/l2/plugins/selectAssetsComponents.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Components',
    desc: 'Browse and insert reusable components from the current module into your project pages.',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Componentes',
        desc: 'Navegue e insira componentes reutilizáveis do módulo atual nas páginas do seu projeto.',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        title: 'Componentes',
        desc: 'Explore e inserte componentes reutilizables del módulo actual en las páginas de su proyecto.',
        inDevelopment: 'En desarrollo',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-assets-components-102020')
export class PluginSelectAssetsComponents extends StateLitElement {

    @property({ attribute: false }) selectedModule: IModule | null = null;
    @property({ attribute: false }) device: number | null = null;

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    createRenderRoot() { return this; }

    render() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, this.msg.desc)}
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

    private _renderHeader(title: string, description: string) {
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span class="text-lg font-semibold text-gray-700 dark:text-gray-200">${title}</span>
                <span class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                    ${description}
                </span>
            </div>
        `;
    }
}
