/// <mls fileReference="_102020_/l2/plugins/selectDevice.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

// ─── i18n ─────────────────────────────────────────────────────────────
/// **collab_i18n_start**
const message_en = {
    title: 'Device',
    desc: 'Select the target device to preview and generate components optimized for that platform.',
    webDesktopTitle: 'Web Desktop',
    webDesktopDesc: 'Full browser experience, optimized for large screens and mouse/keyboard interaction.',
    webMobileTitle: 'Web Mobile',
    webMobileDesc: 'Mobile browser experience, touch-optimized with responsive layouts.',
    androidTitle: 'Android',
    androidDesc: 'Native Android application via WebView or native bridge.',
    iosTitle: 'iOS',
    iosDesc: 'Native iOS application via WKWebView or native bridge.',
    deviceExists: 'This device is configured in this module.',
    pages: 'pages',
    generateDesc: 'This device is not configured in this module. Generate to create the initial structure.',
    generateBtn: 'Generate Module',
};
type MessageType = typeof message_en;
const messages: Record<string, MessageType> = {
    en: message_en,
    pt: {
        title: 'Dispositivo',
        desc: 'Selecione o dispositivo alvo para visualizar e gerar componentes otimizados para aquela plataforma.',
        webDesktopTitle: 'Web Desktop',
        webDesktopDesc: 'Experiência completa no navegador, otimizada para telas grandes e interação com mouse e teclado.',
        webMobileTitle: 'Web Mobile',
        webMobileDesc: 'Experiência no navegador mobile, otimizada para toque e layouts responsivos.',
        androidTitle: 'Android',
        androidDesc: 'Aplicativo nativo Android via WebView ou ponte nativa.',
        iosTitle: 'iOS',
        iosDesc: 'Aplicativo nativo iOS via WKWebView ou ponte nativa.',
        deviceExists: 'Este dispositivo está configurado neste módulo.',
        pages: 'páginas',
        generateDesc: 'Este dispositivo não está configurado neste módulo. Gere para criar a estrutura inicial.',
        generateBtn: 'Gerar Módulo',
    },
    es: {
        title: 'Dispositivo',
        desc: 'Seleccione el dispositivo objetivo para previsualizar y generar componentes optimizados para esa plataforma.',
        webDesktopTitle: 'Web Desktop',
        webDesktopDesc: 'Experiencia completa en el navegador, optimizada para pantallas grandes e interacción con ratón y teclado.',
        webMobileTitle: 'Web Mobile',
        webMobileDesc: 'Experiencia en navegador móvil, optimizada para toque y diseños responsivos.',
        androidTitle: 'Android',
        androidDesc: 'Aplicación nativa Android a través de WebView o puente nativo.',
        iosTitle: 'iOS',
        iosDesc: 'Aplicación nativa iOS a través de WKWebView o puente nativo.',
        deviceExists: 'Este dispositivo está configurado en este módulo.',
        pages: 'páginas',
        generateDesc: 'Este dispositivo no está configurado en este módulo. Genere para crear la estructura inicial.',
        generateBtn: 'Generar Módulo',
    },
};
/// **collab_i18n_end**

// ─── Types ───────────────────────────────────────────────────────────

interface IModule {
    name: string;
    path: string;
}

interface IDeviceInfo {
    value: number;
    titleKey: keyof MessageType;
    descKey: keyof MessageType;
}

const DEVICES: IDeviceInfo[] = [
    { value: 1, titleKey: 'webDesktopTitle', descKey: 'webDesktopDesc' },
    { value: 2, titleKey: 'webMobileTitle',  descKey: 'webMobileDesc'  },
    { value: 3, titleKey: 'androidTitle',    descKey: 'androidDesc'    },
    { value: 4, titleKey: 'iosTitle',        descKey: 'iosDesc'        },
];

const DEVICE_SUB_PATHS: Record<number, string> = {
    1: 'web/desktop',
    2: 'web/mobile',
    3: 'android',
    4: 'ios',
};

// ─── Component ───────────────────────────────────────────────────────

@customElement('plugins--select-device-102020')
export class PluginSelectDevice extends StateLitElement {

