/// <mls fileReference="_102020_/l2/plugins/navHeader.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--nav-header-102020')
export class PluginNavHeader extends StateLitElement {

    @property({ attribute: false }) fixedLabel: string = '';
    @property({ attribute: false }) itemName: string = '';
    @property({ attribute: false }) desc: string = '';
    @property({ type: Number }) value: number = 0;
    @property({ type: Number }) min: number = 0;
    @property({ type: Number }) max: number = 1;

    createRenderRoot() { return this; }

    render() {
        const atMin = this.value <= this.min;
        const atMax = this.value >= this.max;
        const navBtn = (label: string, target: number, disabled: boolean) => html`
            <button
                class="px-1 py-0.5 rounded text-sm font-mono leading-none transition-colors
                    ${disabled
                        ? 'text-gray-300 dark:text-gray-700 cursor-default'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'}"
                ?disabled=${disabled}
                @click=${() => { if (!disabled) this._dispatch(target); }}
            >${label}</button>
        `;
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span class="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">${this.fixedLabel}</span>
                <div class="flex items-center">
                    <div class="flex items-center gap-0.5">
                        ${navBtn('«', this.min, atMin)}
                        ${navBtn('‹', this.value - 1, atMin)}
                    </div>
                    <span class="flex-1 text-center text-sm font-medium text-gray-500 dark:text-gray-400">${this.itemName}</span>
                    <div class="flex items-center gap-0.5">
                        ${navBtn('›', this.value + 1, atMax)}
                        ${navBtn('»', this.max, atMax)}
                    </div>
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">${this.desc}</span>
            </div>
        `;
    }

    private _dispatch(value: number) {
        this.dispatchEvent(new CustomEvent('nav-change', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
