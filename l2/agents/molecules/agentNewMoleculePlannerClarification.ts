/// <mls fileReference="_102020_/l2/agents/molecules/agentNewMoleculePlannerClarification.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { convertFileToTag } from "/_102020_/l2/utils.js";
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

/// **collab_i18n_start**
const message_pt = {
    title: 'Clarification',
    fileReference: 'Referência do Arquivo',
    description: 'Descrição',
    prompt: 'Prompt Final',
    group: 'Grupo',
    functionalRequirements: 'Requisitos Funcionais',
    visualRequirements: 'Requisitos Visuais',
    clickToEdit: 'Clique para editar',
    save: 'Salvar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    addRequirement: '+ Adicionar Requisito',
    newFunctionalRequirement: 'Novo requisito funcional',
    newVisualRequirement: 'Novo requisito visual',
    edit: 'Editar',
    remove: 'Remover'
};

const message_en = {
    title: 'Clarification',
    fileReference: 'File Reference',
    description: 'Description',
    prompt: 'Final Prompt',
    group: 'Group',
    functionalRequirements: 'Functional Requirements',
    visualRequirements: 'Visual Requirements',
    clickToEdit: 'Click to edit',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    addRequirement: '+ Add Requirement',
    newFunctionalRequirement: 'New functional requirement',
    newVisualRequirement: 'New visual requirement',
    edit: 'Edit',
    remove: 'Remove'
};

type MessageType = typeof message_en;

const messages: { [key: string]: MessageType } = {
    'en': message_en,
    'pt': message_pt
};
/// **collab_i18n_end**

export interface ClarificationData {
    fileReference: string;
    description: string;
    prompt: string;
    group: string;
    functionalRequirements: string[];
    visualRequirements: string[];
}

@customElement('agents--molecules--agent-new-molecule-planner-clarification-102020')
export class AgentNewMoleculePlannerClarification102020 extends StateLitElement {

    private msg: MessageType = messages['en'];

    @property({ type: Object }) data: ClarificationData = {
        fileReference: '',
        description: '',
        prompt: '',
        group: '',
        functionalRequirements: [],
        visualRequirements: []
    };

    @state() private _editingField: string | null = null;
    @state() private _editingIndex: number | null = null;
    @state() private _tempValue: string = '';
    @state() private _expandedSections: Set<string> = new Set(['functional', 'visual']);

    private _startEdit(field: string, value: string, index: number | null = null): void {
        this._editingField = field;
        this._editingIndex = index;
        this._tempValue = value;
    }

    private _cancelEdit(): void {
        this._editingField = null;
        this._editingIndex = null;
        this._tempValue = '';
    }

    private _saveEdit(): void {
        if (!this._editingField) return;

        const newData = { ...this.data };

        if (this._editingField === 'functionalRequirements' && this._editingIndex !== null) {
            newData.functionalRequirements = [...this.data.functionalRequirements];
            newData.functionalRequirements[this._editingIndex] = this._tempValue;
        } else if (this._editingField === 'visualRequirements' && this._editingIndex !== null) {
            newData.visualRequirements = [...this.data.visualRequirements];
            newData.visualRequirements[this._editingIndex] = this._tempValue;
        } else {
            (newData as any)[this._editingField] = this._tempValue;
        }

        this.data = newData;
        this._dispatchChange();
        this._cancelEdit();
    }

    private _dispatchChange(): void {
        this.dispatchEvent(new CustomEvent('data-change', {
            detail: { data: this.data },
            bubbles: true,
            composed: true
        }));
    }

