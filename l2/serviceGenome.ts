/// <mls fileReference="_102020_/l2/serviceGenome.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu, IOptions } from '/_102027_/l2/serviceBase.js';
import { getConfigProject, updateConfigProject } from '/_102027_/l2/libProjectConfig.js';
import { globalState, setState, initState, getState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { executeBeforePrompt, loadAgent } from '/_102027_/l2/aiAgentOrchestration.js'
import { createThread, getUserId } from '/_102025_/l2/collabMessagesHelper.js';
import { getThreadByName } from '/_102025_/l2/collabMessagesIndexedDB.js';
import { getTemporaryContext } from '/_102027_/l2/aiAgentHelper.js';
import { languages as allLanguages, ICollabLanguage } from '/_102027_/l2/collabLanguages.js';
import { skills as listOfGroups } from '/_102020_/l2/skills/molecules/index.js';
import { replaceComponentTag } from '/_102020_/l2/previewTextEditor.js';
import { convertFileToTag } from '/_102020_/l2/utils.js';

import '/_102027_/l2/collabSelectKnob.js';


// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    svcTitle: 'Genome',
    device: 'Device',
    layout: 'Layout',
    style: 'Style',
    kit: 'UI Kit',
    language: 'Language',
    molecules: 'Molecules',
    noMolecule: 'Select a widget in the preview to enable molecule variants',
    pathLabel: 'Variation Path',
    styleLabel: 'Style',
    langLabel: 'Language',
    moleculeLabel: 'Molecule',
    generateBtn: 'Generate with Agent',
    variationExists: 'Variation found',
    variationMissing: 'Variation not found',
    currentPage: 'Current Page',
    aboutThis: 'About this content',
    custom: 'Custom',
    langApplied: 'Language applied',
    langNotInPage: 'This language has not been created for this page yet.',
    langGenerateFor: 'Generate language for this page',
    langCustomTitle: 'Add custom language',
    langCustomCode: 'Language code',
    langCustomCodePlaceholder: 'e.g. fr, de, ja',
    langApplyAll: 'Apply to all pages',
    langApplyOnly: 'Only this page',
    langCustomGenerate: 'Generate language',
    langGenerating: 'Generating language...',
    langGenerateSuccess: 'Language generated successfully!',
    langGenerateError: 'Error generating language.',
    langAlreadyExists: 'This language already exists in the project.',
    langAffectedPages: 'Affected pages',
    detailsSummary: 'Variation Details',
    langScenarioTitle: 'Language',
    langScenarioDesc: 'Manage the i18n translations for the current page. Select an existing language to preview it, or add a new one.',
    molScenarioDesc: 'Switch between molecule variants for the selected widget. Click a variant to replace it in the page.',
    molReplaceError: 'Could not replace the molecule in the source.',
    molSelectedOnly: 'Selected only',
    molAllOccurrences: 'All occurrences',
    inDevelopment: 'In development',
    langRemoveTitle: 'Remove language',
    langRemoveBtn: 'Remove',
    langRemoving: 'Removing language...',
    langRemoveSuccess: 'Language removed successfully!',
    langRemoveError: 'Error removing language.',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        svcTitle: 'Genome',
        device: 'Dispositivo',
        layout: 'Layout',
        style: 'Estilo',
        kit: 'UI Kit',
        language: 'Idioma',
        molecules: 'Moléculas',
        noMolecule: 'Selecione um widget no preview para habilitar variantes de molécula',
        pathLabel: 'Caminho da Variação',
        styleLabel: 'Estilo',
        langLabel: 'Idioma',
        moleculeLabel: 'Molécula',
        generateBtn: 'Gerar com Agente',
        variationExists: 'Variação encontrada',
        variationMissing: 'Variação não encontrada',
        currentPage: 'Página Atual',
        aboutThis: 'Sobre este conteúdo',
        custom: 'Custom',
        langApplied: 'Idioma aplicado',
        langNotInPage: 'Esse idioma ainda não foi criado para essa página.',
        langGenerateFor: 'Gerar idioma para essa página',
        langCustomTitle: 'Adicionar idioma customizado',
        langCustomCode: 'Código do idioma',
        langCustomCodePlaceholder: 'ex: fr, de, ja',
        langApplyAll: 'Aplicar em todas as páginas',
        langApplyOnly: 'Somente nesta página',
        langCustomGenerate: 'Gerar idioma',
        langGenerating: 'Gerando idioma...',
        langGenerateSuccess: 'Idioma gerado com sucesso!',
        langGenerateError: 'Erro ao gerar idioma.',
        langAlreadyExists: 'Esse idioma já existe no projeto.',
        langAffectedPages: 'Páginas afetadas',
        detailsSummary: 'Detalhes da Variação',
        langScenarioTitle: 'Idioma',
        langScenarioDesc: 'Gerencie as traduções i18n da página atual. Selecione um idioma existente para visualizá-lo ou adicione um novo.',
        molScenarioDesc: 'Alterne entre variantes de molécula para o widget selecionado. Clique em uma variante para substituí-la na página.',
        molReplaceError: 'Não foi possível substituir a molécula no código fonte.',
        molSelectedOnly: 'Somente selecionado',
        molAllOccurrences: 'Todas ocorrências',
        inDevelopment: 'Em desenvolvimento',
        langRemoveTitle: 'Remover idioma',
        langRemoveBtn: 'Remover',
        langRemoving: 'Removendo idioma...',
        langRemoveSuccess: 'Idioma removido com sucesso!',
        langRemoveError: 'Erro ao remover idioma.',
    },
    es: {
        svcTitle: 'Genome',
        device: 'Dispositivo',
        layout: 'Diseño',
        style: 'Estilo',
        kit: 'UI Kit',
        language: 'Idioma',
        molecules: 'Moléculas',
        noMolecule: 'Seleccione un widget en la vista previa para habilitar variantes de molécula',
        pathLabel: 'Ruta de Variación',
        styleLabel: 'Estilo',
        langLabel: 'Idioma',
        moleculeLabel: 'Molécula',
        generateBtn: 'Generar con Agente',
        variationExists: 'Variación encontrada',
        variationMissing: 'Variación no encontrada',
        currentPage: 'Página Actual',
        aboutThis: 'Acerca de este contenido',
        custom: 'Custom',
        langApplied: 'Idioma aplicado',
        langNotInPage: 'Este idioma aún no fue creado para esta página.',
        langGenerateFor: 'Generar idioma para esta página',
        langCustomTitle: 'Agregar idioma personalizado',
        langCustomCode: 'Código del idioma',
        langCustomCodePlaceholder: 'ej: fr, de, ja',
        langApplyAll: 'Aplicar en todas las páginas',
        langApplyOnly: 'Solo en esta página',
        langCustomGenerate: 'Generar idioma',
        langGenerating: 'Generando idioma...',
        langGenerateSuccess: '¡Idioma generado con éxito!',
        langGenerateError: 'Error al generar idioma.',
        langAlreadyExists: 'Este idioma ya existe en el proyecto.',
        langAffectedPages: 'Páginas afectadas',
        detailsSummary: 'Detalles de la Variación',
        langScenarioTitle: 'Idioma',
        langScenarioDesc: 'Administre las traducciones i18n de la página actual. Seleccione un idioma existente para previsualizarlo o agregue uno nuevo.',
        molScenarioDesc: 'Alterne entre variantes de molécula para el widget seleccionado. Haga clic en una variante para reemplazarla en la página.',
        molReplaceError: 'No se pudo reemplazar la molécula en el código fuente.',
        molSelectedOnly: 'Solo seleccionado',
        molAllOccurrences: 'Todas las ocurrencias',
        inDevelopment: 'En desarrollo',
        langRemoveTitle: 'Eliminar idioma',
        langRemoveBtn: 'Eliminar',
        langRemoving: 'Eliminando idioma...',
        langRemoveSuccess: '¡Idioma eliminado con éxito!',
        langRemoveError: 'Error al eliminar idioma.',
    },
};
/// **collab_i18n_end**

// ─── Knob Config Types ───────────────────────────────────────────────

interface IKnobConfig {
    key: string;
    min: number;
    max: number;
    labels: Record<number, string>;
    disabled?: boolean;
}

