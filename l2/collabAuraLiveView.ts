/// <mls shortName="collabAuraLiveView" project="102020" enhancement="_100554_enhancementLit" />

import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { CollabLitElement } from './_100554_collabLitElement';
import { DISTFOLDER, buildModule } from './_100554_libLiveView';
import { getProjectConfig } from './_100554_libCommom';
import './_100554_collabNav4Menu'

interface ITab {
    moduleName: string,
    modulePath: string,
    project: number,
    pageInitial: string,
    actualPage: string,
    icon: string | undefined,
    target: string,
}

/// **collab_i18n_start**
const message_pt = {
    newTab: 'Nova aba',
}

const message_en = {
    newTab: 'new Tab',
}

type MessageType = typeof message_en;

const messages: { [key: string]: MessageType } = {
    'en': message_en,
    'pt': message_pt
}
/// **collab_i18n_end**

@customElement('collab-aura-live-view-102020')
export class CollabAuraLiveView102020 extends CollabLitElement {

    private msg: MessageType = messages['en'];

    @property() mode: 'develpoment' | 'production' = 'develpoment';

    @state() actualTab: number = 0;

    @state() tabsMenu: any = [];

    @query('.liveview-container') container?: HTMLElement;

    public tabs: ITab[] = [];

    private liveViewReady = false;

    get iframe(): HTMLIFrameElement | null {
        return this.querySelector(`iframe[tab-index="${this.actualTab}"]`);
    }