    private _toggleSection(section: string): void {
        const newSet = new Set(this._expandedSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        this._expandedSections = newSet;
    }

    private _addRequirement(type: 'functional' | 'visual'): void {
        const newData = { ...this.data };
        if (type === 'functional') {
            newData.functionalRequirements = [...this.data.functionalRequirements, this.msg.newFunctionalRequirement];
        } else {
            newData.visualRequirements = [...this.data.visualRequirements, this.msg.newVisualRequirement];
        }
        this.data = newData;
        this._dispatchChange();
    }

    private _removeRequirement(type: 'functional' | 'visual', index: number): void {
        const newData = { ...this.data };
        if (type === 'functional') {
            newData.functionalRequirements = this.data.functionalRequirements.filter((_, i) => i !== index);
        } else {
            newData.visualRequirements = this.data.visualRequirements.filter((_, i) => i !== index);
        }
        this.data = newData;
        this._dispatchChange();
    }

    private _handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._saveEdit();
        } else if (e.key === 'Escape') {
            this._cancelEdit();
        }
    }

    private _renderEditableField(label: string, field: string, value: string, multiline: boolean = false): TemplateResult {
        const isEditing = this._editingField === field && this._editingIndex === null;

        return html`
            <div class="field">
                <label class="field-label">${label}</label>
                ${isEditing ? html`
                    <div class="edit-container">
                        ${multiline ? html`
                            <textarea
                                class="edit-textarea"
                                .value=${this._tempValue}
                                @input=${(e: InputEvent) => this._tempValue = (e.target as HTMLTextAreaElement).value}
                                @keydown=${this._handleKeydown}
                                rows="4"
                            ></textarea>
                        ` : html`
                            <input
                                type="text"
                                class="edit-input"
                                .value=${this._tempValue}
                                @input=${(e: InputEvent) => this._tempValue = (e.target as HTMLInputElement).value}
                                @keydown=${this._handleKeydown}
                            />
                        `}
                        <div class="edit-actions">
                            <button class="btn btn-save" @click=${this._saveEdit}>${this.msg.save}</button>
                            <button class="btn btn-cancel" @click=${this._cancelEdit}>${this.msg.cancel}</button>
                        </div>
                    </div>
                ` : html`
                    <div class="field-value" @click=${() => this._startEdit(field, value)}>
                        <span class="value-text">${value || this.msg.clickToEdit}</span>
                        <span class="edit-icon">✎</span>
                    </div>
                `}
            </div>
        `;
    }

    private _renderRequirementsList(
        title: string,
        sectionKey: string,
        requirements: string[],
        type: 'functional' | 'visual'
    ): TemplateResult {
        const isExpanded = this._expandedSections.has(sectionKey);
        const fieldName = type === 'functional' ? 'functionalRequirements' : 'visualRequirements';

        return html`
            <div class="section">
                <div class="section-header" @click=${() => this._toggleSection(sectionKey)}>
                    <span class="section-title">${title}</span>
                    <span class="section-count">${requirements.length}</span>
                    <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
                </div>
                ${isExpanded ? html`
                    <ul class="requirements-list">
                        ${requirements.map((req, index) => html`
                            <li class="requirement-item">
                                ${this._editingField === fieldName && this._editingIndex === index ? html`
                                    <div class="edit-container">
                                        <textarea
                                            class="edit-textarea"
                                            .value=${this._tempValue}
                                            @input=${(e: InputEvent) => this._tempValue = (e.target as HTMLTextAreaElement).value}
                                            @keydown=${this._handleKeydown}
                                            rows="3"
                                        ></textarea>
                                        <div class="edit-actions">
                                            <button class="btn btn-save" @click=${this._saveEdit}>${this.msg.save}</button>
                                            <button class="btn btn-cancel" @click=${this._cancelEdit}>${this.msg.cancel}</button>
                                        </div>
                                    </div>
                                ` : html`
                                    <div class="requirement-content">
                                        <span class="requirement-index">${index + 1}.</span>
                                        <span class="requirement-text" @click=${() => this._startEdit(fieldName, req, index)}>${req}</span>
                                        <div class="requirement-actions">
                                            <button class="btn-icon btn-edit" @click=${() => this._startEdit(fieldName, req, index)} title="${this.msg.edit}">✎</button>
                                            <button class="btn-icon btn-delete" @click=${() => this._removeRequirement(type, index)} title="${this.msg.remove}">✕</button>
                                        </div>
                                    </div>
                                `}
                            </li>
                        `)}
                    </ul>
                    <button class="btn btn-add" @click=${() => this._addRequirement(type)}>
                        ${this.msg.addRequirement}
                    </button>
                ` : ''}
            </div>
        `;
    }

    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];

        return html`
            <div class="clarification-container">
                <header class="clarification-header">
                    <h2 class="clarification-title">${this.msg.title}</h2>
                    <span class="clarification-group">${this.data.group}</span>
                </header>

                <div class="clarification-body">
                    <div class="info-section">
                        ${this._renderEditableField(this.msg.fileReference, 'fileReference', this.data.fileReference)}
                        ${this._renderEditableField(this.msg.description, 'description', this.data.description, true)}
                        ${this._renderEditableField(this.msg.prompt, 'prompt', this.data.prompt, true)}
                        ${this._renderEditableField(this.msg.group, 'group', this.data.group)}
                    </div>

                    <div class="requirements-section">
                        ${this._renderRequirementsList(
            this.msg.functionalRequirements,
            'functional',
            this.data.functionalRequirements,
            'functional'
        )}

                        ${this._renderRequirementsList(
            this.msg.visualRequirements,
            'visual',
            this.data.visualRequirements,
            'visual'
        )}
                    </div>
                </div>

                <footer class="clarification-footer">
                    <button class="btn btn-secondary"  @click=${() => { this.onAction('cancel') }}>
                        ${this.msg.cancel}
                    </button>
                    <button class="btn btn-primary"  @click=${() => { this.onAction('continue') }}>
                        ${this.msg.confirm}
                    </button>
                </footer>
            </div>
        `;
    }

    private onAction(action: 'cancel' | 'continue') {

        const path = mls.stor.getPathToFile(this.data.fileReference)
        const suggestions2 = {
            tagName: convertFileToTag(path),
            ...this.data
        }


        this.dispatchEvent(
            new CustomEvent('clarification-finish', {
                detail: {
                    value: suggestions2,
                    action
                },
                bubbles: true,
                composed: true
            })
        );
    }

}