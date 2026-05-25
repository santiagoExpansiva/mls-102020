/// <mls fileReference="_102020_/l2/serviceProject.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu } from '/_102027_/l2/serviceBase.js';

import '/_102027_/l2/collabSelectKnob.js';
import '/_102020_/l2/plugins/selectModule.js';
import '/_102020_/l2/plugins/selectDesignSystem.js';
import '/_102020_/l2/plugins/selectDevice.js';
import '/_102020_/l2/plugins/selectAssetsComponents.js';
import '/_102020_/l2/plugins/selectAssetsPlugins.js';
import '/_102020_/l2/plugins/selectAssetsMedia.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    svcTitle: 'Project',
    module: 'Module',
    designSystem: 'Design System',
    device: 'Device',
    assets: 'Assets',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        svcTitle: 'Projeto',
        module: 'Módulo',
        designSystem: 'Design System',
        device: 'Dispositivo',
        assets: 'Assets',
    },
    es: {
        svcTitle: 'Proyecto',
        module: 'Módulo',
        designSystem: 'Design System',
        device: 'Dispositivo',
        assets: 'Assets',
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

const DS_CONFIG: IKnobConfig = {
    key: 'designSystem',
    min: 1,
    max: 3,
    labels: { 1: 'Default', 2: 'Material', 3: 'Custom' },
};

const DEVICE_CONFIG: IKnobConfig = {
    key: 'device',
    min: 1,
    max: 4,
    labels: { 1: 'Web D', 2: 'Web M', 3: 'Android', 4: 'iOS' },
};

const ASSETS_CONFIG: IKnobConfig = {
    key: 'assets',
    min: 1,
    max: 3,
    labels: { 1: 'Components', 2: 'Plugins', 3: 'Media' },
};

const DISABLED_CONFIG = (key: string): IKnobConfig => ({
    key,
    min: 1,
    max: 1,
    labels: {},
    disabled: true,
});

// ─── Service ─────────────────────────────────────────────────────────

@customElement('service-project-102020')
export class ServiceProject102020 extends ServiceBase {

    public details: IService = {
        icon: '&#xf1b2',
        state: 'foreground',
        position: 'left',
        tooltip: 'Project',
        visible: true,
        widget: '_102020_serviceProject',
        level: [6],
    };

    public onClickMain(op: string): void {
        if (this.menu.setMode) this.menu.setMode('initial');
    }

    public menu: IServiceMenu = {
        title: '',
        main: {},
        tools: {},
        tabs: undefined,
        onClickMain: this.onClickMain.bind(this),
    };

    onServiceClick(_visible: boolean, _reinit: boolean, _el: IToolbarContent | null) {}

    // ─── State ────────────────────────────────────────────────────────

    @state() private msg: MessageType = message_en;

    @state() private _modules: IModule[] = [];
    @state() private _moduleConfig: IKnobConfig = DISABLED_CONFIG('module');

    @state() private _moduleValue: number | null = null;
    @state() private _dsValue: number | null = 1;
    @state() private _deviceValue: number | null = 1;
    @state() private _assetsValue: number | null = 1;

    @state() private _selectedKnob: string = 'module';

    @state() private _dsConfig: IKnobConfig = { ...DS_CONFIG };
    @state() private _deviceConfig: IKnobConfig = { ...DEVICE_CONFIG };
    @state() private _assetsConfig: IKnobConfig = { ...ASSETS_CONFIG };

    // ─── Module Loading ───────────────────────────────────────────────

    private async _loadModules() {
        // @ts-ignore
        const project: number = mls.actualProject;
        if (!project) return;
        try {
            const mod = await import(`/_${project}_/l2/project.js`);
            const modules: IModule[] = mod?.projectConfig?.modules ?? [];
            this._modules = modules;
            this._moduleConfig = this._buildModuleConfig(modules);
            // @ts-ignore
            const actualModule: string | undefined = mls.actualModule;
            const idx = actualModule ? modules.findIndex(m => m.name === actualModule) : -1;
            this._moduleValue = idx >= 0 ? idx + 1 : 0;
        } catch {
            this._modules = [];
            this._moduleConfig = DISABLED_CONFIG('module');
        }
        this.requestUpdate();
    }

    private _buildModuleConfig(modules: IModule[]): IKnobConfig {
        const labels: Record<number, string> = { 0: 'All' };
        modules.forEach((m, i) => { labels[i + 1] = m.name; });
        labels[modules.length + 1] = 'Custom';
        return { key: 'module', min: 0, max: modules.length + 1, labels };
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private get _selectedModule(): IModule | null {
        if (this._moduleValue === null || this._moduleValue <= 0 || this._moduleValue > this._modules.length) return null;
        return this._modules[this._moduleValue - 1];
    }

    private get _knobValues(): Record<string, number | null> {
        return {
            module: this._moduleValue,
            designSystem: this._dsValue,
            device: this._deviceValue,
            assets: this._assetsValue,
        };
    }

    private _getKnobConfig(key: string): IKnobConfig {
        switch (key) {
            case 'module': return this._moduleConfig;
            case 'designSystem': return this._dsConfig;
            case 'device': {
                const moduleSelected = this._moduleValue !== null
                    && this._moduleValue > 0
                    && this._moduleValue <= this._modules.length;
                return moduleSelected ? this._deviceConfig : DISABLED_CONFIG('device');
            }
            case 'assets': {
                const moduleSelected = this._moduleValue !== null
                    && this._moduleValue > 0
                    && this._moduleValue <= this._modules.length;
                return moduleSelected ? this._assetsConfig : DISABLED_CONFIG('assets');
            }
            default: return DISABLED_CONFIG(key);
        }
    }

    private _setKnobValue(key: string, value: number | null) {
        switch (key) {
            case 'module': this._moduleValue = value; break;
            case 'designSystem': this._dsValue = value; break;
            case 'device': this._deviceValue = value; break;
            case 'assets': this._assetsValue = value; break;
        }
        this.requestUpdate();
    }

    // ─── Event Handlers ───────────────────────────────────────────────

    private _onKnobChange(key: string, e: CustomEvent) {
        this._selectedKnob = key;
        this._setKnobValue(key, e.detail.value);
    }

    private _onKnobClick(key: string) {
        this._selectedKnob = key;
        this.requestUpdate();
    }

    // ─── Lifecycle ────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        this._loadModules();
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
                ${this._renderKnobItem('module')}
                ${this._renderKnobItem('designSystem')}
                ${this._renderKnobItem('device')}
                ${this._renderKnobItem('assets')}
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
                    @select-ds=${(e: CustomEvent) => this._setKnobValue('designSystem', e.detail.value)}
                    @select-assets=${(e: CustomEvent) => this._setKnobValue('assets', e.detail.value)}
                >
                    ${this._renderContextStatusArea()}
                </div>
            </div>
        `;
    }

    private _renderContextStatusArea() {
        switch (this._selectedKnob) {
            case 'module':
                return html`
                    <plugins--select-module-102020
                        .modules=${this._modules}
                        .value=${this._moduleValue}
                        @select-module=${(e: CustomEvent) => this._setKnobValue('module', e.detail.value)}
                    ></plugins--select-module-102020>
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
            case 'device':
                return html`
                    <plugins--select-device-102020
                        .value=${this._deviceValue}
                        .selectedModule=${this._selectedModule}
                        @select-device=${(e: CustomEvent) => this._setKnobValue('device', e.detail.value)}
                    ></plugins--select-device-102020>
                `;
            case 'assets':
                return this._renderAssetsPanel();
            default:
                return nothing;
        }
    }

    private _renderAssetsPanel() {
        switch (this._assetsValue) {
            case 1:
                return html`
                    <plugins--select-assets-components-102020
                        .selectedModule=${this._selectedModule}
                        .device=${this._deviceValue}
                    ></plugins--select-assets-components-102020>
                `;
            case 2:
                return html`
                    <plugins--select-assets-plugins-102020
                        .selectedModule=${this._selectedModule}
                        .device=${this._deviceValue}
                    ></plugins--select-assets-plugins-102020>
                `;
            case 3:
                return html`
                    <plugins--select-assets-media-102020
                        .selectedModule=${this._selectedModule}
                        .device=${this._deviceValue}
                    ></plugins--select-assets-media-102020>
                `;
            default:
                return nothing;
        }
    }
}
