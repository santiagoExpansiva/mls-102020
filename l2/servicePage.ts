/// <mls fileReference="_102020_/l2/servicePage.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu } from '/_102027_/l2/serviceBase.js';
import { createModel } from '/_102027_/l2/libModel.js';
import { saveOpenedFile } from '/_102027_/l2/libCommom.js';

import '/_102027_/l2/collabSelectKnob.js';
import '/_102020_/l2/plugins/selectPage.js';
import '/_102020_/l2/plugins/selectRule.js';


// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    svcTitle: 'Page',
    page: 'Pages',
    rule: 'Rules',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        svcTitle: 'Página',
        page: 'Páginas',
        rule: 'Regras',
    },
    es: {
        svcTitle: 'Página',
        page: 'Páginas',
        rule: 'Reglas',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

interface IKnobConfig {
    key: string;
    min: number;
    max: number;
    labels: Record<number, string>;
    disabled?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────

@customElement('service-page-102020')
export class ServicePage102020 extends ServiceBase {

    public details: IService = {
        icon: '&#xf0f6',
        state: 'foreground',
        position: 'left',
        tooltip: 'Page',
        visible: true,
        widget: '_102020_servicePage',
        level: [6],
    };

    public onClickMain(_op: string): void {
        if (this.menu.setMode) this.menu.setMode('initial');
    }

    public menu: IServiceMenu = {
        title: '',
        main: {},
        tools: {},
        tabs: undefined,
        onClickMain: this.onClickMain.bind(this),
    };

    onServiceClick(_visible: boolean, _reinit: boolean, _el: IToolbarContent | null) {
        this._pageValue = 0;
        this._reloadToken += 1;
        // @ts-ignore
        this.requestUpdate();
    }

    // ─── State ────────────────────────────────────────────────────────

    @state() private msg: MessageType = message_en;

    @state() private _modules: IModule[] = [];

    @state() private _pageConfig: IKnobConfig = { key: 'page', min: 0, max: 1, labels: { 0: 'All', 1: '+' } };
    @state() private _ruleConfig: IKnobConfig = { key: 'rule', min: 0, max: 0, labels: { 0: 'All' } };

    @state() private _pageValue: number | null = 0;
    @state() private _ruleValue: number | null = null;
    @state() private _reloadToken: number = 0;

    private _pageEntries: Array<{ name: string; file: mls.stor.IFileInfo }> = [];

    @state() private _selectedKnob: string = 'page';

    // ─── Data Loading ─────────────────────────────────────────────────

    private async _loadData() {
        // @ts-ignore
        const project: number = mls.actualProject;
        if (!project) return;
        try {
            const mod = await import(`/_${project}_/l2/project.js`);
            this._modules = mod?.projectConfig?.modules ?? [];
            this._ruleValue = 0;
        } catch {
            this._modules = [];
        }
        // @ts-ignore
        this.requestUpdate();
    }

    private get _selectedModule(): IModule | null {
        // @ts-ignore
        const actualModule: string | undefined = mls.actualModule;
        if (!actualModule) return null;
        return this._modules.find(m => m.name === actualModule) ?? null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private get _knobValues(): Record<string, number | null> {
        return {
            page: this._pageValue,
            rule: this._ruleValue,
        };
    }

    private _getKnobConfig(key: string): IKnobConfig {
        switch (key) {
            case 'page': return this._pageConfig;
            case 'rule': return this._ruleConfig;
            default: return { key, min: 0, max: 0, labels: {}, disabled: true };
        }
    }

    private _setKnobValue(key: string, value: number | null) {
        switch (key) {
            case 'page': this._pageValue = value; break;
            case 'rule': this._ruleValue = value; break;
        }
        // @ts-ignore
        this.requestUpdate();
    }

    // ─── Event Handlers ───────────────────────────────────────────────

    private _onKnobChange(key: string, e: CustomEvent) {
        this._selectedKnob = key;
        this._setKnobValue(key, e.detail.value);
        if (key === 'page') {
            const value: number = e.detail.value;
            const entry = value > 0 && value <= this._pageEntries.length ? this._pageEntries[value - 1] : null;
            this._setActualPage(entry?.file ?? null);
        }
    }

    private _onKnobClick(key: string) {
        this._selectedKnob = key;
        // @ts-ignore
        this.requestUpdate();
    }

    private _onPageSelect(e: CustomEvent) {
        this._setKnobValue('page', e.detail.value);
        this._setActualPage(e.detail.file as mls.stor.IFileInfo ?? null);
    }

    private async _setActualPage(file: mls.stor.IFileInfo | null) {
        if (!file) return;
        let name = `_${file.project}_${file.shortName}`;
        if (file.folder) name = `_${file.project}_${file.folder}/${file.shortName}`;
        for (const lv of [3, 4]) {
            mls.actual[lv].setFullName(name);
            mls.actual[lv][this.position as ('right' | 'left')] = file;
        }

        const storFiles = await mls.stor.getFiles({ project: file.project, shortName: file.shortName, folder: file.folder, loadContent: false });
        if ([1, 2, 3, 4].includes(mls.actualLevel) && storFiles.ts) await createModel(storFiles.ts);
        if ([2, 3, 4].includes(mls.actualLevel) && storFiles.less) await createModel(storFiles.less);
        if ([2, 3, 4].includes(mls.actualLevel) && storFiles.html) await createModel(storFiles.html);

        const params: any = { action: 'open' };
        params.level = 4;
        params.project = file.project;
        params.shortName = file.shortName;
        params.extension = file.extension;
        params.folder = file.folder;
        saveOpenedFile(params.project, 4, mls.actual[4].getFullName());
        saveOpenedFile(params.project, 3, mls.actual[3].getFullName());



        params.position = this.position as ('right' | 'left');
        mls.events.fire([mls.actualLevel], ['FileAction'], JSON.stringify(params), 0);

    }

    // ─── Lifecycle ────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        this._loadData();
    }

    // ─── Render ───────────────────────────────────────────────────────

    createRenderRoot() { return this; }

    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];

        return html`
            <div class="flex flex-col min-h-full bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
                ${this._renderKnobRow()}
                ${this._renderDetailsRow()}
            </div>
        `;
    }

    // ─── Knob Row ─────────────────────────────────────────────────────

    private _renderKnobRow() {
        return html`
            <div class="
                flex items-center justify-center
                px-2 py-3
                border-b border-gray-200 dark:border-gray-800
                gap-0
            " style="--knob-scale: 0.5">
                ${this._renderKnobItem('page')}
                ${this._renderKnobItem('rule')}
            </div>
        `;
    }

    private _renderKnobItem(key: string) {
        const config = this._getKnobConfig(key);
        const value = this._knobValues[key];
        const isContext = this._selectedKnob === key;
        const isDisabled = config.disabled ?? false;
        const label = this.msg[key as keyof MessageType] || key;

        return html`
            <div class="flex flex-col items-center gap-0.5 ${isDisabled ? 'opacity-30' : ''}">
                <collab-select-knob-102027
                    .min=${config.min}
                    .max=${config.max}
                    .value=${value}
                    .step=${1}
                    .active=${true}
                    .disabled=${isDisabled}
                    .selected=${isContext}
                    .showTicks=${false}
                    @knob-change=${(e: CustomEvent) => this._onKnobChange(key, e)}
                ></collab-select-knob-102027>

                <div
                    class="flex flex-col items-center gap-0.5 cursor-pointer"
                    @click=${() => this._onKnobClick(key)}
                >
                    <span class="
                        text-[9px] font-semibold uppercase tracking-wider
                        ${isContext
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-600'}
                        transition-colors duration-200
                    ">${label}</span>

                    <div class="
                        w-full h-0.5 rounded-full
                        transition-all duration-200
                        ${isContext
                ? 'bg-cyan-400 shadow-[0_0_4px_1px_rgba(34,211,238,0.6),0_0_8px_2px_rgba(34,211,238,0.3)]'
                : 'bg-transparent'}
                    "></div>
                </div>
            </div>
        `;
    }

    // ─── Details Row ──────────────────────────────────────────────────

    private _onPageConfig(e: CustomEvent) {
        const { min, max, labels, pages } = e.detail;
        this._pageConfig = { key: 'page', min, max, labels };
        if (pages) this._pageEntries = pages;
        // @ts-ignore
        this.requestUpdate();
    }

    private _onRuleConfig(e: CustomEvent) {
        const { min, max, labels } = e.detail;
        this._ruleConfig = { key: 'rule', min, max, labels };
        // @ts-ignore
        this.requestUpdate();
    }

    private _renderDetailsRow() {
        return html`
            <div class="flex flex-col flex-1">
                <div class="flex flex-col gap-3 px-4 py-4 flex-1"
                    @select-page=${(e: CustomEvent) => this._onPageSelect(e)}
                    @select-rule=${(e: CustomEvent) => this._setKnobValue('rule', e.detail.value)}
                    @page-config=${(e: CustomEvent) => this._onPageConfig(e)}
                    @rule-config=${(e: CustomEvent) => this._onRuleConfig(e)}
                >
                    ${this._renderContextStatusArea()}
                </div>
            </div>
        `;
    }

    private _renderContextStatusArea() {
        switch (this._selectedKnob) {
            case 'page':
                return html`
                    <plugins--select-page-102020
                        .selectedModule=${this._selectedModule}
                        .value=${this._pageValue}
                        .reloadToken=${this._reloadToken}
                        @select-page=${(e: CustomEvent) => this._onPageSelect(e)}
                    ></plugins--select-page-102020>
                `;
            case 'rule':
                return html`
                    <plugins--select-rule-102020
                        .selectedModule=${this._selectedModule}
                        .value=${this._ruleValue}
                        @select-rule=${(e: CustomEvent) => this._setKnobValue('rule', e.detail.value)}
                    ></plugins--select-rule-102020>
                `;
            default:
                return nothing;
        }
    }
}
