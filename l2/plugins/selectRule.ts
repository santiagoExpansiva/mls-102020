/// <mls fileReference="_102020_/l2/plugins/selectRule.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import '/_102020_/l2/plugins/navHeader.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Rules',
    desc: 'Business rules and policies that govern this module.',
    allTitle: 'All Rules',
    allDesc: 'All rules defined in this module.',
    noModule: 'No module selected.',
    noRules: 'No rules found in this module.',
    noResults: 'No rules match your search.',
    searchPlaceholder: 'Search rules…',
    scope: 'Scope',
    acceptanceCriteria: 'Acceptance Criteria',
    allKinds: 'All',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Regras',
        desc: 'Regras de negócio e políticas que governam este módulo.',
        allTitle: 'Todas as Regras',
        allDesc: 'Todas as regras definidas neste módulo.',
        noModule: 'Nenhum módulo selecionado.',
        noRules: 'Nenhuma regra encontrada neste módulo.',
        noResults: 'Nenhuma regra corresponde à sua busca.',
        searchPlaceholder: 'Buscar regras…',
        scope: 'Escopo',
        acceptanceCriteria: 'Critérios de Aceitação',
        allKinds: 'Todas',
    },
    es: {
        title: 'Reglas',
        desc: 'Reglas de negocio y políticas que rigen este módulo.',
        allTitle: 'Todas las Reglas',
        allDesc: 'Todas las reglas definidas en este módulo.',
        noModule: 'Ningún módulo seleccionado.',
        noRules: 'No se encontraron reglas en este módulo.',
        noResults: 'Ninguna regla coincide con su búsqueda.',
        searchPlaceholder: 'Buscar reglas…',
        scope: 'Ámbito',
        acceptanceCriteria: 'Criterios de Aceptación',
        allKinds: 'Todas',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

interface IRuleEntry {
    id: string;
    kind: string;
    description: string;
    scope: string[];
    acceptanceCriteria: string[];
}

// ─── Constants ───────────────────────────────────────────────────────

const KIND_STYLES: Record<string, string> = {
    policy:     'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
    domain:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    constraint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    behavior:   'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
};
const KIND_DEFAULT = 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700';

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-rule-102020')
export class PluginSelectRule extends StateLitElement {

    @property({ attribute: false }) selectedModule: IModule | null = null;
    @property({ attribute: false }) value: number | null = 0;

    @state() private _rules: IRuleEntry[] = [];
    @state() private _search: string = '';
    @state() private _kindFilter: string = '';

    connectedCallback() {
        super.connectedCallback();
        this._loadRules();
    }

    willUpdate(changed: Map<string, unknown>) {
        if (changed.has('selectedModule')) {
            this._search = '';
            this._kindFilter = '';
            this._loadRules();
        }
        if (changed.has('value')) {
            this._search = '';
        }
    }

    private get msg(): MessageType {
        return messages[this.getMessageKey(messages)];
    }

    private get _isAll(): boolean { return this.value === 0; }
    private get _selectedRule(): IRuleEntry | null {
        if (this.value === null || this.value <= 0 || this.value > this._rules.length) return null;
        return this._rules[this.value - 1];
    }
    private get _kinds(): string[] {
        return [...new Set(this._rules.map(r => r.kind))].sort();
    }

    // ─── Data Loading ─────────────────────────────────────────────────

    private async _loadRules(): Promise<void> {
        this._rules = [];
        const modulePath = this._modulePath;
        if (!modulePath) {
            this._dispatchConfig();
            return;
        }

        const project: number = mls.actualProject as number;

        try {
            const mod = await import(`/_${project}_/l2/${modulePath}/module.defs.js`);
            const rulesMap: Record<string, any> = mod?.ontology?.rules ?? {};
            this._rules = Object.entries(rulesMap).map(([id, r]) => ({
                id,
                kind: r.kind ?? 'unknown',
                description: r.description ?? '',
                scope: Array.isArray(r.scope) ? r.scope : [],
                acceptanceCriteria: Array.isArray(r.acceptanceCriteria) ? r.acceptanceCriteria : [],
            }));
        } catch {
            this._rules = [];
        }

        this._dispatchConfig();
        // @ts-ignore
        this.requestUpdate();
    }

    private _dispatchConfig() {
        const labels: Record<number, string> = { 0: 'All' };
        this._rules.forEach((r, i) => { labels[i + 1] = r.id; });
        this.dispatchEvent(new CustomEvent('rule-config', {
            detail: { min: 0, max: this._rules.length, labels },
            bubbles: true,
            composed: true,
        }));
    }

    createRenderRoot() { return this; }

    private get _modulePath(): string | null {
        return this.selectedModule?.path ?? mls.actualModule ?? null;
    }

    render() {
        if (!this._modulePath) return this._renderNoModule();
        if (this._isAll) return this._renderAll();
        return this._renderSelected();
    }

    // ─── Scenario renders ─────────────────────────────────────────────

    private _renderNoModule() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(0, 1, this.msg.allTitle)}
                <div class="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                    <span class="text-sm text-amber-600 dark:text-amber-400">${this.msg.noModule}</span>
                </div>
            </div>
        `;
    }

    private _renderHeader(value: number, max: number, itemName: string, desc = this.msg.desc) {
        return html`
            <plugins--nav-header-102020
                .fixedLabel=${this.msg.title}
                .itemName=${itemName}
                .desc=${desc}
                .value=${value}
                .min=${0}
                .max=${max}
                @nav-change=${(e: CustomEvent) => this._dispatchSelect(e.detail.value)}
            ></plugins--nav-header-102020>
        `;
    }

    private _renderAll() {
        const q = this._search.toLowerCase();
        const max = this._rules.length;
        const filtered = this._rules
            .map((r, i) => ({ r, selectValue: i + 1 }))
            .filter(({ r }) =>
                (!this._kindFilter || r.kind === this._kindFilter) &&
                (!q || r.id.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
            );

        return html`
            <div class="flex flex-col flex-1 overflow-hidden gap-3">
                ${this._renderHeader(0, max, this.msg.allTitle, this.msg.allDesc)}

                ${this._kinds.length > 1 ? html`
                    <div class="flex flex-wrap gap-1.5 shrink-0">
                        <button
                            class="text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer
                                ${!this._kindFilter
                                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-transparent'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'}"
                            @click=${() => { this._kindFilter = ''; }}
                        >${this.msg.allKinds}</button>
                        ${this._kinds.map(k => html`
                            <button
                                class="text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer
                                    ${this._kindFilter === k
                                        ? KIND_STYLES[k] ?? KIND_DEFAULT
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'}"
                                @click=${() => { this._kindFilter = k; }}
                            >${k}</button>
                        `)}
                    </div>
                ` : nothing}

                <input
                    type="text"
                    .value=${this._search}
                    placeholder=${this.msg.searchPlaceholder}
                    class="w-full shrink-0 text-sm px-2.5 py-1.5 rounded-md
                        border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900
                        text-gray-700 dark:text-gray-300
                        placeholder-gray-400 dark:placeholder-gray-600
                        focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600"
                    @input=${(e: Event) => { this._search = (e.target as HTMLInputElement).value; }}
                />

                <div class="flex-1 overflow-y-auto min-h-0">
                    ${this._rules.length === 0
                        ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noRules}</span>`
                        : filtered.length === 0
                            ? html`<span class="text-sm text-gray-400 dark:text-gray-600 italic">${this.msg.noResults}</span>`
                            : html`
                                <div class="flex flex-col gap-1.5">
                                    ${filtered.map(({ r, selectValue }) => this._renderRuleCard(r, selectValue))}
                                </div>
                            `}
                </div>
            </div>
        `;
    }

    private _renderSelected() {
        const rule = this._selectedRule;
        const max = this._rules.length;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.value ?? 0, max, rule?.id ?? '')}
                ${rule ? this._renderRuleDetail(rule) : nothing}
            </div>
        `;
    }

    // ─── Card & Detail ────────────────────────────────────────────────

    private _renderRuleCard(rule: IRuleEntry, selectValue: number) {
        const kindStyle = KIND_STYLES[rule.kind] ?? KIND_DEFAULT;
        return html`
            <div
                class="rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50
                    hover:bg-gray-100 dark:hover:bg-gray-800/70
                    px-3 py-2.5 flex flex-col gap-1.5
                    cursor-pointer transition-colors"
                @click=${() => this._dispatchSelect(selectValue)}
            >
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${kindStyle}">${rule.kind}</span>
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">${rule.id}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">${rule.description}</p>
                ${rule.scope.length > 0 ? html`
                    <div class="flex flex-wrap gap-1">
                        ${rule.scope.map(s => html`
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">${s}</span>
                        `)}
                    </div>
                ` : nothing}
            </div>
        `;
    }

    private _renderRuleDetail(rule: IRuleEntry) {
        const kindStyle = KIND_STYLES[rule.kind] ?? KIND_DEFAULT;
        return html`
            <div class="flex flex-col gap-3">
                <div class="rounded-lg border border-gray-200 dark:border-gray-800
                    bg-gray-50 dark:bg-gray-900/50 px-3 py-3 flex flex-col gap-2.5">

                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${kindStyle}">${rule.kind}</span>
                        <span class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">${rule.id}</span>
                    </div>

                    <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${rule.description}</p>

                    ${rule.scope.length > 0 ? html`
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">${this.msg.scope}</span>
                            <div class="flex flex-wrap gap-1">
                                ${rule.scope.map(s => html`
                                    <span class="text-xs px-2 py-0.5 rounded-full
                                        bg-gray-100 dark:bg-gray-800
                                        text-gray-600 dark:text-gray-300
                                        border border-gray-200 dark:border-gray-700">${s}</span>
                                `)}
                            </div>
                        </div>
                    ` : nothing}
                </div>

                ${rule.acceptanceCriteria.length > 0 ? html`
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 px-0.5">
                            ${this.msg.acceptanceCriteria}
                        </span>
                        <div class="flex flex-col gap-1">
                            ${rule.acceptanceCriteria.map(c => html`
                                <div class="flex gap-2 px-2 py-1.5 rounded-md
                                    bg-gray-50 dark:bg-gray-900/50
                                    border border-gray-100 dark:border-gray-800/60">
                                    <span class="text-indigo-400 dark:text-indigo-500 shrink-0 mt-0.5">✓</span>
                                    <span class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">${c}</span>
                                </div>
                            `)}
                        </div>
                    </div>
                ` : nothing}
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-rule', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