// ─── Language state for details row ──────────────────────────────────

type LanguageStatus =
    | { state: 'idle' }
    | { state: 'applied'; lang: string }
    | { state: 'not-in-page'; lang: string }
    | { state: 'custom' };

// ─── Pending agent tasks (generic for all knob types) ────────────────

type TaskStatus = 'running' | 'done' | 'error';

interface IPendingTask {
    status: TaskStatus;
    startedAt: number;
    message?: string;
}

// ─── Static Knob Configurations ──────────────────────────────────────

const KNOB_CONFIGS: Record<string, IKnobConfig> = {
    device: {
        key: 'device',
        min: 1,
        max: 4,
        labels: {
            1: 'web-desktop',
            2: 'web-mobile',
            3: 'ios',
            4: 'android',
        },
    },
    layout: {
        key: 'layout',
        min: 1,
        max: 4,
        labels: {
            1: 'standard',
            2: 'compact',
            3: 'tabs',
            4: 'sidebar',
        },
    },
    style: {
        key: 'style',
        min: 1,
        max: 3,
        labels: {
            1: 'material',
            2: 'glass',
            3: 'neumorphism',
        },
    },
    kit: {
        key: 'kit',
        min: 1,
        max: 4,
        labels: {
            1: 'dense-erp',
            2: 'modern-forms',
            3: 'classic-forms',
            4: 'touch-friendly',
        },
    },
};

// ─── Service ─────────────────────────────────────────────────────────

@customElement('service-genome-102020')
export class ServiceGenome100554 extends ServiceBase {

    // ─── Service definition ───────────────────────────────────────────

    public details: IService = {
        icon: '&#xf568',
        state: 'foreground',
        position: 'right',
        tooltip: 'Genome Customization',
        visible: true,
        widget: '_102020_serviceGenome',
        level: [3],
    };

    public onClickMain(op: string) {

    }

    public menu: IServiceMenu = {
        title: '',
        main: { opAboutThis: 'About this content' },
        tabs: undefined,
        tools: {},
        onClickMain: this.onClickMain.bind(this),
    };

    onServiceClick(_visible: boolean, _reinit: boolean, _el: IToolbarContent | null) {
        this._initLanguageKnob();
    }

    // ─── State ────────────────────────────────────────────────────────

    @state() private msg: MessageType = message_en;

    // knob values (null = not set)
    @state() private _deviceValue: number | null = 1;
    @state() private _layoutValue: number | null = 1;
    @state() private _styleValue: number | null = 1;
    @state() private _kitValue: number | null = 1;
    @state() private _languageValue: number | null = 1;
    @state() private _moleculesValue: number | null = null;

    // which knob is selected (for preferences panel)
    @state() private _selectedKnob: string | null = 'device';

    // language knob — dynamic config built from project
    @state() private _languageConfig: IKnobConfig = {
        key: 'language', min: 1, max: 1, labels: { 1: 'Custom' }, disabled: false,
    };

    // language status for the details row
    @state() private _languageStatus: LanguageStatus = { state: 'idle' };

    // custom language form state
    @state() private _customLangCode: string = '';
    @state() private _customLangApplyAll: boolean = false;
    @state() private _customLangSearch: string = '';
    @state() private _customLangDropdownOpen: boolean = false;

    // remove language scope state
    @state() private _removeLangApplyAll: boolean = false;

    // molecules dynamic config (loaded from context)
    @state() private _moleculesConfig: IKnobConfig = {
        key: 'molecules', min: 1, max: 1, labels: {}, disabled: true,
    };

    // molecules replace mode: selected only or all occurrences
    @state() private _moleculeReplaceMode: 'selected' | 'all' = 'selected';

    // general variation status (for non-language knobs)
    @state() private _variationExists: boolean = true;

    // current page model reference
    @state() private _actualPage?: mls.editor.IModelTS;

    // all pages in the current context (device + layout + kit combination)
    @state() private _actualPages: mls.stor.IFileInfo[] = [];

    // project config reference
    @state() config: mls.l5_common.ProjectConfig | undefined;

    // Generic pending tasks map for all agent operations
    // Key format: "agentType:targetValue" e.g. "language:es", "style:glass"
    @state() private _pendingTasks = new Map<string, IPendingTask>();

    // Molecules context state
    @state() private _selectedMoleculeGroup = '';
    @state() private _selectedMoleculeGroupDescription = '';
    @state() private _selectedMoleculeFiles: mls.stor.IFileInfo[] = [];
    @state() private _oldSelectedTag: string = '';
    @state() private _moleculeError: string = '';

    handleIcaStateChange(key: string, value: any) {
        if (key === 'previewL3.selectedTagName') {
            this._oldSelectedTag = getState('previewL3.selectedTagName');
            this.onPreviewSelectedElementChanged(value);
        }
    }

    // ─── Knob value map ───────────────────────────────────────────────

    private get _knobValues(): Record<string, number | null> {
        return {
            device: this._deviceValue,
            layout: this._layoutValue,
            style: this._styleValue,
            kit: this._kitValue,
            language: this._languageValue,
            molecules: this._moleculesValue,
        };
    }

    private _setKnobValue(key: string, value: number | null) {
        switch (key) {
            case 'device': this._deviceValue = value; break;
            case 'layout': this._layoutValue = value; break;
            case 'style': this._styleValue = value; break;
            case 'kit': this._kitValue = value; break;
            case 'language':
                this._languageValue = value;
                this._onLanguageChanged(value);
                return;
            case 'molecules':
                this._moleculesValue = value;
                this._onMoleculesChanged(value);
                break;
        }

        // Refresh pages list when context-defining knobs change
        if (key === 'device' || key === 'layout' || key === 'kit') {
            this._refreshPagesContext();
        }

        this.requestUpdate();
    }

    // ─── Computed ─────────────────────────────────────────────────────

    private get _deviceLabel(): string {
        const v = this._deviceValue;
        return v !== null ? (KNOB_CONFIGS.device.labels[v] || '—') : '—';
    }

    private get _devicePath(): string {
        const label = this._deviceLabel;
        if (label.startsWith('web-')) return label.replace('-', '/');
        return label;
    }

    private get _pageCode(): string {
        const l = this._layoutValue ?? 0;
        const k = this._kitValue ?? 0;
        return `page${l}${k}`;
    }

    private get _styleName(): string {
        const v = this._styleValue;
        return v !== null ? (KNOB_CONFIGS.style.labels[v] || '—') : '—';
    }

    private get _languageName(): string {
        const v = this._languageValue;
        if (v === null) return '—';
        return this._languageConfig.labels[v] || '—';
    }

    private get _isCustomLanguageSelected(): boolean {
        const v = this._languageValue;
        if (v === null) return false;
        return this._languageConfig.labels[v] === 'Custom';
    }

    /** Check if the custom language code already exists in the project language config */
    private get _customLangAlreadyExists(): boolean {
        if (!this._customLangCode) return false;
        const existingLangs = Object.values(this._languageConfig.labels).filter(l => l !== 'Custom');
        return existingLangs.includes(this._customLangCode);
    }

    /** Whether the custom generate button should be enabled */
    private get _canGenerateCustomLang(): boolean {
        return !!this._customLangCode && !this._customLangAlreadyExists;
    }

    /** Languages available for custom selection (excluding those already in the project) */
    private get _availableLanguages(): ICollabLanguage[] {
        const existingCodes = Object.values(this._languageConfig.labels)
            .filter(l => l !== 'Custom');
        return allLanguages.filter(l => !existingCodes.includes(l.code));
    }

    /** Filtered languages based on search input */
    private get _filteredLanguages(): ICollabLanguage[] {
        const search = this._customLangSearch.toLowerCase();
        if (!search) return this._availableLanguages;
        return this._availableLanguages.filter(l =>
            l.name.toLowerCase().includes(search) ||
            l.code.toLowerCase().includes(search)
        );
    }

    /** Display name for selected custom language */
    private get _customLangDisplayName(): string {
        if (!this._customLangCode) return '';
        const found = allLanguages.find(l => l.code === this._customLangCode);
        return found ? `${found.name} (${found.code})` : this._customLangCode;
    }

    private get _moleculeName(): string {
        const v = this._moleculesValue;
        if (v === null) return '—';
        return this._moleculesConfig.labels[v] || '—';
    }

