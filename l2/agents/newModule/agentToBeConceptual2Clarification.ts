/// <mls fileReference="_102020_/l2/agents/newModule/agentToBeConceptual2Clarification.ts" enhancement="_102027_/l2/enhancementLit" />

import { html, nothing } from 'lit';
import { customElement, state, property, query } from 'lit/decorators.js';
import { CollabLitElement } from '/_102027_/l2/collabLitElement.js';
import { Suggestion } from '/_102020_/l2/agents/newModule/agentToBeConceptual2.js'
import { ModuleToBe, RulesRegistry, EntityDefinition, CapabilityDefinition } from '/_102020_/l2/agents/newModule/agentToBeConceptual.js' 

type Tab = 'suggestions' | 'entities' | 'rules' | 'capabilities';
type SuggestionItem = Suggestion & {
    selected: boolean;
    custom?: boolean;
};

type Editors = {
    rules: monaco.editor.IStandaloneCodeEditor | undefined,
    entities: monaco.editor.IStandaloneCodeEditor | undefined,
    capabilities: monaco.editor.IStandaloneCodeEditor | undefined,
}



@customElement('agents--new-module--agent-to-be-conceptual2-clarification-102020')
export class AgentToBeConceptual2Clarification extends CollabLitElement {

    @property({ type: Number }) entitiesCount = 0;
    @property({ type: Number }) rulesCount = 0;
    @property({ type: Number }) capabilitiesCount = 0;
    @property({ type: Array }) suggestions: Suggestion[] = [];

    @property() toBe?: ModuleToBe;

    @state() rules?: RulesRegistry;
    @state() capabilities?: CapabilityDefinition;
    @state() entities?: Record<string, EntityDefinition> | undefined;

    get suggestionsCount() {
        return this.suggestionState.filter(s => s.selected).length;
    }

    @query('div.editorEntities')
    private editorEntities?: HTMLElement;

    @query('div.editorRules')
    private editorRules?: HTMLElement

    @query('div.editorCapabilities')
    private editorCapabilities?: HTMLElement

    @state()
    private badgePop = false;

    @state()
    private suggestionState: SuggestionItem[] = [];

    @state()
    private isAdding = false;

    @state()
    private activeTab: Tab = 'suggestions';


    private editors: Editors = {
        rules: undefined,
        entities: undefined,
        capabilities: undefined,
    }

    private renderedTabs = new Set<Tab>(['suggestions']);

    firstUpdated(changed: Map<string, any>) {
        this.suggestionState = this.suggestions.map(s => ({
            ...s,
            selected: s.yagni === 'now'
        }));

        if (!this.toBe) return;

        this.rules = this.toBe.rules || {};
        this.capabilities = this.toBe.capabilities || {};
        this.entities = this.toBe.ontology?.entities || {};
        this.rulesCount = Object.keys(this.rules || {}).length;
        this.capabilitiesCount = Object.keys(this.capabilities || {}).length;
        this.entitiesCount = Object.keys(this.entities || {}).length;

    }

    updated(changed: Map<string, any>) {
        if (changed.has('activeTab') && this.activeTab !== 'suggestions') {
            this.createEditor(this.activeTab);
        }

    }

    private getValue(mode: 'rules' | 'capabilities' | 'entities') {
        const values = {
            'rules': JSON.stringify(this.rules, null, 2),
            'capabilities': JSON.stringify(this.capabilities, null, 2),
            'entities': JSON.stringify(this.entities, null, 2),
        }
        return values[mode];
    }

    private setTab(tab: Tab) {
        if (!this.renderedTabs.has(tab)) {
            this.renderedTabs.add(tab);
        }

        this.activeTab = tab;
    }

    private triggerBadgePop() {
        this.badgePop = true;

        requestAnimationFrame(() => {
            setTimeout(() => {
                this.badgePop = false;
            }, 160);
        });
    }

    private renderTabButton(tab: Tab, label: unknown, count?: number) {
        return html`
            <button
                class="tab ${this.activeTab === tab ? 'active' : ''}"
                @click=${() => this.setTab(tab)}
            >
                ${label}
                ${count ? html`
                    <span class="badge ${tab === 'suggestions' && this.badgePop ? 'pop' : ''}">
                        ${count}
                    </span>
            ` : nothing}
            </button>
        `;
    }

    /* ---------------------------
     * Editor
     * --------------------------- */

    private getEditorEl(mode: 'rules' | 'capabilities' | 'entities') {
        if (mode === 'rules') return this.editorRules;
        else if (mode === 'capabilities') return this.editorCapabilities;
        else if (mode === 'entities') return this.editorEntities;
    }


    private createEditor(mode: 'rules' | 'capabilities' | 'entities'): void {
        if (this.editors[mode]) return;

        const el = this.getEditorEl(mode);
        if (!el) return;

        requestAnimationFrame(() => {
            this.editors[mode] = monaco.editor.create(el, {
                automaticLayout: true,
                readOnly: true,
                minimap: {
                    enabled: false
                }
            });
            this.setInitialEditorValue(this.getValue(mode), mode);
        });
    }

    private setInitialEditorValue(value: string, mode: 'rules' | 'capabilities' | 'entities') {
        const model = this.createOrGetModel('json', value, mode);
        this.editors[mode]?.setModel(model);
    }

