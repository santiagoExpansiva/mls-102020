/// <mls fileReference="_102020_/l2/serviceGenome.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu } from '/_102027_/l2/serviceBase.js';
import { getState, setState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { IDesignSystemTokens, getTokens } from '/_102027_/l2/designSystemBase.js';
import { skills as listOfGroups } from '/_102020_/l2/skills/molecules/index.js';
import { replaceComponentTag } from '/_102020_/l2/previewTextEditor.js';
import { convertFileToTag } from '/_102020_/l2/utils.js';

import '/_102027_/l2/collabSelectKnob.js';
import '/_102020_/l2/plugins/selectLayout.js';
import '/_102020_/l2/plugins/selectDesignSystem.js';
import '/_102020_/l2/plugins/selectMolecule.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    svcTitle: 'Genome',
    layout: 'Layout',
    designSystem: 'Design System',
    molecules: 'Molecules',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        svcTitle: 'Genome',
        layout: 'Layout',
        designSystem: 'Design System',
        molecules: 'Moléculas',
    },
    es: {
        svcTitle: 'Genome',
        layout: 'Layout',
        designSystem: 'Design System',
        molecules: 'Moléculas',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IKnobConfig {
    key: string;
    min: number;
    max: number;
    labels: Record<number, string>;
    disabled?: boolean;
}

// ─── Static configs ───────────────────────────────────────────────────

const LAYOUT_CONFIG: IKnobConfig = {
    key: 'layout',
    min: 1,
    max: 4,
    labels: { 1: 'standard', 2: 'compact', 3: 'tabs', 4: 'sidebar' },
};

const DISABLED_CONFIG = (key: string): IKnobConfig => ({
    key,
    min: 1,
    max: 1,
    labels: {},
    disabled: true,
});

// ─── Service ─────────────────────────────────────────────────────────

@customElement('service-genome-102020')
export class ServiceGenome102020 extends ServiceBase {

    public details: IService = {
        icon: '&#xf568',
        state: 'foreground',
        position: 'right',
        tooltip: 'Genome',
        visible: true,
        widget: '_102020_serviceGenome',
        level: [3],
    };

    public onClickMain(_op: string): void {}

    public menu: IServiceMenu = {
        title: '',
        main: {},
        tools: {},
        tabs: undefined,
        onClickMain: this.onClickMain.bind(this),
    };

    onServiceClick(_visible: boolean, _reinit: boolean, _el: IToolbarContent | null) {
        this._initDesignSystemKnob();
    }

    // ─── State ────────────────────────────────────────────────────────

    @state() private msg: MessageType = message_en;

    @state() private _layoutValue: number | null = 1;
    @state() private _dsValue: number | null = 1;
    @state() private _moleculesValue: number | null = null;
    @state() private _selectedKnob: string = 'layout';

    @state() private _dsConfig: IKnobConfig = {
        key: 'designSystem', min: 1, max: 2, labels: { 1: 'Default', 2: '+' },
    };

    @state() private _moleculesConfig: IKnobConfig = DISABLED_CONFIG('molecules');
    @state() private _selectedMoleculeGroup: string = '';
    @state() private _selectedMoleculeGroupDescription: string = '';
    @state() private _selectedMoleculeFiles: any[] = [];
    @state() private _oldSelectedTag: string = '';
    @state() private _moleculeError: string = '';
    @state() private _moleculeReplaceMode: 'selected' | 'all' = 'selected';
    @state() private _actualPage: any = null;

    // ─── Preview state subscription ───────────────────────────────────

    handleIcaStateChange(key: string, value: any) {
        if (key === 'previewL3.selectedTagName') {
            this._oldSelectedTag = getState('previewL3.selectedTagName');
            this._onPreviewSelectedElementChanged(value);
        }
    }

    // ─── Design System ────────────────────────────────────────────────

    private async _initDesignSystemKnob() {
        // @ts-ignore
        if (!mls.actualProject) return;
        // @ts-ignore
        const projectDS: IDesignSystemTokens[] = await getTokens(mls.actualProject);

        const labels: Record<number, string> = { 0: 'All' };
        projectDS.forEach((ds, i) => { labels[i + 1] = ds.themeName; });
        labels[projectDS.length + 1] = '+';

        this._dsConfig = {
            key: 'designSystem',
            min: 0,
            max: projectDS.length + 1,
            labels,
        };

        if (this._dsValue === null || this._dsValue > this._dsConfig.max) {
            this._dsValue = 0;
        }
        // @ts-ignore
        this.requestUpdate();
    }

    // ─── Molecule Logic ───────────────────────────────────────────────

    private _getMolecules(): Map<string, any[]> {
        // @ts-ignore
        const files = Object.values(mls.stor.files) as any[];
        const htmlFiles = files.filter(
            (f) => f.extension === '.html' && f.folder.startsWith('molecules') && f.shortName !== 'index'
        );
        const folderMap = new Map<string, any[]>();
        for (const f of htmlFiles) {
            const key = f.folder.replace(/^molecules\//, '').toLowerCase();
            if (!folderMap.has(key)) folderMap.set(key, []);
            folderMap.get(key)!.push(f);
        }
        return folderMap;
    }

    private _isWebComponent(tag: string): boolean {
        return !!(tag && typeof tag === 'string' && tag.includes('-'));
    }

    private _extractGroupFromTag(tag: string): string | null {
        if (!tag.includes('-')) return null;
        return tag.split('-')[0];
    }

    private _onPreviewSelectedElementChanged(tag: string) {
        const isWC = this._isWebComponent(tag);
        const groupsMolecules = this._getMolecules();
        const actualGroup = this._extractGroupFromTag(tag);

        if (!isWC || !actualGroup || !groupsMolecules.get(actualGroup)) {
            this._moleculesConfig = DISABLED_CONFIG('molecules');
            this._moleculesValue = null;
            this._selectedMoleculeGroup = '';
            this._selectedMoleculeGroupDescription = '';
            this._selectedMoleculeFiles = [];
            this._moleculeError = '';
            if (this._selectedKnob === 'molecules') this._selectedKnob = 'layout';
            // @ts-ignore
            this.requestUpdate();
            return;
        }

        const widgetsFromGroup = groupsMolecules.get(actualGroup)!;
        // @ts-ignore
        const groupDescription = (listOfGroups as any[]).find(
            (item: any) => item.name.toLowerCase() === actualGroup
        )?.description || '';

        const labels: Record<number, string> = {};
        widgetsFromGroup.forEach((item, i) => { labels[i + 1] = item.shortName; });

        this._moleculesConfig = {
            key: 'molecules',
            min: 1,
            max: widgetsFromGroup.length,
            labels,
            disabled: false,
        };

        const currentMoleculeName = tag.replace(`${actualGroup}-`, '');
        let currentIndex = widgetsFromGroup.findIndex(
            (item) => item.shortName.toLowerCase() === currentMoleculeName.toLowerCase()
        );
        if (currentIndex === -1) {
            currentIndex = widgetsFromGroup.findIndex(
                (item) =>
                    currentMoleculeName.toLowerCase().includes(item.shortName.toLowerCase()) ||
                    item.shortName.toLowerCase().includes(currentMoleculeName.toLowerCase())
            );
        }
        if (currentIndex !== -1) {
            this._moleculesValue = currentIndex + 1;
        } else if (this._moleculesValue === null || !labels[this._moleculesValue]) {
            this._moleculesValue = 1;
        }

        this._selectedMoleculeGroup = actualGroup;
        this._selectedMoleculeGroupDescription = groupDescription;
        this._selectedMoleculeFiles = widgetsFromGroup;
        this._moleculeError = '';
        // @ts-ignore
        this.requestUpdate();
    }

    private async _onMoleculesChanged(value: number | null) {
        if (!value || !this._actualPage) return;
        const selectedFile = this._selectedMoleculeFiles[value - 1];
        if (!selectedFile) return;

        this._moleculeError = '';

        const selector = getState('previewL3.selectedElement');
        const newTag = convertFileToTag(selectedFile);
        const tsModel = this._actualPage;
        const source = tsModel.model.getValue();

        const result = replaceComponentTag(
            this._oldSelectedTag,
            newTag,
            source,
            selector,
            this._moleculeReplaceMode
        );

        if (!result.success) {
            this._moleculeError = 'Could not replace the molecule in the source.';
            // @ts-ignore
            this.requestUpdate();
            return;
        }

        tsModel.model.pushEditOperations(
            [],
            [{ range: tsModel.model.getFullModelRange(), text: result.newSource || source }],
            () => null,
        );

        this._oldSelectedTag = newTag;
        setState('preview.pendingReselect', newTag);
        // @ts-ignore
        mls.editor.forceModelUpdate(tsModel.model);
    }

    // ─── Knob helpers ─────────────────────────────────────────────────

    private get _knobValues(): Record<string, number | null> {
        return {
            layout: this._layoutValue,
            designSystem: this._dsValue,
            molecules: this._moleculesValue,
        };
    }

    private _getKnobConfig(key: string): IKnobConfig {
        switch (key) {
            case 'layout': return LAYOUT_CONFIG;
            case 'designSystem': return this._dsConfig;
            case 'molecules': return this._moleculesConfig;
            default: return DISABLED_CONFIG(key);
        }
    }

    private _setKnobValue(key: string, value: number | null) {
        switch (key) {
            case 'layout': this._layoutValue = value; break;
            case 'designSystem': this._dsValue = value; break;
            case 'molecules':
                this._moleculesValue = value;
                this._onMoleculesChanged(value);
                return;
        }
        // @ts-ignore
        this.requestUpdate();
    }

    private _onKnobChange(key: string, e: CustomEvent) {
        this._selectedKnob = key;
        this._setKnobValue(key, e.detail.value);
    }

    private _onKnobClick(key: string) {
        this._selectedKnob = key;
        // @ts-ignore
        this.requestUpdate();
    }

    // ─── Lifecycle ────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        subscribe('previewL3.selectedTagName', this);
        this._initDesignSystemKnob();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        unsubscribe('previewL3.selectedTagName', this);
    }

    firstUpdated() {
        // @ts-ignore
        this._actualPage = mls.editor.models['_102020_pizzaria/web/desktop/page11_login']?.ts ?? null;
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
                ${this._renderKnobItem('layout')}
                ${this._renderKnobItem('designSystem')}
                ${this._renderKnobItem('molecules')}
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

    private _renderDetailsRow() {
        return html`
            <div class="flex flex-col flex-1">
                <div class="flex flex-col gap-3 px-4 py-4 flex-1"
                    @select-layout=${(e: CustomEvent) => this._setKnobValue('layout', e.detail.value)}
                    @select-molecule=${(e: CustomEvent) => this._setKnobValue('molecules', e.detail.value)}
                    @molecule-replace-mode=${(e: CustomEvent) => { this._moleculeReplaceMode = e.detail.value; this.requestUpdate(); }}
                >
                    ${this._renderContextStatusArea()}
                </div>
            </div>
        `;
    }

    private _renderContextStatusArea() {
        switch (this._selectedKnob) {
            case 'layout':
                return html`
                    <plugins--select-layout-102020
                        .value=${this._layoutValue}
                    ></plugins--select-layout-102020>
                `;
            case 'designSystem':
                return html`
                    <plugins--select-design-system-102020
                        .projectSelected=${true}
                        .value=${this._dsValue}
                        .labels=${this._dsConfig.labels}
                        .min=${this._dsConfig.min}
                        .max=${this._dsConfig.max}
                    ></plugins--select-design-system-102020>
                `;
            case 'molecules':
                return html`
                    <plugins--select-molecule-102020
                        .group=${this._selectedMoleculeGroup}
                        .description=${this._selectedMoleculeGroupDescription}
                        .files=${this._selectedMoleculeFiles}
                        .value=${this._moleculesValue}
                        .replaceMode=${this._moleculeReplaceMode}
                        .error=${this._moleculeError}
                    ></plugins--select-molecule-102020>
                `;
            default:
                return nothing;
        }
    }
}
