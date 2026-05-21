/// <mls fileReference="_102020_/l2/plugins/selectAssetsComponents.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    category: 'Assets',
    title: 'Components',
    desc: 'Browse and insert reusable components from the current module into your project pages.',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        category: 'Assets',
        title: 'Componentes',
        desc: 'Navegue e insira componentes reutilizáveis do módulo atual nas páginas do seu projeto.',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        category: 'Assets',
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

const MY_SLOT = 1;
const ASSETS_MIN = 1;
const ASSETS_MAX = 3;

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
                <plugins--nav-header-102020
                    .fixedLabel=${this.msg.category}
                    .itemName=${this.msg.title}
                    .desc=${this.msg.desc}
                    .value=${MY_SLOT}
                    .min=${ASSETS_MIN}
                    .max=${ASSETS_MAX}
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

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-assets', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