    private get _variationPath(): string {
        return `${this._devicePath}/${this._pageCode}/home.ts`;
    }

    // ─── Active knob config (for preferences row) ────────────────────

    private _getKnobConfig(key: string): IKnobConfig {
        if (key === 'molecules') return this._moleculesConfig;
        if (key === 'language') return this._languageConfig;
        return KNOB_CONFIGS[key];
    }

    private get _activeKnobConfig(): IKnobConfig | null {
        if (!this._selectedKnob) return null;
        return this._getKnobConfig(this._selectedKnob);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Molecule Logic ───────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    private onPreviewSelectedElementChanged(tag: string) {

        const isWebComponent = this.isWebComponent(tag);
        const groupsMolecules = this.getMolecules();
        const actualGroup = this.extractGroupFromTag(tag);

        // nenhum grupo válido encontrado
        if (!isWebComponent || !actualGroup || !groupsMolecules.get(actualGroup)) {

            this._moleculesConfig = {
                key: 'molecules',
                min: 1,
                max: 1,
                labels: {},
                disabled: true,
            };

            this._moleculesValue = null;
            this._selectedMoleculeGroup = '';
            this._selectedMoleculeGroupDescription = '';
            this._selectedMoleculeFiles = [];
            this._moleculeError = '';

            if (this._selectedKnob === 'molecules') {
                this._selectedKnob = null;
            }

            this.requestUpdate();
            return;
        }

        const widgetsFromGroup =
            groupsMolecules.get(actualGroup) as mls.stor.IFileInfo[];

        const groupDescription =
            listOfGroups.find(
                (item) => item.name.toLowerCase() === actualGroup
            )?.description || '';

        // monta labels do knob
        const labels: Record<number, string> = {};
        widgetsFromGroup.forEach((item, index) => {
            labels[index + 1] = item.shortName;
        });

        this._moleculesConfig = {
            key: 'molecules',
            min: 1,
            max: widgetsFromGroup.length,
            labels,
            disabled: false,
        };

        // pega nome da molecule atual pela tag
        const currentMoleculeName = tag.replace(`${actualGroup}-`, '');

        // tenta encontrar índice da molecule atual
        const currentIndex = widgetsFromGroup.findIndex(
            (item) =>
                item.shortName.toLowerCase() ===
                currentMoleculeName.toLowerCase()
        );

        console.log('[Genome] Matching molecule', {
            tag,
            group: actualGroup,
            moleculeName: currentMoleculeName,
            currentIndex,
            availableNames: widgetsFromGroup.map(w => w.shortName),
        });

        // Set value directly (not via _setKnobValue) to avoid triggering _onMoleculesChanged
        if (currentIndex !== -1) {
            this._moleculesValue = currentIndex + 1;
        } else {
            // Fallback: try partial match (shortName contains or is contained in moleculeName)
            const partialIndex = widgetsFromGroup.findIndex(
                (item) =>
                    currentMoleculeName.toLowerCase().includes(item.shortName.toLowerCase()) ||
                    item.shortName.toLowerCase().includes(currentMoleculeName.toLowerCase())
            );

            if (partialIndex !== -1) {
                this._moleculesValue = partialIndex + 1;
            } else if (this._moleculesValue === null || !labels[this._moleculesValue]) {
                this._moleculesValue = 1;
            }
        }

        this._selectedMoleculeGroup = actualGroup;
        this._selectedMoleculeGroupDescription = groupDescription;
        this._selectedMoleculeFiles = widgetsFromGroup;
        this._moleculeError = '';

        console.log('[Genome] Molecule selected', {
            group: actualGroup,
            description: groupDescription,
            selected: widgetsFromGroup[(this._moleculesValue || 1) - 1],
        });

        this.requestUpdate();
    }

    private getMolecules() {

        const files = Object.values(mls.stor.files) as mls.stor.IFileInfo[];

        const htmlFiles = files.filter(
            (file) => file.extension === '.html' && file.folder.startsWith('molecules') && file.shortName !== 'index'
        );

        const folderMap = new Map<string, mls.stor.IFileInfo[]>();
        for (const file of htmlFiles) {
            const folderKey = file.folder.replace(/^molecules\//, '').toLowerCase();
            if (!folderMap.has(folderKey)) {
                folderMap.set(folderKey, []);
            }
            folderMap.get(folderKey)!.push(file);
        }

        return folderMap;
    }

    private isWebComponent(tagName: string) {
        if (!tagName || typeof tagName !== 'string') return false;
        if (!tagName.includes('-')) return false;
        return true;
    }

    private extractGroupFromTag(tagName: string) {
        if (!tagName.includes('-')) return null;
        return tagName.split('-')[0];
    }

    /**
     * Called every time the molecule knob value changes.
     */
    private async _onMoleculesChanged(value: number | null) {

        if (!value || !this._actualPage) return;

        const selectedFile = this._selectedMoleculeFiles[value - 1];
        if (!selectedFile) return;

        // Clear any previous error
        this._moleculeError = '';

        const selector = getState('previewL3.selectedElement');
        const newTag = convertFileToTag(selectedFile);
        const tsModel = this._actualPage;
        const source = tsModel.model.getValue();

        console.log('[Genome] Molecule knob changed', {
            value,
            label: this._moleculesConfig.labels[value],
            newTag,
            oldTag: this._oldSelectedTag,
            file: selectedFile,
            selector,
            mode: this._moleculeReplaceMode,
        });

        const result = replaceComponentTag(
            this._oldSelectedTag,
            newTag,
            source,
            selector,
            this._moleculeReplaceMode
        );

        if (!result.success) {
            this._moleculeError = this.msg.molReplaceError;
            this.requestUpdate();
            return;
        }

        tsModel.model.pushEditOperations(
            [],
            [{
                range: tsModel.model.getFullModelRange(),
                text: result.newSource || source,
            }],
            () => null,
        );

        // Update old tag so next swap works correctly
        this._oldSelectedTag = newTag;

        // Signal the preview editor to re-select this tag after the iframe repaints
        setState('preview.pendingReselect', newTag);

        mls.editor.forceModelUpdate(tsModel.model)


    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Language Logic ───────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Called on service init and when page changes.
     * Fetches project languages and rebuilds the language knob config.
     */
    private async _initLanguageKnob() {
        const projectLangs = await this.getLanguagesInProject();

        const labels: Record<number, string> = {};
        projectLangs.forEach((lang, i) => {
            labels[i + 1] = lang;
        });
        labels[projectLangs.length + 1] = 'Custom';

        this._languageConfig = {
            key: 'language',
            min: 1,
            max: projectLangs.length + 1,
            labels,
            disabled: false,
        };

        if (this._languageValue === null || this._languageValue > this._languageConfig.max) {
            this._languageValue = 1;
        }

        this._onLanguageChanged(this._languageValue);
    }

    /**
     * Called every time the language knob value changes.
     */
    private async _onLanguageChanged(value: number | null) {
        if (value === null) {
            this._languageStatus = { state: 'idle' };
            this.requestUpdate();
            return;
        }

        const langLabel = this._languageConfig.labels[value];

        if (langLabel === 'Custom') {
            this._languageStatus = { state: 'custom' };
            this._customLangCode = '';
            this._customLangApplyAll = false;
            this._customLangSearch = '';
            this._customLangDropdownOpen = false;
            this.requestUpdate();
            return;
        }

        const taskKey = `language:${langLabel}`;
        const task = this._pendingTasks.get(taskKey);

        if (task && task.status === 'running') {
            this._languageStatus = { state: 'not-in-page', lang: langLabel };
            this.requestUpdate();
            return;
        }

        // Also check if a remove task is running
        const removeTaskKey = `remove-language:${langLabel}`;
        const removeTask = this._pendingTasks.get(removeTaskKey);
        if (removeTask && removeTask.status === 'running') {
            this._languageStatus = { state: 'applied', lang: langLabel };
            this.requestUpdate();
            return;
        }

        const exists = await this.checkHasLanguageInActualPage(langLabel);

        if (exists) {
            this.changeActualLanguageInPreview(langLabel);
            this._languageStatus = { state: 'applied', lang: langLabel };
            this._pendingTasks.delete(taskKey);
        } else {
            this._languageStatus = { state: 'not-in-page', lang: langLabel };
        }

        this.requestUpdate();
    }

    private threadCache = new Map<string, Promise<mls.msg.ThreadPerformanceCache | undefined>>();
    private async executeAgent(agentName: string, prompt: string) {

        const fullName = '_102020_/l2/serviceGenome';

        let threadPromise = this.threadCache.get('_102020_/l2/serviceGenome');

        if (!threadPromise) {
            threadPromise = (async () => {
                let thread = await getThreadByName(fullName);
                if (!thread) {
                    thread = await createThread(fullName, [], 'company');
                }
                return thread;
            })();
            this.threadCache.set(fullName, threadPromise);
        }

        const thread = await threadPromise;
        const userId = getUserId();
        if (!userId) return;

        const threadId = thread?.threadId;
        if (!threadId) {
            this.setError('Cannot find thread');
            return;
        }

        const moduleAgent = await loadAgent(agentName);
        if (!moduleAgent) throw new Error('Invalid agent');
        const context = getTemporaryContext(threadId, userId, prompt);
        await executeBeforePrompt(moduleAgent, context);
    }

    // ─── External functions ───────────────────────────────────────────

    private _getSharedFolder(folder: string): string {
        const parts = folder.split('/');
        parts[parts.length - 1] = 'shared';
        return parts.join('/');
    }

    private _getSharedStorFile(fileInfo: mls.stor.IFileInfo): mls.stor.IFileInfo | undefined {
        const sharedFolder = this._getSharedFolder(fileInfo.folder);
        return Object.values(mls.stor.files).find(
            (f) => f.project === fileInfo.project
                && f.folder === sharedFolder
                && f.shortName === fileInfo.shortName
                && f.extension === fileInfo.extension
        );
    }

    private async getLanguagesInProject(): Promise<string[]> {
        const project = mls.actualProject;
        if (!project) return [];
        this.config = await getConfigProject(project);
        if (!this.config || !this.config.languages || this.config.languages.length === 0) return [];
        const lg = this.config.languages.map((item) => item.language);
        return lg;
    }

    private async checkHasLanguageInActualPage(lang: string): Promise<boolean> {
        if (!this._actualPage) return false;
        const sharedFile = this._getSharedStorFile(this._actualPage.storFile);
        if (sharedFile) {
            const modelKey = `_${sharedFile.project}_${sharedFile.folder}_${sharedFile.shortName}`;
            const model = (mls.editor.models as any)[modelKey]?.ts?.model;
            if (model) return this._hasLanguageInI18nBlock(model.getValue(), lang);
        }
        const value = this._actualPage.model.getValue();
        return this._hasLanguageInI18nBlock(value, lang);
    }

    private _hasLanguageInI18nBlock(source: string, lang: string): boolean {
        const startMarker = '/// **collab_i18n_start**';
        const endMarker = '/// **collab_i18n_end**';
        const startIdx = source.indexOf(startMarker);
        const endIdx = source.indexOf(endMarker);
        if (startIdx === -1 || endIdx === -1) return false;

        const i18nBlock = source.substring(startIdx, endIdx);

        const keyPatterns = [
            new RegExp(`\\b${lang}\\s*:`, 'm'),
            new RegExp(`['"]${lang}['"]\\s*:`, 'm'),
        ];

        return keyPatterns.some(pattern => pattern.test(i18nBlock));
    }

    private async changeActualLanguageInPreview(lang: string) {
        setState('preview.language', lang)
        console.log('[ServiceGenome] changeActualLanguageInPreview:', lang);
    }

    private async generateLanguage(lang: string, applyAll: boolean) {
        console.log('[ServiceGenome] generateLanguage:', lang, 'applyAll:', applyAll);

        const taskKey = `language:${lang}`;

        const existing = this._pendingTasks.get(taskKey);
        if (existing && existing.status === 'running') {
            console.log('[ServiceGenome] Agent already running for:', taskKey);
            return;
        }

        if (!this._actualPage) return;

        if (this._isCustomLanguageSelected) {
            await this.addLanguageInProject(lang);
            await this._initLanguageKnob();
        }

        this._pendingTasks.set(taskKey, { status: 'running', startedAt: Date.now() });
        this._languageStatus = { state: 'not-in-page', lang };
        this.requestUpdate();

        try {
            const data: { languages: string[]; fileReference: string }[] = [];

            if (applyAll && this._actualPages.length > 0) {
                const seen = new Set<string>();
                for (const fileInfo of this._actualPages) {
                    const target = this._getSharedStorFile(fileInfo) ?? fileInfo;
                    const dedupeKey = `${target.folder}/${target.shortName}`;
                    if (seen.has(dedupeKey)) continue;
                    seen.add(dedupeKey);
                    const { project, shortName, folder, extension } = target;
                    data.push({
                        languages: [lang],
                        fileReference: `_${project}_/l2/${folder ? folder + '/' : ''}${shortName}${extension}`,
                    });
                }
            } else {
                const target = this._getSharedStorFile(this._actualPage.storFile) ?? this._actualPage.storFile;
                const { project, shortName, folder, extension } = target;
                data.push({
                    languages: [lang],
                    fileReference: `_${project}_/l2/${folder ? folder + '/' : ''}${shortName}${extension}`,
                });
            }



            await this.executeAgent('agentAddLanguage', JSON.stringify(data));
            const exists = await this.checkHasLanguageInActualPage(lang);

            if (exists) {
                this._pendingTasks.set(taskKey, { status: 'done', startedAt: Date.now() });
                if (this._languageName === lang) {
                    this.changeActualLanguageInPreview(lang);
                    this._languageStatus = { state: 'applied', lang };
                }
            } else {
                this._pendingTasks.set(taskKey, { status: 'error', startedAt: Date.now(), message: this.msg.langGenerateError });

                if (this._languageName === lang) {
                    this._languageStatus = { state: 'not-in-page', lang };
                }
            }

            setTimeout(() => {
                this._pendingTasks.delete(taskKey);
                this.requestUpdate();
            }, 3000);

        } catch (err) {
            console.error('[ServiceGenome] generateLanguage error:', err);
            this._pendingTasks.set(taskKey, { status: 'error', startedAt: Date.now(), message: this.msg.langGenerateError });

            if (this._languageName === lang) {
                this._languageStatus = { state: 'not-in-page', lang };
            }

            setTimeout(() => {
                this._pendingTasks.delete(taskKey);
                this.requestUpdate();
            }, 3000);
        }

        this.requestUpdate();
    }


    // ─── Remove Language ──────────────────────────────────────────────

    private async removeLanguage(lang: string, applyAll: boolean) {
        console.log('[ServiceGenome] removeLanguage:', lang, 'applyAll:', applyAll);

        const taskKey = `remove-language:${lang}`;

        const existing = this._pendingTasks.get(taskKey);
        if (existing && existing.status === 'running') {
            console.log('[ServiceGenome] Remove agent already running for:', taskKey);
            return;
        }

        if (!this._actualPage) return;

        this._pendingTasks.set(taskKey, { status: 'running', startedAt: Date.now() });
        this.requestUpdate();

        try {
            const data: { languages: string[]; fileReference: string }[] = [];

            if (applyAll && this._actualPages.length > 0) {
                const seen = new Set<string>();
                for (const fileInfo of this._actualPages) {
                    const target = this._getSharedStorFile(fileInfo) ?? fileInfo;
                    const dedupeKey = `${target.folder}/${target.shortName}`;
                    if (seen.has(dedupeKey)) continue;
                    seen.add(dedupeKey);
                    const { project, shortName, folder, extension } = target;
                    data.push({
                        languages: [lang],
                        fileReference: `_${project}_/l2/${folder ? folder + '/' : ''}${shortName}${extension}`,
                    });
                }
            } else {
                const target = this._getSharedStorFile(this._actualPage.storFile) ?? this._actualPage.storFile;
                const { project, shortName, folder, extension } = target;
                data.push({
                    languages: [lang],
                    fileReference: `_${project}_/l2/${folder ? folder + '/' : ''}${shortName}${extension}`,
                });
            }

            await this.executeAgent('agentRemoveLanguage', JSON.stringify(data));

            const stillExists = await this.checkHasLanguageInActualPage(lang);

            if (!stillExists) {
                this._pendingTasks.set(taskKey, { status: 'done', startedAt: Date.now() });
                if (this._languageName === lang) {
                    this._languageStatus = { state: 'not-in-page', lang };
                }
            } else {
                this._pendingTasks.set(taskKey, { status: 'error', startedAt: Date.now(), message: this.msg.langRemoveError });
            }

            this.changeActualLanguageInPreview(lang);

            setTimeout(() => {
                this._pendingTasks.delete(taskKey);
                this.requestUpdate();
            }, 3000);

        } catch (err) {
            console.error('[ServiceGenome] removeLanguage error:', err);
            this._pendingTasks.set(taskKey, { status: 'error', startedAt: Date.now(), message: this.msg.langRemoveError });

            setTimeout(() => {
                this._pendingTasks.delete(taskKey);
                this.requestUpdate();
            }, 3000);
        }

        this.requestUpdate();
    }

    // ─── Language event handlers ──────────────────────────────────────

    private _onGenerateLanguageForPage() {
        if (this._languageStatus.state === 'not-in-page') {
            this.generateLanguage(this._languageStatus.lang, false);
        }
    }

    private _onRemoveLanguageClick() {
        if (this._languageStatus.state === 'applied') {
            this.removeLanguage(this._languageStatus.lang, this._removeLangApplyAll);
        }
    }

    private _onCustomLangSearchInput(e: Event) {
        this._customLangSearch = (e.target as HTMLInputElement).value;
        this._customLangDropdownOpen = true;
    }

    private _onCustomLangSearchFocus() {
        this._customLangDropdownOpen = true;
    }

    private _onCustomLangSelect(code: string) {
        this._customLangCode = code;
        this._customLangSearch = '';
        this._customLangDropdownOpen = false;
        this.requestUpdate();
    }

    private _onCustomLangClear() {
        this._customLangCode = '';
        this._customLangSearch = '';
        this._customLangDropdownOpen = false;
        this.requestUpdate();
    }

    private _onCustomLangApplyAllToggle() {
        this._customLangApplyAll = !this._customLangApplyAll;
    }

    private _onCustomLangGenerate() {
        if (!this._canGenerateCustomLang) return;
        this.generateLanguage(this._customLangCode, this._customLangApplyAll);
    }

    private async addLanguageInProject(lang: string): Promise<void> {
        if (!this.config || !mls.actualProject) return;
        console.log('[ServiceGenome] addLanguageInProject:', lang);

        const langInfo = allLanguages.find(l => l.code === lang);
        const name = langInfo ? langInfo.name : lang;

        this.config.languages.push({
            language: lang,
            name,
            path: `/${lang}`
        });
        await updateConfigProject(mls.actualProject, { ...this.config });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── General Event Handlers ───────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    private _onKnobChange(key: string, e: CustomEvent) {
        this._selectedKnob = key;
        this._setKnobValue(key, e.detail.value);
    }

    private _onKnobClick(key: string) {
        this._selectedKnob = key;
        this.requestUpdate();
    }

    private _onChipClick(key: string, value: number) {
        this._setKnobValue(key, value);
    }

    private _onGenerateClick() {
        console.log('[ServiceGenome] Generate variation:', this._variationPath);
        this.dispatchEvent(new CustomEvent('genome-generate', {
            bubbles: true,
            composed: true,
            detail: {
                path: this._variationPath,
                device: this._deviceLabel,
                layout: this._layoutValue,
                kit: this._kitValue,
                style: this._styleName,
                language: this._languageName,
                molecule: this._moleculeName,
            },
        }));
    }

    // ─── Public: update molecules from external context ───────────────

    public setMoleculesOptions(labels: Record<number, string>) {
        const keys = Object.keys(labels).map(Number);
        if (keys.length === 0) {
            this._moleculesConfig = { key: 'molecules', min: 1, max: 1, labels: {}, disabled: true };
            this._moleculesValue = null;
        } else {
            this._moleculesConfig = {
                key: 'molecules',
                min: Math.min(...keys),
                max: Math.max(...keys),
                labels,
                disabled: false,
            };
            if (this._moleculesValue !== null &&
                (this._moleculesValue < this._moleculesConfig.min ||
                    this._moleculesValue > this._moleculesConfig.max)) {
                this._moleculesValue = this._moleculesConfig.min;
            }
        }
        this.requestUpdate();
    }

    // ─── Lifecycle ────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        this._initLanguageKnob();
        subscribe('previewL3.selectedTagName', this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        unsubscribe('previewL3.selectedTagName', this);
    }

    firstUpdated() {
        this.setActualPage();
        this._refreshPagesContext();
    }

    private setActualPage(): void {
        this._actualPage = mls.editor.models['_102020_pizzaria/web/desktop/page11_login'].ts;
    }

    // ─── Pages Context ────────────────────────────────────────────────

    private async _refreshPagesContext() {
        this._actualPages = await this.getAllPagesInActualContext();
        this.requestUpdate();
    }

    private async getAllPagesInActualContext(): Promise<mls.stor.IFileInfo[]> {
        console.log('[ServiceGenome] getAllPagesInActualContext:', this._devicePath, this._pageCode);
        if (!this._actualPage || !this._actualPage.storFile) return [];
        const { project } = this._actualPage.storFile;
        return Object.values(mls.stor.files).filter((item) =>
            item.project === project &&
            item.folder.endsWith(`${this._devicePath}/${this._pageCode}`) &&
            item.extension === '.ts'
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Render ───────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    createRenderRoot() { return this; }

    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];

        return html`
            <div class="flex flex-col min-h-full bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
                ${this._renderKnobRow()}
                ${this._renderPreferencesRow()}
                ${this._renderDetailsRow()}
            </div>
        `;
    }

    // ─── Knob Row ─────────────────────────────────────────────────────

    private _renderKnobRow() {
        return html`
            <div class="
                flex flex-wrap items-center justify-center
                px-2 py-3
                border-b border-gray-200 dark:border-gray-800
                gap-0
            " style="--knob-scale: 0.5">
                <!-- Group 1: Device -->
                <div class="flex flex-wrap items-center justify-center">
                    ${this._renderKnobItem('device')}
                </div>

                <!-- Separator -->
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-800 shrink-0"></div>

                <!-- Group 2: Layout + Kit -->
                <div class="flex flex-wrap items-center justify-center">
                    ${this._renderKnobItem('layout')}
                    ${this._renderKnobItem('kit')}
                </div>

                <!-- Separator -->
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-800 shrink-0"></div>

                <!-- Group 3: Style + Language + Molecules -->
                <div class="flex flex-wrap items-center justify-center">
                    ${this._renderKnobItem('style')}
                    ${this._renderKnobItem('language')}
                    ${this._renderKnobItem('molecules')}
                </div>
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
            <div
                class="
                    flex flex-col items-center gap-0.5
                    ${isDisabled ? 'opacity-30' : ''}
                "
            >
                <collab-select-knob-102027
                    .min=${config.min}
                    .max=${config.max}
                    .value=${value}
                    .step=${1}
                    .disabled=${isDisabled}
                    .selected=${!isDisabled}
                    .showTicks=${false}
                    @knob-change=${(e: CustomEvent) => this._onKnobChange(key, e)}
                ></collab-select-knob-102027>

                <!-- Label + LED: clicking here changes context (which LED is lit) -->
                <div
                    class="flex flex-col items-center gap-0.5 cursor-pointer"
                    @click=${() => { if (!isDisabled) this._onKnobClick(key); }}
                >
                    <span class="
                        text-[9px] font-semibold uppercase tracking-wider
                        ${isContext
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-600'}
                        transition-colors duration-200
                    ">${label}</span>

                    <!-- LED indicator -->
                    <div class="
                        w-1.5 h-1.5 rounded-full
                        transition-all duration-200
                        ${isContext
                ? 'bg-cyan-400 shadow-[0_0_4px_1px_rgba(34,211,238,0.6),0_0_8px_2px_rgba(34,211,238,0.3)]'
                : 'bg-gray-400/30 dark:bg-gray-700'}
                    "></div>
                </div>
            </div>
        `;
    }

    // ─── Preferences Row (chips for selected knob) ────────────────────

    private _renderPreferencesRow() {
        const config = this._activeKnobConfig;

        if (!config) {
            return html`
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 min-h-[52px]"></div>
            `;
        }

        if (config.key === 'molecules' && config.disabled) {
            return html`
                <div class="
                    px-4 py-3 border-b border-gray-200 dark:border-gray-800
                    min-h-[52px] flex items-center
                ">
                    <span class="text-xs text-gray-400 dark:text-gray-600 italic">
                        ${this.msg.noMolecule}
                    </span>
                </div>
            `;
        }

        const currentValue = this._knobValues[config.key];
        const entries = Object.entries(config.labels).map(([k, v]) => ({
            num: Number(k),
            label: v,
        }));

        return html`
            <div class="
                px-4 py-3 border-b border-gray-200 dark:border-gray-800
                min-h-[52px]
            ">
                <div class="flex flex-wrap gap-2">
                    ${entries.map(({ num, label }) => {
            const isActive = currentValue === num;
            const isCustom = label === 'Custom';
            return html`
                            <button
                                class="
                                    inline-flex items-center gap-1.5
                                    px-2.5 py-1 rounded-full
                                    text-[11px] font-medium
                                    transition-all duration-150
                                    cursor-pointer border
                                    ${isActive
                    ? isCustom
                        ? 'bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:border-violet-500 shadow-sm'
                        : 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-sm'
                    : isCustom
                        ? 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/50'
                        : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}
                                "
                                @click=${() => this._onChipClick(config.key, num)}
                            >
                                ${isCustom
                    ? html`<span class="text-[11px]">+</span>`
                    : html`
                                        <span class="
                                            inline-flex items-center justify-center
                                            w-4 h-4 rounded-full text-[9px] font-bold
                                            ${isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}
                                        ">${num}</span>
                                    `}
                                ${label}
                            </button>
                        `;
        })}
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Details Row ──────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    private _renderDetailsRow() {
        return html`
            <div class="flex flex-col gap-0 flex-1">

                <!-- Collapsible: Variation Details -->
                <details class="group border-b border-gray-200 dark:border-gray-800">
                    <summary class="
                        flex items-center gap-2 px-4 py-2.5
                        cursor-pointer select-none
                        text-[10px] font-semibold uppercase tracking-wider
                        text-gray-400 dark:text-gray-600
                        hover:text-gray-500 dark:hover:text-gray-500
                    ">
                        <span class="
                            transition-transform duration-200
                            group-open:rotate-90
                            text-[8px]
                        ">▶</span>
                        ${this.msg.detailsSummary}
                    </summary>
                    <div class="flex flex-col gap-2 px-4 pb-3">
                        <div class="
                            flex items-center gap-2 px-2.5 py-1.5 rounded
                            bg-gray-50 dark:bg-gray-900
                            border border-gray-200 dark:border-gray-800
                            font-mono text-[11px] text-gray-600 dark:text-gray-400
                        ">
                            <span class="text-gray-400 dark:text-gray-600 text-xs">📁</span>
                            ${this._variationPath}
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            ${this._renderDetailBadge(this.msg.styleLabel, this._styleName)}
                            ${this._renderDetailBadge(this.msg.langLabel, this._languageName)}
                            ${this._moleculesValue !== null
                ? this._renderDetailBadge(this.msg.moleculeLabel, this._moleculeName)
                : nothing}
                        </div>
                    </div>
                </details>

                <!-- Context-sensitive scenario area -->
                <div class="flex flex-col gap-3 px-4 py-3 flex-1">
                    ${this._renderContextStatusArea()}
                </div>
            </div>
        `;
    }

    // ─── Context-sensitive status (based on selected knob) ────────────

    private _renderContextStatusArea() {
        switch (this._selectedKnob) {
            case 'language':
                return html`
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                ${this.msg.langScenarioTitle}
                            </span>
                            <span class="
                                text-[10px] font-mono px-1.5 py-0.5 rounded
                                bg-gray-100 dark:bg-gray-800
                                text-gray-500 dark:text-gray-400
                            ">${this._languageName}</span>
                        </div>
                        <span class="text-[11px] text-gray-400 dark:text-gray-600 leading-relaxed">
                            ${this.msg.langScenarioDesc}
                        </span>
                    </div>

                    ${this._renderLanguageStatusArea()}

                    ${this._languageStatus.state === 'idle' || this._languageStatus.state === 'applied'
                        ? this._renderGeneralStatus()
                        : nothing}
                `;

            case 'device':
                return this._renderInDevelopment(this.msg.device);

            case 'layout':
                return this._renderInDevelopment(this.msg.layout);

            case 'kit':
                return this._renderInDevelopment(this.msg.kit);

            case 'style':
                return this._renderInDevelopment(this.msg.style);

            case 'molecules':
                return this._renderMoleculesScenario();

            default:
                return nothing;
        }
    }

    // ─── In Development placeholder ───────────────────────────────────

    private _renderInDevelopment(knobLabel: string) {
        return html`
            <div class="
                flex items-center gap-2 px-3 py-2.5 rounded-lg
                bg-gray-100 dark:bg-gray-900
                border border-dashed border-gray-300 dark:border-gray-700
            ">
                <span class="text-sm">🚧</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                    ${this.msg.inDevelopment}: <span class="font-semibold">${knobLabel}</span>
                </span>
            </div>
        `;
    }

    // ─── Molecules scenario area ──────────────────────────────────────

    private _renderMoleculesScenario() {

        if (this._moleculesConfig.disabled) {
            return html`
                <div class="
                    flex items-center gap-2 px-3 py-2.5 rounded-lg
                    bg-gray-100 dark:bg-gray-900
                    border border-dashed border-gray-300 dark:border-gray-700
                ">
                    <span class="text-sm">🧬</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                        ${this.msg.noMolecule}
                    </span>
                </div>
            `;
        }

        const selectedFile =
            this._selectedMoleculeFiles[(this._moleculesValue || 1) - 1];

        return html`
            <!-- Header -->
            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        ${this._selectedMoleculeGroup}
                    </span>
                    <span class="
                        text-[10px] font-mono px-1.5 py-0.5 rounded
                        bg-indigo-100 dark:bg-indigo-900/40
                        text-indigo-700 dark:text-indigo-300
                    ">
                        ${this._moleculeName}
                    </span>
                </div>
                <span class="text-[11px] text-gray-400 dark:text-gray-600 leading-relaxed">
                    ${this._selectedMoleculeGroupDescription || this.msg.molScenarioDesc}
                </span>
            </div>

            <!-- Replace mode radio -->
            <fieldset class="
                border border-gray-200 dark:border-gray-700
                rounded-lg px-3 pt-1 pb-2
            ">
                <legend class="
                    text-[10px] font-medium px-1
                    text-gray-400 dark:text-gray-500
                ">${this.msg.currentPage}</legend>
                <div class="flex items-center gap-4">
                    <label class="
                        inline-flex items-center gap-1.5 cursor-pointer
                        text-[11px] text-gray-500 dark:text-gray-400
                    ">
                        <input
                            type="radio"
                            name="molReplaceMode"
                            .checked=${this._moleculeReplaceMode === 'selected'}
                            @change=${() => { this._moleculeReplaceMode = 'selected'; this.requestUpdate(); }}
                            class="w-3 h-3 accent-indigo-600"
                        />
                        ${this.msg.molSelectedOnly}
                    </label>
                    <label class="
                        inline-flex items-center gap-1.5 cursor-pointer
                        text-[11px] text-gray-500 dark:text-gray-400
                    ">
                        <input
                            type="radio"
                            name="molReplaceMode"
                            .checked=${this._moleculeReplaceMode === 'all'}
                            @change=${() => { this._moleculeReplaceMode = 'all'; this.requestUpdate(); }}
                            class="w-3 h-3 accent-indigo-600"
                        />
                        ${this.msg.molAllOccurrences}
                    </label>
                </div>
            </fieldset>

            <!-- Error message -->
            ${this._moleculeError
                ? html`
                    <div class="
                        flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-red-50 dark:bg-red-900/20
                        border border-red-200 dark:border-red-800
                    ">
                        <span class="w-2 h-2 rounded-full bg-red-500"></span>
                        <span class="text-xs text-red-700 dark:text-red-400 font-medium">
                            ${this._moleculeError}
                        </span>
                    </div>
                `
                : nothing}

            <!-- Selected file info -->
            ${selectedFile
                ? html`
                    <div class="
                        flex flex-col gap-2
                        px-3 py-3 rounded-lg
                        bg-indigo-50 dark:bg-indigo-900/20
                        border border-indigo-200 dark:border-indigo-800
                    ">
                        <div class="flex items-center gap-2">
                            <span class="text-sm">🧩</span>
                            <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                ${selectedFile.shortName}
                            </span>
                        </div>
                        <div class="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 break-all">
                            ${selectedFile.folder}/${selectedFile.shortName}${selectedFile.extension}
                        </div>
                    </div>
                `
                : nothing}
        `;
    }

    // ─── Language status area (contextual) ────────────────────────────

    private _renderLanguageStatusArea() {
        const currentLang = this._languageStatus.state === 'not-in-page' || this._languageStatus.state === 'applied'
            ? this._languageStatus.lang
            : null;

        // Check for add-language pending task
        const taskKey = currentLang ? `language:${currentLang}` : null;
        const task = taskKey ? this._pendingTasks.get(taskKey) : null;

        // Check for remove-language pending task
        const removeTaskKey = currentLang ? `remove-language:${currentLang}` : null;
        const removeTask = removeTaskKey ? this._pendingTasks.get(removeTaskKey) : null;

        // Show remove task status if active
        if (removeTask) {
            switch (removeTask.status) {
                case 'running':
                    return html`
                        <div class="
                            flex items-center gap-3 px-3 py-3 rounded-lg
                            bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800
                        ">
                            <svg class="w-4 h-4 animate-spin text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round"
                                    style="opacity:0.25"></circle>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
                            </svg>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-xs text-red-700 dark:text-red-400 font-medium">
                                    ${this.msg.langRemoving}
                                </span>
                                <span class="text-[10px] font-mono text-red-500 dark:text-red-500">
                                    ${currentLang}
                                </span>
                            </div>
                        </div>
                    `;

                case 'done':
                    return html`
                        <div class="
                            flex items-center gap-2 px-3 py-2 rounded-lg
                            bg-emerald-50 dark:bg-emerald-900/20
                            border border-emerald-200 dark:border-emerald-800
                        ">
                            <span class="text-sm">✓</span>
                            <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                ${this.msg.langRemoveSuccess}
                            </span>
                            <span class="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">
                                ${currentLang}
                            </span>
                        </div>
                    `;

                case 'error':
                    return html`
                        <div class="
                            flex items-center gap-2 px-3 py-2 rounded-lg
                            bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800
                        ">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            <span class="text-xs text-red-700 dark:text-red-400 font-medium">
                                ${removeTask.message || this.msg.langRemoveError}
                            </span>
                        </div>
                    `;
            }
        }

        // Show add task status if active
        if (task) {
            switch (task.status) {
                case 'running':
                    return html`
                        <div class="
                            flex items-center gap-3 px-3 py-3 rounded-lg
                            bg-indigo-50 dark:bg-indigo-900/20
                            border border-indigo-200 dark:border-indigo-800
                        ">
                            <svg class="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round"
                                    style="opacity:0.25"></circle>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
                            </svg>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                                    ${this.msg.langGenerating}
                                </span>
                                <span class="text-[10px] font-mono text-indigo-500 dark:text-indigo-500">
                                    ${currentLang}
                                </span>
                            </div>
                        </div>
                    `;

                case 'done':
                    return html`
                        <div class="
                            flex items-center gap-2 px-3 py-2 rounded-lg
                            bg-emerald-50 dark:bg-emerald-900/20
                            border border-emerald-200 dark:border-emerald-800
                        ">
                            <span class="text-sm">✓</span>
                            <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                ${this.msg.langGenerateSuccess}
                            </span>
                            <span class="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">
                                ${currentLang}
                            </span>
                        </div>
                    `;

                case 'error':
                    return html`
                        <div class="
                            flex items-center gap-2 px-3 py-2 rounded-lg
                            bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800
                        ">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            <span class="text-xs text-red-700 dark:text-red-400 font-medium">
                                ${task.message || this.msg.langGenerateError}
                            </span>
                        </div>
                    `;
            }
        }

        switch (this._languageStatus.state) {

            case 'applied':
                return html`
                    <div class="
                        flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-emerald-50 dark:bg-emerald-900/20
                        border border-emerald-200 dark:border-emerald-800
                    ">
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                            ${this.msg.langApplied}:
                        </span>
                        <span class="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">
                            ${this._languageStatus.lang}
                        </span>
                    </div>

                    <!-- Remove language section -->
                    <div class="
                        flex flex-col gap-3 px-3 py-3 rounded-lg
                        bg-red-50 dark:bg-red-900/20
                        border border-red-200 dark:border-red-800
                    ">
                        <div class="flex items-start gap-2">
                            <span class="text-sm mt-0.5">🗑</span>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-xs font-medium text-red-700 dark:text-red-400">
                                    ${this.msg.langRemoveTitle}
                                </span>
                                <span class="
                                    text-[10px] font-mono px-1.5 py-0.5 rounded inline-block w-fit
                                    bg-red-100 dark:bg-red-800/40
                                    text-red-700 dark:text-red-300
                                ">
                                    ${this._languageStatus.lang}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-4">
                            <label class="
                                inline-flex items-center gap-1.5 cursor-pointer
                                text-[11px] text-gray-500 dark:text-gray-400
                            ">
                                <input
                                    type="radio"
                                    name="removeLangScope"
                                    .checked=${!this._removeLangApplyAll}
                                    @change=${() => { this._removeLangApplyAll = false; this.requestUpdate(); }}
                                    class="w-3 h-3 accent-red-600"
                                />
                                ${this.msg.langApplyOnly}
                            </label>
                            <label class="
                                inline-flex items-center gap-1.5 cursor-pointer
                                text-[11px] text-gray-500 dark:text-gray-400
                            ">
                                <input
                                    type="radio"
                                    name="removeLangScope"
                                    .checked=${this._removeLangApplyAll}
                                    @change=${() => { this._removeLangApplyAll = true; this.requestUpdate(); }}
                                    class="w-3 h-3 accent-red-600"
                                />
                                ${this.msg.langApplyAll}
                            </label>
                        </div>

                        ${this._removeLangApplyAll && this._actualPages.length > 0
                        ? html`
                                <div class="flex flex-col gap-1">
                                    <span class="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                                        ${this.msg.langAffectedPages} (${this._actualPages.length})
                                    </span>
                                    <div class="
                                        flex flex-col gap-0.5
                                        max-h-24 overflow-y-auto
                                        px-2 py-1.5 rounded
                                        bg-white dark:bg-gray-800
                                        border border-gray-200 dark:border-gray-700
                                    ">
                                        ${this._actualPages.map(f => html`
                                            <span class="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                                ${f.shortName}${f.extension}
                                            </span>
                                        `)}
                                    </div>
                                </div>
                            `
                        : nothing}

                        <div class="flex justify-end">
                            <button
                                class="
                                    inline-flex items-center gap-1.5
                                    px-3 py-1.5 rounded-lg
                                    text-xs font-medium cursor-pointer
                                    bg-red-600 text-white
                                    hover:bg-red-700
                                    dark:bg-red-500 dark:hover:bg-red-600
                                    transition-colors duration-150 shadow-sm
                                "
                                @click=${this._onRemoveLanguageClick}
                            >
                                <span>🗑</span>
                                ${this.msg.langRemoveBtn}
                            </button>
                        </div>
                    </div>
                `;

            case 'not-in-page':
                return html`
                    <div class="
                        flex flex-col gap-3 px-3 py-3 rounded-lg
                        bg-amber-50 dark:bg-amber-900/20
                        border border-amber-200 dark:border-amber-800
                    ">
                        <div class="flex items-start gap-2">
                            <span class="w-2 h-2 mt-1 rounded-full bg-amber-500 shrink-0"></span>
                            <span class="text-xs text-amber-700 dark:text-amber-400">
                                ${this.msg.langNotInPage}
                            </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="
                                text-[10px] font-mono px-1.5 py-0.5 rounded
                                bg-amber-100 dark:bg-amber-800/40
                                text-amber-700 dark:text-amber-300
                            ">
                                ${this._languageStatus.lang}
                            </span>
                            <button
                                class="
                                    inline-flex items-center gap-1.5
                                    px-3 py-1.5 rounded-lg
                                    text-xs font-medium cursor-pointer
                                    bg-amber-600 text-white
                                    hover:bg-amber-700
                                    dark:bg-amber-500 dark:hover:bg-amber-600
                                    transition-colors duration-150 shadow-sm
                                "
                                @click=${this._onGenerateLanguageForPage}
                            >
                                <span>⚡</span>
                                ${this.msg.langGenerateFor}
                            </button>
                        </div>
                    </div>
                `;

            case 'custom':
                return this._renderCustomLanguageForm();

            default:
                return nothing;
        }
    }

    // ─── Custom language form ─────────────────────────────────────────

    private _renderCustomLanguageForm() {
        const canGenerate = this._canGenerateCustomLang;
        const filtered = this._filteredLanguages;
        const hasSelection = !!this._customLangCode;

        return html`
            <div class="
                flex flex-col gap-3 px-3 py-3 rounded-lg
                bg-gray-50 dark:bg-gray-900
                border border-gray-200 dark:border-gray-800
            ">
                <div class="flex flex-col gap-1.5">
                    <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        ${this.msg.langCustomCode}
                    </span>

                    ${hasSelection
                ? html`
                            <div class="
                                flex items-center justify-between
                                px-2 py-1.5 rounded
                                bg-white dark:bg-gray-800
                                border border-gray-300 dark:border-gray-700
                            ">
                                <div class="flex items-center gap-2">
                                    <span class="
                                        text-[10px] font-mono px-1.5 py-0.5 rounded
                                        bg-indigo-100 dark:bg-indigo-900/40
                                        text-indigo-700 dark:text-indigo-300
                                    ">${this._customLangCode}</span>
                                    <span class="text-xs text-gray-600 dark:text-gray-300">
                                        ${this._customLangDisplayName}
                                    </span>
                                </div>
                                <button
                                    class="
                                        text-gray-400 hover:text-gray-600
                                        dark:text-gray-600 dark:hover:text-gray-400
                                        text-sm cursor-pointer
                                    "
                                    @click=${this._onCustomLangClear}
                                >✕</button>
                            </div>
                        `
                : html`
                            <div class="relative">
                                <input
                                    type="text"
                                    placeholder="${this.msg.langCustomCodePlaceholder}"
                                    .value=${this._customLangSearch}
                                    @input=${this._onCustomLangSearchInput}
                                    @focus=${this._onCustomLangSearchFocus}
                                    class="
                                        w-full px-2 py-1.5 rounded
                                        text-xs
                                        bg-white dark:bg-gray-800
                                        border border-gray-300 dark:border-gray-700
                                        text-gray-800 dark:text-gray-200
                                        placeholder-gray-400 dark:placeholder-gray-600
                                        focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                    "
                                />

                                ${this._customLangDropdownOpen
                        ? html`
                                        <div class="
                                            absolute z-10 left-0 right-0 mt-1
                                            max-h-32 overflow-y-auto
                                            rounded border
                                            bg-white dark:bg-gray-800
                                            border-gray-200 dark:border-gray-700
                                            shadow-lg
                                        ">
                                            ${filtered.length > 0
                                ? filtered.slice(0, 50).map(lang => html`
                                                    <div
                                                        class="
                                                            flex items-center gap-2
                                                            px-2 py-1.5
                                                            cursor-pointer
                                                            hover:bg-indigo-50 dark:hover:bg-indigo-900/30
                                                            text-xs text-gray-700 dark:text-gray-300
                                                        "
                                                        @mousedown=${(e: Event) => { e.preventDefault(); this._onCustomLangSelect(lang.code); }}
                                                    >
                                                        <span class="
                                                            font-mono text-[10px]
                                                            text-gray-400 dark:text-gray-500
                                                            w-5 shrink-0
                                                        ">${lang.code}</span>
                                                        <span class="truncate">${lang.name}</span>
                                                    </div>
                                                `)
                                : html`
                                                    <div class="px-2 py-2 text-xs text-gray-400 dark:text-gray-600 italic">
                                                        No languages found
                                                    </div>
                                                `}
                                        </div>
                                    `
                        : nothing}
                            </div>
                        `}
                </div>

                <div class="flex items-center gap-4">
                    <label class="
                        inline-flex items-center gap-1.5 cursor-pointer
                        text-[11px] text-gray-500 dark:text-gray-400
                    ">
                        <input
                            type="radio"
                            name="customLangScope"
                            .checked=${!this._customLangApplyAll}
                            @change=${() => { this._customLangApplyAll = false; this.requestUpdate(); }}
                            class="w-3 h-3 accent-indigo-600"
                        />
                        ${this.msg.langApplyOnly}
                    </label>
                    <label class="
                        inline-flex items-center gap-1.5 cursor-pointer
                        text-[11px] text-gray-500 dark:text-gray-400
                    ">
                        <input
                            type="radio"
                            name="customLangScope"
                            .checked=${this._customLangApplyAll}
                            @change=${() => { this._customLangApplyAll = true; this.requestUpdate(); }}
                            class="w-3 h-3 accent-indigo-600"
                        />
                        ${this.msg.langApplyAll}
                    </label>
                </div>

                ${this._customLangApplyAll && this._actualPages.length > 0
                ? html`
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                                ${this.msg.langAffectedPages} (${this._actualPages.length})
                            </span>
                            <div class="
                                flex flex-col gap-0.5
                                max-h-24 overflow-y-auto
                                px-2 py-1.5 rounded
                                bg-white dark:bg-gray-800
                                border border-gray-200 dark:border-gray-700
                            ">
                                ${this._actualPages.map(f => html`
                                    <span class="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                        ${f.shortName}${f.extension}
                                    </span>
                                `)}
                            </div>
                        </div>
                    `
                : nothing}

                <div class="flex justify-end">
                    <button
                        class="
                            inline-flex items-center gap-1.5
                            px-2.5 py-1 rounded
                            text-[11px] font-medium cursor-pointer
                            transition-colors duration-150
                            ${canGenerate
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'}
                        "
                        ?disabled=${!canGenerate}
                        @click=${this._onCustomLangGenerate}
                    >
                        ${this.msg.langCustomGenerate}
                    </button>
                </div>
            </div>
        `;
    }

    // ─── General status (non-language variation) ──────────────────────

    private _renderGeneralStatus() {
        return html`
            <div class="
                flex items-center justify-between
                mt-auto pt-3
                border-t border-gray-200 dark:border-gray-800
            ">
                <div class="flex items-center gap-2">
                    ${this._variationExists
                ? html`
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                ${this.msg.variationExists}
                            </span>
                        `
                : html`
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span class="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                ${this.msg.variationMissing}
                            </span>
                        `}
                </div>
                ${!this._variationExists
                ? html`
                        <button
                            class="
                                inline-flex items-center gap-1.5
                                px-3 py-1.5 rounded-lg
                                text-xs font-medium cursor-pointer
                                bg-indigo-600 text-white
                                hover:bg-indigo-700
                                dark:bg-indigo-500 dark:hover:bg-indigo-600
                                transition-colors duration-150 shadow-sm
                            "
                            @click=${this._onGenerateClick}
                        >
                            <span>⚡</span>
                            ${this.msg.generateBtn}
                        </button>
                    `
                : nothing}
            </div>
        `;
    }


    // ─── Detail Badge helper ──────────────────────────────────────────

    private _renderDetailBadge(label: string, value: string) {
        return html`
            <div class="
                inline-flex items-center gap-1
                px-2 py-0.5 rounded text-[10px]
                bg-gray-100 dark:bg-gray-900
                border border-gray-200 dark:border-gray-800
            ">
                <span class="text-gray-400 dark:text-gray-600 font-medium">${label}:</span>
                <span class="text-gray-700 dark:text-gray-300 font-semibold">${value}</span>
            </div>
        `;
    }
}