    async firstUpdated(_changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(_changedProperties);
        this.setEvents();
    }

    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];
        return html`
			<div class="liveview-container">
                <collab-nav4-menu-100554
                    mode="full"
                    .selectedIndex=${this.actualTab} 
                    .options=${this.tabsMenu}
                    @tab-selected=${this.onTabSelected}
                    @tab-closed=${this.onTabClosed}
                    ></collab-nav4-menu-100554>
                ${this.tabs.map((tab, index) => {
            return html`
                <iframe
                    tab-index=${index}
                    style="width:100%; height:calc(100% - 47px); border:none;display:none;"
                    class="${this.actualTab === index ? '' : 'closed'}"
                    src="/_100554_servicePreview"
                    @load=${this.load}>
                </iframe>
            `
        })}
                
			</div>
		`;
    }

    public async init(project: number, shortName: string, folder: string) {
        this.tabs = [...[]];
        await this.setInitialTabInfos(project, shortName, folder);
    }

    private setEvents(): void {
        window.top?.addEventListener('message', async (event) => {
            const { type, target, project, moduleName, pageName, modulePath } = event.data;
            if (type !== 'loadPage') return;
            if (!this.liveViewReady) return;
            try {
                this.checkToLoadPage(pageName, moduleName, modulePath, project, target);
            } catch (err) {
                console.error('Erro ao carregar página no LiveView:', err);
            }
        });
    }


    private onTabSelected(e: CustomEvent) {
        const tabIndex: number = e.detail?.index;
        this.actualTab = tabIndex;
    }

    private onTabClosed(e: CustomEvent) {
        const tabIndex: number = e.detail?.index;
        this.closeTab(tabIndex);
    }

    private async checkToLoadPage(pageName: string, moduleName: string, modulePath: string, project: number, target: string) {

        let tabActual = this.tabs[this.actualTab];
        const _target = !target ? moduleName : target;

        if (!_target) {
            tabActual = this.tabs[0];
            this.actualTab = 0;
            await this.openTab();
        }

        const oldProject = tabActual.project;

        if (tabActual.project !== project || tabActual.moduleName !== moduleName) {
            this.toogleLoading(true);
            await buildModule(project, moduleName);
            await this.setActualTabInfos(project, pageName, modulePath, moduleName, _target);
        } else if (_target !== '') {
            await this.setActualTabInfos(project, pageName, modulePath, moduleName, _target);
        }

        if (oldProject !== project) {
            await this.injectGlobalStyle(true);
            await this.injectScriptRunTime(true);
        }

        this.toogleLoading(false);
        this.loadPage(pageName);
    }

    private async setInitialTabInfos(project: number, pageInitial: string, modulePath: string) {

        const moduleProject = await getProjectConfig(project);
        if (!moduleProject) return;
        const moduleConfig = moduleProject.modules.find((item: any) => item.path === modulePath);
        if (!moduleConfig) return;
        this.tabs = [{
            actualPage: '',
            moduleName: moduleConfig.name,
            modulePath: moduleConfig.path,
            pageInitial,
            project: project,
            icon: moduleConfig.icon,
            target: moduleConfig.name
        }];


        this.tabsMenu = [
            { text: this.tabs[0].moduleName, icon: this.tabs[0].icon, allowClose: false }
        ];

        this.tabs = [...this.tabs];
        this.tabsMenu = [...this.tabsMenu];
        await this.requestUpdate();

    }

    private async setActualTabInfos(project: number, pageInitial: string, modulePath: string, moduleName: string, target: string) {

        const _target = !target ? moduleName : target;

        if (_target !== '') {
            const tabIndex = this.tabs.findIndex((tab) => tab.target === _target);
            if (tabIndex > -1) {
                this.actualTab = tabIndex;
                await this.openTab();
            }
            else this.addTab(pageInitial, '', moduleName, modulePath, project, _target)
        }

        const tabActual = this.tabs[this.actualTab];
        const moduleProject = await getProjectConfig(project);
        if (!moduleProject) return;
        const moduleConfig = moduleProject.modules.find((item) => item.path === modulePath);
        if (!moduleConfig) return;

        tabActual.actualPage = pageInitial;
        tabActual.project = project;
        tabActual.moduleName = moduleConfig.name;
        tabActual.modulePath = modulePath;
        tabActual.icon = moduleConfig.icon;
        tabActual.pageInitial = pageInitial;
        this.tabs = [...this.tabs];
        this.tabsMenu[this.actualTab].icon = tabActual.icon;
        this.tabsMenu = [...this.tabsMenu];
        await this.requestUpdate();

    }

    private async openTab() {
        this.tabs = [...this.tabs];
        await this.requestUpdate();
    }

    private async closeTab(index: number) {
        if (!this.tabs[index]) return;
        this.tabs.splice(index, 1);
        this.tabs = [...this.tabs];
        this.actualTab = index - 1;
        await this.requestUpdate();

    }

    private async addTab(actualPage: string, icon: string, moduleName: string, modulePath: string, project: number, target: string) {

        const defaultTab: ITab = {
            actualPage,
            icon,
            moduleName,
            modulePath,
            pageInitial: actualPage,
            project,
            target: target || moduleName
        }

        this.tabs.push({ ...defaultTab });
        this.tabsMenu.push(
            { text: defaultTab.target, icon: defaultTab.icon, allowClose: true }
        );

        this.actualTab = this.tabs.length - 1;
        this.tabs = [...this.tabs];
        this.tabsMenu = [...this.tabsMenu];
        await this.requestUpdate();

    }

    private async load() {

        const tabActual = this.tabs[this.actualTab];
        if (!this.iframe) return;
        this.setEvents();

        const doc = this.iframe?.contentDocument;
        if (!doc) return;

        const head = doc.querySelector('head') || doc.createElement('head');
        if (!head.parentElement) doc.documentElement.appendChild(head);

        const base = doc.createElement('base');
        base.href = document.baseURI;
        head.appendChild(base);

        let body = doc.querySelector('body');
        if (!body) {
            body = doc.createElement('body');
            doc.documentElement.appendChild(body);
        }

        if (!doc.getElementById('app')) {
            const app = doc.createElement('div');
            app.id = 'app';
            body.appendChild(app);
        }

        const pre = doc.body.querySelector('pre');
        if (pre) pre.remove();
        const meta = this.iframe.contentDocument?.querySelector('meta[name="color-scheme"]');
        if (meta) meta.remove();

        this.addScript();
        this.addStyleApp();
        this.iframe.style.display = '';

        try {
            this.toogleLoading(true);
            await buildModule(tabActual.project, tabActual.moduleName);
            await this.injectGlobalStyle();
            await this.injectScriptRunTime();
            this.liveViewReady = true;
            if (!tabActual.actualPage && tabActual.pageInitial) {
                this.loadPage(tabActual.pageInitial);
            }
        } catch (err: any) {
            // this.setError(err.message);

        } finally {
            this.toogleLoading(false);
        }

    }

    private toogleLoading(show: boolean) {
        const divApp = this.container;
        if (!divApp) return;
        if (show) divApp.classList.add('loading');
        else divApp.classList.remove('loading');
    }

    private async loadPage(pageName: string) {

        if (!this.iframe?.contentWindow) {
            console.warn('[LiveView] iframe ainda não disponível.');
            return;
        }

        if (this.mode === 'develpoment') {
            this.loadInDevelopment(pageName);
        }

        if (this.mode === 'production') {
            this.loadInProduction(pageName);
        }


    }

    private async loadInProduction(pageName: string) {
        const tabActual = this.tabs[this.actualTab];

        try {
            this.toogleLoading(true);
            const htmlUrl: string = `/${tabActual.modulePath}/${pageName}.html`;
            const jsUrl: string = `/${tabActual.modulePath}/${pageName}.js`;

            this.clearOldPageScripts();
            await Promise.all([
                this.injectHTML(htmlUrl),
                this.injectJS(jsUrl)
            ]);
            if (this.iframe) {
                this.iframe.style.display = '';
            }
            this.toogleLoading(false);
        } catch (err: any) {
            // this.setError(err.message);
            this.toogleLoading(false);
        }
    }


    private async loadInDevelopment(pageName: string) {
        const tabActual = this.tabs[this.actualTab];
        const folder = DISTFOLDER + '/' + tabActual.modulePath;
        const keyStorFileHTML = mls.stor.getKeyToFiles(tabActual.project, 2, pageName, folder, '.html');
        const keyStorFileJs = mls.stor.getKeyToFiles(tabActual.project, 2, pageName, folder, '.js');

        const storFileHTML = mls.stor.files[keyStorFileHTML];
        const storFileJs = mls.stor.files[keyStorFileJs];

        const versionHtml = storFileHTML?.versionRef || '0';
        const versionJs = storFileJs?.versionRef || '0';

        try {
            this.toogleLoading(true);
            const cacheJs = await mls.stor.cache.getFileFromCache(tabActual.project, folder, pageName, '.js', versionJs);
            const cacheHtml = await mls.stor.cache.getFileFromCache(tabActual.project, folder, pageName, '.html', versionHtml);
            if (!cacheHtml) {
                const contentHtml = await storFileHTML.getContent();
                if (contentHtml && typeof contentHtml === 'string') {
                    await mls.stor.cache.addIfNeed({
                        project: tabActual.project,
                        folder: folder,
                        content: contentHtml,
                        extension: '.html',
                        shortName: pageName,
                        version: versionHtml,
                        contentType: 'text/plain'
                    });
                }
            }

            if (!cacheJs) {
                const contentJs = await storFileJs.getContent();
                if (contentJs && typeof contentJs === 'string') {
                    await mls.stor.cache.addIfNeed({
                        project: tabActual.project,
                        folder: folder,
                        content: contentJs,
                        extension: '.js',
                        shortName: pageName,
                        version: versionJs,
                        contentType: 'application/javascript'
                    });
                }
            }

            const htmlUrl: string = `/local/_${tabActual.project}_wwwroot/${tabActual.modulePath}/${pageName}.html?v=${versionHtml}`;
            const jsUrl: string = `/local/_${tabActual.project}_wwwroot/${tabActual.modulePath}/${pageName}.js?v=${versionJs}`;

            this.clearOldPageScripts();
            await Promise.all([
                this.injectHTML(htmlUrl),
                this.injectJS(jsUrl)
            ]);
            if (this.iframe) {
                this.iframe.style.display = '';
            }
            this.toogleLoading(false);

        } catch (err: any) {
            // this.setError(err.message);
            this.toogleLoading(false);
        }
    }

    private APP_ID = 'app';

    private clearOldPageScripts() {
        if (!this.iframe || !this.iframe.contentDocument || !this.iframe.contentDocument.body) return;
        const oldScript = this.iframe.contentDocument.body.querySelector('#liveview-page-script');
        if (oldScript) oldScript.remove();
    }

    private async injectHTML(htmlUrl: string) {
        if (!this.iframe || !this.iframe.contentDocument) return;
        const html = await fetch(htmlUrl).then(res => res.text());
        const app = this.iframe.contentDocument.getElementById(this.APP_ID);
        if (app) app.innerHTML = html;
    }

    private async injectJS(jsUrl: string) {
        if (!this.iframe || !this.iframe.contentDocument) return;
        const script = this.iframe.contentDocument.createElement('script');
        script.type = 'module';
        script.src = jsUrl;
        script.id = 'liveview-page-script';
        this.iframe.contentDocument.body.appendChild(script);
    }

    private async injectScriptRunTime(forceRecompile: boolean = false) {
        if (!this.iframe || !this.iframe.contentDocument) return;
        const tabActual = this.tabs[this.actualTab];
        const doc = this.iframe.contentDocument;
        const body = doc.body;
        const url = `/local/_${tabActual.project}_wwwroot/collabRunTime`;

        let scriptRunTime = doc.getElementById('collab-runtime-script');
        if (forceRecompile && scriptRunTime) {
            scriptRunTime.remove();
            scriptRunTime = null
        }

        if (!scriptRunTime) {
            const script = doc.createElement('script');
            script.id = 'collab-runtime-script';
            script.src = `${url}`;
            script.type = 'module';
            script.defer = true;
            body.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = () => resolve(true);
                script.onerror = (e) => reject(e);
            });
        }

    }

    private async injectGlobalStyle(forceRecompile: boolean = false) {
        if (!this.iframe || !this.iframe.contentDocument) return;
        const tabActual = this.tabs[this.actualTab];
        const shortName = 'globalStyle'
        const keyStorFile = mls.stor.getKeyToFiles(tabActual.project, 2, shortName, DISTFOLDER, '.css');
        const storFile = mls.stor.files[keyStorFile];
        const version = storFile?.versionRef || '0';

        const url = `/local/_${tabActual.project}_wwwroot/${shortName}.css?v=${version}`;
        const res = await fetch(url);
        const cssText = await res.text();
        let styleGlobalEl = this.iframe.contentDocument.getElementById('styleGlobal');
        if (forceRecompile && styleGlobalEl) {
            styleGlobalEl.remove();
            styleGlobalEl = null;
        }

        if (!styleGlobalEl) {
            const styleG = document.createElement('style');
            styleG.id = 'styleGlobal';
            styleG.textContent = cssText;
            this.iframe.contentDocument.head.appendChild(styleG);
        }
    }

    private functionReplaceAnchor(e: MouseEvent) {

        e.stopPropagation();
        e.preventDefault();

        let anchor = (e.target as HTMLAnchorElement);
        if (!anchor.getAttribute('href')) {
            anchor = (e.target as HTMLAnchorElement).closest('a') as HTMLAnchorElement;
        }
        const href = anchor.href;
        let pageName = href ? href.replace(window.location.href, '') : '';
        this.loadPage(pageName);

    }

    private addStyleApp() {
        const style = document.createElement('style');
        style.id = 'iframe-style';
        style.textContent = `
        html, body {
            height: 100%;
        }`;
        this.iframe?.contentDocument?.head.appendChild(style);
    }

    private addScript() {
        if (!this.iframe || !this.iframe.contentDocument || !this.iframe.contentWindow) return;
        const s = document.createElement('script') as HTMLScriptElement;
        s.textContent = `
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (a) {
                functionReplaceAnchor(e);
            }
        });`;
        this.iframe.contentDocument.body?.appendChild(s);
        (this.iframe.contentWindow as any).functionReplaceAnchor = this.functionReplaceAnchor.bind(this);

    }



}