    private createOrGetModel(editorType: string, src: string, mode: 'rules' | 'capabilities' | 'entities') {
        const uri = this.getUri(`${this.constructor.name}`, mode);
        let model1 = monaco.editor.getModel(uri);
        if (!model1) model1 = monaco.editor.createModel(src, editorType, uri);
        return model1;
    }

    private getUri(shortFN: string, mode: 'rules' | 'capabilities' | 'entities'): monaco.Uri {
        return monaco.Uri.parse(`file://server/${shortFN}_${mode}.ts`);
    }


    /* ---------------------------
     * Lazy content
     * --------------------------- */

    private renderPanel(tab: Tab) {
        if (!this.renderedTabs.has(tab)) return nothing;

        return html`
        <div class="panel ${this.activeTab === tab ? 'show' : ''}">
            ${this.renderTabContent(tab)}
        </div>
    `;
    }

    private renderTabContent(tab: Tab) {
        switch (tab) {
            case 'suggestions':
                return this.renderContentSuggestions();

            case 'entities':
                return this.renderContentEntities();

            case 'rules':
                return this.renderContentRules();

            case 'capabilities':
                return this.renderContentCapabilities();

            default:
                return nothing;
        }
    }


    /* ---------------------------
     * Render
     * --------------------------- */

    render() {
        return html`
            <div class="container">

                <div class="tabs">
                    ${this.renderTabButton('suggestions', html`Suggestions ${this.suggestionsCount
            ? html`<span class="badge selected-info ${this.badgePop ? 'pop' : ''}">${this.suggestionsCount} selected</span>`
            : nothing}`
        )}
                                
                    ${this.renderTabButton('entities', 'Entities', this.entitiesCount)}
                    ${this.renderTabButton('rules', 'Rules', this.rulesCount)}
                    ${this.renderTabButton('capabilities', 'Capabilities', this.capabilitiesCount)}
                </div>

                <div class="content">
                    ${this.renderPanel('suggestions')}
                    ${this.renderPanel('entities')}
                    ${this.renderPanel('rules')}
                    ${this.renderPanel('capabilities')}
                </div>

            </div>
        `;
    }

    private renderContentEntities() {
        return html`<div class="editorEntities"></div>`;
    }

    private renderContentRules() {
        return html`<div class="editorRules"></div>`;

    }

    private renderContentCapabilities() {
        return html`<div class="editorCapabilities"></div>`;
    }

    private renderContentSuggestions() {

        return html`
        <div class="suggestions">

        <div class="actions">
            <button type="button" class="action-btn cancel" @click=${() => { this.onAction('cancel') }}>Cancel</button>
            <button type="button" class="action-btn continue" @click=${() => { this.onAction('continue') }} >Continue</button>
        </div>

            ${this.suggestionState.map((s, i) =>
            this.renderSuggestionCard(s, i)
        )}
            ${this.renderAddSuggestion()}
        </div>
    `;
    }

    private onAction(action: 'cancel' | 'continue') {

        const value = this.suggestionState.map(({ custom, selected, ...rest }) => rest);

        this.dispatchEvent(
            new CustomEvent('clarification-finish', {
                detail: {
                    value,
                    action
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private toggleSuggestion(index: number) {
        this.suggestionState[index].selected =
            !this.suggestionState[index].selected;

        if (this.suggestionState[index].selected) this.suggestionState[index].yagni = 'now';
        else this.suggestionState[index].yagni = 'later';
        this.triggerBadgePop();
        this.requestUpdate();
    }


    private renderSuggestionCard(s: SuggestionItem, index: number) {
        return html`
        <div
            class="card ${s.selected ? 'selected' : ''}"
            @click=${() => this.toggleSuggestion(index)}
        >

            <input
                type="checkbox"
                .checked=${s.selected}
                @click=${(e: Event) => e.stopPropagation()}
                @change=${() => this.toggleSuggestion(index)}
            />

            <div class="body">
                <div class="title">${s.suggestion}</div>
                <div class="desc">${s.customerPerception}</div>

                <div class="meta">
                    <span class="yagni ${s.yagni}">${s.yagni}</span>
                    ${s.businessImpact.map(b =>
            html`<span class="tag">${b}</span>`
        )}
                </div>
            </div>

            ${s.custom ? html`
                <button
                    class="remove"
                    @click=${(e: Event) => {
                    e.stopPropagation();
                    this.removeSuggestion(index);
                }}
                >
                    ✕
                </button>
            ` : nothing}

        </div>
    `;
    }



    private addSuggestion(text: string) {
        if (!text.trim()) return;

        this.suggestionState = [
            ...this.suggestionState,
            {
                suggestion: text,
                customerPerception: '',
                businessImpact: [],
                requiresConfiguration: false,
                yagni: 'now',
                selected: true,
                custom: true
            }
        ];
        this.triggerBadgePop();
        this.isAdding = false;
    }

    private removeSuggestion(index: number) {
        this.suggestionState = this.suggestionState.filter((_, i) => i !== index);
        this.triggerBadgePop();

    }

    private renderAddSuggestion() {
        if (this.isAdding) {
            return html`
            <input
                class="add-input"
                placeholder="Nova sugestão..."
                @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        this.addSuggestion((e.target as HTMLInputElement).value);
                    }
                }}
                autofocus
            />
        `;
        }

        return html`
        <button class="add-btn" @click=${() => this.isAdding = true}>
            + Add suggestion
        </button>
    `;
    }
}

