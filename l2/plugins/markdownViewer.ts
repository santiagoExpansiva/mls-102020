/// <mls fileReference="_102020_/l2/plugins/markdownViewer.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── marked (lazy CDN load) ───────────────────────────────────────────
let _markedFn: ((text: string) => string) | null = null;
let _markedLoading = false;

async function _loadMarked(): Promise<void> {
    if (_markedFn || _markedLoading) return;
    _markedLoading = true;
    const url = 'https://esm.sh/marked@15';
    const mod = await (import(url) as Promise<any>);
    _markedFn = (text: string) => mod.marked.parse(text) as string;
}

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: { edit: 'Editar', cancel: 'Cancelar', save: 'Salvar' },
    es: { edit: 'Editar', cancel: 'Cancelar', save: 'Guardar' },
};
/// **collab_i18n_end**

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--markdown-viewer-102020')
export class PluginMarkdownViewer extends StateLitElement {

    @property({ attribute: false }) text: string = '';

    @state() private _editing: boolean = false;
    @state() private _editText: string = '';

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    connectedCallback() {
        super.connectedCallback();
        _loadMarked().then(() => this.requestUpdate());
    }

    createRenderRoot() { return this; }

    updated() {
        if (this._editing) {
            this._resizeTextarea();
        } else {
            const el = this.querySelector('[data-md]') as HTMLElement | null;
            if (!el) return;
            el.innerHTML = (_markedFn && this.text?.trim())
                ? _markedFn(this.text)
                : '<span style="font-style:italic;opacity:0.4">—</span>';
        }
    }

    private _resizeTextarea() {
        const ta = this.querySelector('textarea') as HTMLTextAreaElement | null;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    }

    render() {
        return this._editing ? this._renderEdit() : this._renderView();
    }

    private _renderView() {
        return html`
            <div class="flex items-start gap-2">
                <div
                    data-md
                    class="flex-1 min-w-0 text-xs text-gray-500 dark:text-gray-400 leading-relaxed"
                ></div>
                <button
                    class="
                        shrink-0 text-[10px] px-2 py-0.5 rounded
                        border border-gray-200 dark:border-gray-700
                        text-gray-400 dark:text-gray-600
                        hover:text-gray-600 dark:hover:text-gray-400
                        hover:border-gray-300 dark:hover:border-gray-600
                        transition-colors
                    "
                    @click=${() => { this._editText = this.text ?? ''; this._editing = true; }}
                >${this.msg.edit}</button>
            </div>
        `;
    }

    private _renderEdit() {
        return html`
            <textarea
                class="
                    w-full text-xs font-mono leading-relaxed resize-none overflow-hidden
                    bg-white dark:bg-gray-900
                    border border-gray-300 dark:border-gray-700 rounded-md
                    px-2.5 py-2
                    text-gray-700 dark:text-gray-300
                    focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600
                "
                .value=${this._editText}
                @input=${(e: Event) => {
                    this._editText = (e.target as HTMLTextAreaElement).value;
                    this._resizeTextarea();
                }}
            ></textarea>
            <div class="flex justify-end gap-2 mt-2">
                <button
                    class="
                        text-xs px-3 py-1 rounded
                        border border-gray-200 dark:border-gray-700
                        text-gray-500 dark:text-gray-400
                        hover:bg-gray-100 dark:hover:bg-gray-800
                        transition-colors
                    "
                    @click=${() => { this._editing = false; }}
                >${this.msg.cancel}</button>
                <button
                    class="
                        text-xs px-3 py-1 rounded
                        bg-indigo-500 dark:bg-indigo-600 text-white
                        hover:bg-indigo-600 dark:hover:bg-indigo-500
                        transition-colors
                    "
                    @click=${() => { this._save(); }}
                >${this.msg.save}</button>
            </div>
        `;
    }

    private _save() {
        this.dispatchEvent(new CustomEvent('md-save', {
            detail: { value: this._editText },
            bubbles: true,
            composed: true,
        }));
        this._editing = false;
    }
}
