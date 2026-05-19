/// <mls fileReference="_102020_/l2/plugins/selectOrganization.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Select Organization',
    desc: 'An organization groups multiple projects under the same umbrella. Select one to browse the projects available to your team.',
    allTitle: 'All Organizations',
    allDesc: 'Overview of all organizations available in the system.',
    customTitle: 'New Organization',
    customDesc: 'Create a new organization to group your projects.',
    projects: 'projects',
    noOrgs: 'No organizations found.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Selecionar Organização',
        desc: 'Uma organização agrupa vários projetos sob o mesmo guarda-chuva. Selecione uma para navegar pelos projetos disponíveis para o seu time.',
        allTitle: 'Todas as Organizações',
        allDesc: 'Visão geral de todas as organizações disponíveis no sistema.',
        customTitle: 'Nova Organização',
        customDesc: 'Crie uma nova organização para agrupar seus projetos.',
        projects: 'projetos',
        noOrgs: 'Nenhuma organização encontrada.',
    },
    es: {
        title: 'Seleccionar Organización',
        desc: 'Una organización agrupa múltiples proyectos bajo el mismo paraguas. Seleccione una para explorar los proyectos disponibles para su equipo.',
        allTitle: 'Todas las Organizaciones',
        allDesc: 'Visión general de todas las organizaciones disponibles en el sistema.',
        customTitle: 'Nueva Organización',
        customDesc: 'Cree una nueva organización para agrupar sus proyectos.',
        projects: 'proyectos',
        noOrgs: 'No se encontraron organizaciones.',
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

@customElement('plugins--select-organization-102020')
export class PluginSelectOrganization extends StateLitElement {

    @property({ attribute: false }) orgs: IOrg[] = [];
    @property({ attribute: false }) value: number | null = null;

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    private get _isAll(): boolean {
        return this.value === 0;
    }

    private get _isCustom(): boolean {
        return this.value !== null && this.value > this.orgs.length;
    }

    private get _selectedOrg(): IOrg | null {
        if (this.value === null || this.value <= 0 || this.value > this.orgs.length) return null;
        return this.orgs[this.value - 1];
    }

    createRenderRoot() { return this; }

    render() {
        if (this._isAll) return this._renderAll();
        if (this._isCustom) return this._renderCustom();
        return this._renderSelected();
    }

    private _renderSelected() {
        const org = this._selectedOrg;
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.title, org?.name ?? null, this.msg.desc)}
                ${org ? this._renderOrgCard(org) : nothing}
            </div>
        `;
    }

    private _renderAll() {
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderHeader(this.msg.allTitle, null, this.msg.allDesc)}
                ${this.orgs.length === 0
                    ? html`<span class="text-[11px] text-gray-400 dark:text-gray-600 italic">${this.msg.noOrgs}</span>`
                    : html`
                        <div class="flex flex-col gap-1.5">
                            ${this.orgs.map(org => this._renderOrgCard(org))}
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

    private _renderOrgCard(org: IOrg) {
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5 flex items-center justify-between
            ">
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${org.name}</span>
                <span class="
                    text-[10px] px-2 py-0.5 rounded-full font-medium
                    bg-indigo-100 dark:bg-indigo-900/30
                    text-indigo-600 dark:text-indigo-400
                ">${org.projects.length} ${this.msg.projects}</span>
            </div>
        `;
    }
}
