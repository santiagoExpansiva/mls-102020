/// <mls fileReference="_102020_/l2/plugins/selectAssetsMedia.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    category: 'Assets',
    title: 'Media',
    desc: 'Browse and manage media assets such as images, videos, and fonts used in your project.',
    inDevelopment: 'In development',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        category: 'Assets',
        title: 'Mídia',
        desc: 'Navegue e gerencie assets de mídia como imagens, vídeos e fontes usados no seu projeto.',
        inDevelopment: 'Em desenvolvimento',
    },
    es: {
        category: 'Assets',
        title: 'Medios',
        desc: 'Explore y gestione activos multimedia como imágenes, videos y fuentes usados en su proyecto.',
        inDevelopment: 'En desarrollo',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

const MY_SLOT = 3;
const ASSETS_MIN = 1;
const ASSETS_MAX = 3;

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-assets-media-102020')
export class PluginSelectAssetsMedia extends StateLitElement {

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
