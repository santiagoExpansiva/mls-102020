/// <mls fileReference="_102020_/l2/serviceGenome.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu } from '/_102027_/l2/serviceBase.js';
import { getState, setState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { IDesignSystemTokens, getTokens } from '/_102027_/l2/designSystemBase.js';
import { skills as listOfGroups } from '/_102020_/l2/skills/molecules/index.js';
import { replaceComponentTag } from '/_102020_/l2/previewTextEditor.js';
import { convertFileToTag, isPageFile } from '/_102020_/l2/utils.js';
import { getLastOpenedFiles } from '/_102027_/l2/libCommom.js';

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
    noPageSelected: 'No page selected',
    notAPage: 'Current file is not a page',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        svcTitle: 'Genome',
        layout: 'Layout',
        designSystem: 'Design System',
        molecules: 'Moléculas',
        noPageSelected: 'Nenhuma página selecionada',
        notAPage: 'O arquivo atual não é uma página',
    },
    es: {
        svcTitle: 'Genome',
        layout: 'Layout',
        designSystem: 'Design System',
        molecules: 'Moléculas',
        noPageSelected: 'Ninguna página seleccionada',
        notAPage: 'El archivo actual no es una página',
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

// ─── Static configs ───────────────────────────────────────────────────

const LAYOUT_CONFIG: IKnobConfig = {
    key: 'layout',
    min: 0,
    max: 4,
    labels: { 0: 'All', 1: 'standard', 2: 'compact', 3: 'tabs', 4: 'sidebar' },
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

    public onClickMain(_op: string): void { }

    public menu: IServiceMenu = {
        title: '',
        main: {},
        tools: {},
        tabs: undefined,
        onClickMain: this.onClickMain.bind(this),
    };

    async onServiceClick(_visible: boolean, _reinit: boolean, _el: IToolbarContent | null) {
        this._initDesignSystemKnob();
        const file = await this._getActual3File();
        await this._trySetActualModule(file);
        this._updateCurrentPage(file);
    }

    // ─── State ────────────────────────────────────────────────────────

    @state() private msg: MessageType = message_en;

    @state() private _layoutValue: number | null = 0;
    @state() private _currentPageFile: mls.stor.IFileInfo | null = null;
    @state() private _isPageContext: boolean = true;
    @state() private _dsValue: number | null = 1;
    @state() private _moleculesValue: number | null = null;
    @state() private _selectedKnob: string = 'layout';

    @state() private _dsConfig: IKnobConfig = {
        key: 'designSystem', min: 1, max: 2, labels: { 1: 'Default', 2: '+' },
    };

    @state() private _moleculesConfig: IKnobConfig = DISABLED_CONFIG('molecules');
    @state() private _selectedMoleculeGroup: string = '';
    @state() private _selectedMoleculeGroupDescription: string = '';
    @state() private _selectedMoleculeFiles: mls.stor.IFileInfo[] = [];
    @state() private _oldSelectedTag: string = '';
    @state() private _moleculeError: string = '';
    @state() private _moleculeReplaceMode: 'selected' | 'all' = 'selected';
    @state() private _actualPage: mls.editor.IModelBase | null = null;

    // ─── Preview state subscription ───────────────────────────────────

    handleIcaStateChange(key: string, value: any) {
        if (key === 'previewL3.selectedTagName') {
            this._oldSelectedTag = getState('previewL3.selectedTagName');
            this._onPreviewSelectedElementChanged(value);
        }
    }

    // ─── Design System ────────────────────────────────────────────────

    private async _initDesignSystemKnob() {
        if (!mls.actualProject) return;
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
        mls.editor.forceModelUpdate(tsModel.model)

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
        this.requestUpdate();
    }

    private _onKnobChange(key: string, e: CustomEvent) {
        this._selectedKnob = key;
        this._setKnobValue(key, e.detail.value);
    }

    private _onKnobClick(key: string) {
        this._selectedKnob = key;
        this.requestUpdate();
    }

    // ─── Lifecycle ────────────────────────────────────────────────────

    private async setLastOpenedFileIfNeeded() {
        if (!mls.actual[3].path) return;
        const lastFileOpened = getLastOpenedFiles(mls.actualProject || 0);
        if (!lastFileOpened || !lastFileOpened[3]) return;
        mls.actual[3].setFullName(lastFileOpened[3] as string);
    }

    private async _getActual3File(): Promise<mls.stor.IFileInfo | null> {
        const fromStore = await mls.actual[3].getStorFile() ?? null;
        if (fromStore) return fromStore;
        const path: string = mls.actual[3]?.path ?? '';
        if (!path) return null;
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash < 0) return null;
        const folder = path.substring(0, lastSlash);
        const shortName = path.substring(lastSlash + 1);
        if (!folder || !shortName) return null;
        return { project: mls.actual[3].project, folder, shortName, level: 3, extension: '.ts' } as mls.stor.IFileInfo;
    }

    private async _trySetActualModule(file: mls.stor.IFileInfo | null): Promise<void> {
        if (!file) return;
        const project: number = mls.actualProject as number;
        if (!project) return;
        let modules: IModule[] = [];
        try {
            const mod = await import(`/_${project}_/l2/project.js`);
            modules = mod?.projectConfig?.modules ?? [];
        } catch { return; }
        const firstSegment = (file.folder ?? '').split('/')[0];
        if (!firstSegment) return;
        if (modules.some((m: IModule) => m.name === firstSegment)) mls.setActualModule(firstSegment);
    }

    private async _updateCurrentPage(file: mls.stor.IFileInfo | null) {
        this._currentPageFile = file;
        if (!file) {
            this._actualPage = null;
            this._isPageContext = false;
            return;
        }
        this._isPageContext = isPageFile(file.folder ?? '');
        if (this._isPageContext) {
            const pageMatch = (file.folder ?? '').match(/\/page(\d)/);
            if (pageMatch) this._layoutValue = parseInt(pageMatch[1]);
        }
        
        const storFiles = await mls.stor.getFiles({ ...file, level: 2, loadContent: false })
        if (storFiles.ts) this._actualPage = await storFiles.ts.getOrCreateModel();
    }

    private _onFileActionGenome = async (ev: mls.events.IEvent) => {
        if (!ev.desc) return;
        try {
            const fa = JSON.parse(ev.desc) as mls.events.IFileAction;
            if (fa.action !== 'open' || fa.position !== 'left') return;
            const file = await this._getActual3File();
            this._updateCurrentPage(file);
            this.requestUpdate();
        } catch { /* ignore */ }
    };

    async connectedCallback() {
        super.connectedCallback();
        subscribe('previewL3.selectedTagName', this);
        this._initDesignSystemKnob();
        await this.setLastOpenedFileIfNeeded();
        mls.events.addEventListener([this.level], ['FileAction'], this._onFileActionGenome);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        unsubscribe('previewL3.selectedTagName', this);
        // @ts-ignore
        mls.events.removeEventListener([this.level], ['FileAction'], this._onFileActionGenome);
    }

    async firstUpdated() {
        const file = await this._getActual3File();
        await this._trySetActualModule(file);
        this._updateCurrentPage(file);
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
                ${!this._isPageContext ? 'opacity-30 pointer-events-none' : ''}
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
        if (!this._isPageContext) return html`
            <div class="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                <span class="text-sm text-amber-600 dark:text-amber-400">
                    ${!this._currentPageFile ? this.msg.noPageSelected : this.msg.notAPage}
                </span>
            </div>
        `;
        switch (this._selectedKnob) {
            case 'layout':
                return html`
                    <plugins--select-layout-102020
                        .value=${this._layoutValue}
                        .pageFile=${this._currentPageFile}
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