    @property({ attribute: false }) value: number | null = null;
    @property({ attribute: false }) selectedModule: IModule | null = null;

    private get msg(): MessageType {
        const lang = this.getMessageKey(messages);
        return messages[lang];
    }

    createRenderRoot() { return this; }

    render() {
        const v = this.value ?? 1;
        const device = DEVICES.find(d => d.value === v) ?? DEVICES[0];
        const deviceExists = this._checkDeviceExists(v);
        return html`
            <div class="flex flex-col gap-3">
                ${this._renderNavHeader(this.msg[device.titleKey], this.msg.desc, v, 1, DEVICES.length)}
                ${this._renderDeviceCard(device)}
                ${this.selectedModule ? this._renderDeviceStatus(deviceExists) : nothing}
            </div>
        `;
    }

    // ─── Renders ─────────────────────────────────────────────────────

    private _checkDeviceExists(deviceValue: number): boolean {
        if (!this.selectedModule) return false;
        const subPath = DEVICE_SUB_PATHS[deviceValue];
        const folderPrefix = `${this.selectedModule.path}/${subPath}`;
        // @ts-ignore
        const project: number = mls.actualProject;
        // @ts-ignore
        return Object.values(mls.stor.files).some((f: any) =>
            f.project === project && (f.folder === folderPrefix || f.folder.startsWith(folderPrefix + '/'))
        );
    }

    private _renderDeviceCard(device: IDeviceInfo) {
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-800
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-3
            ">
                <span class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
                    ${this.msg[device.descKey]}
                </span>
            </div>
        `;
    }

    private _renderDeviceStatus(exists: boolean) {
        if (exists) {
            return html`
                <div class="
                    rounded-lg border border-emerald-200 dark:border-emerald-700/50
                    bg-emerald-50 dark:bg-emerald-900/10
                    px-3 py-2.5 flex items-center justify-between gap-2
                ">
                    <span class="text-sm text-emerald-600 dark:text-emerald-400">${this.msg.deviceExists}</span>
                    <span class="shrink-0 text-sm font-mono text-emerald-500 dark:text-emerald-400">12 ${this.msg.pages}</span>
                </div>
            `;
        }
        return html`
            <div class="
                rounded-lg border border-gray-200 dark:border-gray-700
                bg-gray-50 dark:bg-gray-900/50
                px-3 py-2.5 flex flex-col gap-2
            ">
                <span class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">${this.msg.generateDesc}</span>
                <button
                    class="
                        self-start text-sm px-2.5 py-1 rounded
                        bg-indigo-500 dark:bg-indigo-600 text-white
                        hover:bg-indigo-600 dark:hover:bg-indigo-500
                        transition-colors whitespace-nowrap cursor-pointer
                    "
                    @click=${() => { /* TODO: generate device module */ }}
                >${this.msg.generateBtn}</button>
            </div>
        `;
    }

    private _renderNavHeader(title: string, desc: string, value: number, min: number, max: number) {
        const atMin = value <= min;
        const atMax = value >= max;
        const navBtn = (label: string, target: number, disabled: boolean) => html`
            <button
                class="px-1.5 py-1 rounded text-base font-mono leading-none transition-colors
                    ${disabled
                        ? 'text-gray-300 dark:text-gray-700 cursor-default'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'}"
                ?disabled=${disabled}
                @click=${() => { if (!disabled) this._dispatchSelect(target); }}
            >${label}</button>
        `;
        return html`
            <div class="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <div class="flex items-center">
                    <div class="flex items-center gap-0.5">
                        ${navBtn('«', min, atMin)}
                        ${navBtn('‹', value - 1, atMin)}
                    </div>
                    <span class="flex-1 text-center text-lg font-semibold text-gray-700 dark:text-gray-200">${title}</span>
                    <div class="flex items-center gap-0.5">
                        ${navBtn('›', value + 1, atMax)}
                        ${navBtn('»', max, atMax)}
                    </div>
                </div>
                <span class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed text-center">${desc}</span>
            </div>
        `;
    }

    private _dispatchSelect(value: number) {
        this.dispatchEvent(new CustomEvent('select-device', {
            detail: { value },
            bubbles: true,
            composed: true,
        }));
    }
}
