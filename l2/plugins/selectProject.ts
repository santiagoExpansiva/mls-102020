/// <mls fileReference="_102020_/l2/plugins/selectProject.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Select Project',
    desc: 'A project is a deliverable within an organization — it contains pages, components, and all generated code.',
    allTitle: 'All Projects',
    allDesc: 'Overview of all projects in this organization.',
    customTitle: 'New Project',
    customDesc: 'Create a new project within this organization.',
    needsOrg: 'Select an organization first to see the available projects.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Selecionar Projeto',
        desc: 'Um projeto é uma entrega dentro de uma organização — contém páginas, componentes e todo o código gerado.',
        allTitle: 'Todos os Projetos',
        allDesc: 'Visão geral de todos os projetos desta organização.',
        customTitle: 'Novo Projeto',
        customDesc: 'Crie um novo projeto dentro desta organização.',
        needsOrg: 'Selecione uma organização primeiro para ver os projetos disponíveis.',
    },
    es: {
        title: 'Seleccionar Proyecto',
        desc: 'Un proyecto es un entregable dentro de una organización — contiene páginas, componentes y todo el código generado.',
        allTitle: 'Todos los Proyectos',
        allDesc: 'Visión general de todos los proyectos de esta organización.',
        customTitle: 'Nuevo Proyecto',
        customDesc: 'Cree un nuevo proyecto dentro de esta organización.',
        needsOrg: 'Seleccione una organización primero para ver los proyectos disponibles.',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IProject {
    project: number;
    name: string;
    doSelect: boolean;
}

interface IOrg {
    name: string;
    created_at: string;
    description: string;
    key: string;
    index: number;
    projects: IProject[];
}

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-project-102020')
export class PluginSelectProject extends StateLitElement {

    @property({ attribute: false }) selectedOrg: IOrg | null = null;
    @property({ attribute: false }) value: number | null = null;

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    private get _isAll(): boolean {
        return this.value === 0;
    }

    private get _isCustom(): boolean {
        return this.selectedOrg !== null && this.value !== null && this.value > this.selectedOrg.projects.length;
    }

    private get _selectedProject(): IProject | null {
        if (!this.selectedOrg || this.value === null || this.value <= 0 || this.value > this.selectedOrg.projects.length) return null;
        return this.selectedOrg.projects[this.value - 1];
    }

    createRenderRoot() { return this; }

    render() {
        if (!this.selectedOrg) return this._renderNeedsOrg();
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    private _renderNeedsOrg() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, null, this.msg.desc)}
                ${this._renderNotice(this.msg.needsOrg)}
            </div>
        `;
    }

    private _renderSelected() {
        const project = this._selectedProject;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, project?.name ?? null, this.msg.desc)}
                ${project ? this._renderProjectCard(project) : nothing}
            </div>
        `;
    }

    private _renderAll() {
        const org = this.selectedOrg!;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.allTitle, null, this.msg.allDesc)}
                ${org.projects.length === 0
                    ? nothing
                    : html`
                        <div class="flex flex-col gap-1.5">
                            ${org.projects.map(p => this._renderProjectCard(p))}
                        </div>
                    `}
            </div>
        `;
    }

    private _renderCustom() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.customTitle, null, this.msg.customDesc)}
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

    private _renderProjectCard(project: IProject) {
        const org = this.selectedOrg!;
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5 flex items-center gap-2
            ">
                <span class="text-[10px] text-gray-400 dark:text-gray-600 font-mono">${org.name}</span>
                <span class="text-gray-300 dark:text-gray-700">/</span>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${project.name}</span>
            </div>
        `;
    }
}
