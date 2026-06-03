/// <mls fileReference="_102020_/l2/previewModeAura.ts" enhancement="_blank"/>

import { IJSONDependence } from '/_102027_/l2/libCompile.js';
import { setErrorOnModel, getPath } from '/_102027_/l2/utils.js';
import { resolveTagToFile } from '/_102020_/l2/utils.js';

export class PreviewModeAura {

    private level: string | undefined;
    private json: IJSONDependence | undefined;
    private ifr: HTMLIFrameElement | undefined;
    private isService: boolean = false;
    private models: mls.editor.IModels | undefined = undefined;
    private file: mls.stor.IFileInfo | undefined = undefined;
    private esbuild: any;
    private needAwait = true;

    constructor(_j: IJSONDependence, _i: HTMLIFrameElement, _l: string, _s: boolean, _f: mls.stor.IFileInfo, _m: mls.editor.IModels | undefined) {
        this.json = _j;
        this.ifr = _i;
        this.level = _l;
        this.isService = _s;
        this.file = _f;
        this.models = _m;
    }

    public async init() {
        if (!this.json || !this.ifr) return;
        await this.loadEsbuild();
        if (this.needAwait) setTimeout(async () => await this.configIframe(), 200);
        else this.configIframe();
    }

    public async buildJS(other: string[]) {
        await this.loadEsbuild();
        return this._buildJS(other);
    }

    private async configIframe() {

        if (!this.json || !this.ifr || !this.esbuild || !this.file) return;

        const find = this.findWidgets(this.ifr.contentDocument?.body);
        const auraWidgets = this.getImportsAuraWigetsPlayGround();
        const result = await this._buildJS([...find, ...auraWidgets]);
        this.mountJSImporMap(this.json, this.ifr);
        this.mountLinks(this.json, this.ifr);
        this.mountTailwindDarkMode(this.ifr);
        this.mountTokens(this.json.tokens || '', this.file);
        this.addGlobalCss(this.json.globalCss);
        this.addJsReference(this.ifr, this.level || '2');
        const s = document.createElement('script') as HTMLScriptElement;
        s.textContent = result.outputFiles[0].text;
        this.ifr.contentDocument?.body.appendChild(s);
    }

    private async _buildJS(other: string[]) {

        if (!this.json || !this.esbuild || !this.file) return;

        let myMap = this.parseImportsMap(this.json.importsMap);
        let valids = [...Object.keys(myMap), ...this.json.importsJs, ...other];
        valids = [...new Set(valids)];

        if (Object.keys(myMap).length === 0) {
            const enhancementModules = await import('/_102020_/l2/enhancementAura.js');
            const maps = enhancementModules.requires.filter((item) => item.type === 'cdn');
            maps.forEach((item) => {
                myMap[item.name] = item.ref;
            })
        }

        /*if (Object.keys(myMap).length === 0) myMap = {
            lit: "https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js",
            "lit/decorators.js": "https://cdn.jsdelivr.net/npm/lit@3.0.0/decorators/+esm"
        }*/

        const virtualFsPlugin = {
            name: 'virtual-fs',
            setup(build: any) {

                build.onResolve({ filter: /.*/ }, (args: any) => {

                    if (valids.includes(args.path)) {
                        return {
                            path: args.path,
                            namespace: 'virtual',
                        };
                    }

                    if (args.path.startsWith("_") &&
                        !args.importer.startsWith("https://")) {
                        return {
                            path: args.path.replace('_', '/_'),
                            namespace: 'virtual',
                        };
                    }

                    if ((args.path.startsWith("/") || args.path.startsWith("./") || args.path.startsWith("../")) &&
                        !args.importer.startsWith("https://") && !myMap[args.importer]) {

                        const url = new URL(args.path, 'file:' + args.importer);
                        let path = url.pathname;

                        if (!(/_(\d+)_/.test(path))) {

                            const info = getPath(args.importer.replace('/l2/', '').replace('/', ''));

                            if (!info) throw new Error('[virtualFsPlugin] Not found path:' + args.importer.replace('/l2/', '').replace('/', ''));

                            if (!info.project) info.project = mls.actualProject as number;

                            if (path.indexOf(`_${info.project}_`) < 0) {
                                path = url.pathname.replace('/', `/_${info.project}_`)
                            }
                        }

                        return { path, namespace: 'virtual' };

                    }

                    // import url externa
                    if ((
                        args.path.startsWith("./") ||
                        args.path.startsWith("../") ||
                        args.path.startsWith("/")) &&
                        args.importer.startsWith("https://")) {
                        const url = new URL(args.path, args.importer);
                        return { path: url.href, namespace: 'virtual' };
                    }

                    // import url externa
                    if (args.path.startsWith("/") && myMap[args.importer]) {
                        const url = new URL(args.path, myMap[args.importer]);
                        return { path: url.href, namespace: 'virtual' };
                    }

                    // url externa
                    if (args.path.startsWith("http")) {
                        return { path: args.path, namespace: 'virtual' };
                    }

                    if (myMap[args.path]) {
                        return { path: myMap[args.path], namespace: 'virtual' };
                    }

                    return null;
                });

                build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: any) => {
                    try {

                        let path = myMap[args.path] ? myMap[args.path] : args.path;

                        const res = await fetch(path);
                        if (!res.ok) throw new Error(`Error get ${args.path}`);

                        const text = await res.text();
                        return { contents: text, loader: 'js' };

                    } catch (e: any) {
                        console.info('erro:' + args.path);
                        return {
                            contents: '',
                            loader: 'js',
                            warnings: [{
                                text: e.message, notes: [
                                    { text: 'build-error' }
                                ]
                            }]
                        }
                    }

                });
            },
        };


        let allImports = [...this.json.importsJs, ...other];
        allImports = [...new Set(allImports)];

        const virtualEntryPath = "virtual-entry.js";
        const virtualEntryContent = allImports.map(path => `import "${path}";`).join("\n");

        const cachedJs = this.loadCache();
        const result = cachedJs ? cachedJs : await this.esbuild.build({
            stdin: {
                contents: virtualEntryContent,
                resolveDir: "/",
                sourcefile: virtualEntryPath,
                loader: "js"
            },
            bundle: true,
            minify: true,
            format: "esm",
            sourcemap: 'inline',
            write: false,
            plugins: [virtualFsPlugin]
        });

        if (result.warnings && result.warnings.length > 0) {
            const msgs = result.warnings
                .filter((item: any) => item.notes?.[0]?.text === 'build-error')
                .map((item: any) => item.text)
                .join('\n');

            if (this.models?.ts?.model && msgs.trim()) {
                const lineLength = this.models.ts.model.getLineLength(1);
                setErrorOnModel(this.models.ts.model, 1, 1, lineLength, msgs, monaco.MarkerSeverity.Error);
                this.models.ts.storFile.hasError = true;
            }
        }

        if (!(window as any).cachePreview) {
            (window as any).cachePreview = {};
        }
        (window as any).cachePreview[this.json.importsJs[0]] = result;

        return result;
    }

    private parseImportsMap(importsArray: string[]) {
        return Object.fromEntries(
            importsArray.map(str => {
                const match = str.match(/^"(.+?)":\s*"(.+?)"$/);
                if (!match) throw new Error("Formato inválido: " + str);
                const [, key, value] = match;
                return [key, value];
            })
        );
    }

    private findWidgets(rootElement: HTMLElement | undefined) {
        if (!rootElement) return [];
        const els = rootElement.querySelectorAll('[widget]');
        const array = Array.from(els)
            .map((el) => {
                const info = resolveTagToFile(el.getAttribute('widget') || '');
                if (!info) return '';
                return '/' + `_${info.project}_${info.shortName}`;
            })
            .filter(Boolean);
        const ret = [...new Set(array)]
        return ret;

    }

    private getImportsAuraWigetsPlayGround() {
        return [
            '/_102020_widgetPlaygroundState',
            '/_102020_widgetPlaygroundStateBoolean',
            '/_102020_widgetPlaygroundStateNumber',
            '/_102020_widgetPlaygroundStateText',
            '/_102020_widgetPlaygroundStatePreviewCode',
        ]
    }

    private async loadEsbuild() {

        this.needAwait = true;
        if ((mls as any).esbuild) {
            this.esbuild = (mls as any).esbuild;
            this.needAwait = false;
        } else if (!(mls as any).esbuildInLoad) await this.initializeEsBuild();
    }

    private async initializeEsBuild() {

        (mls as any).esbuildInLoad = true;
        const url = 'https://unpkg.com/esbuild-wasm@0.14.54/esm/browser.min.js';
        if (!this.esbuild) {
            this.esbuild = await import(url);
            await this.esbuild.initialize({
                wasmURL: "https://unpkg.com/esbuild-wasm@0.14.54/esbuild.wasm"
            });
            (mls as any).esbuild = this.esbuild;
            (mls as any).esbuildInLoad = false

        }

    }

    private loadCache() {
        if (mls.actualLevel !== 7) return;
        if (!(window as any).cachePreview || !this.json) return;
        if (!(window as any).cachePreview[this.json.importsJs[0]]) return;

        let needCompile = false;
        this.json.importsJs.forEach((i: string) => {
            const name = i.startsWith('/') ? i.replace('/', '') : i;
            const f = getPath(name);
            if (!f) throw new Error('[loadCache] Not found path:' + name);
            const key = mls.stor.getKeyToFiles(f.project, 2, f.shortName, f.folder, '.ts');
            if (mls.stor.files[key] && mls.stor.files[key].inLocalStorage) {
                needCompile = true;
            }

        });

        if (needCompile) return;

        return (window as any).cachePreview[this.json.importsJs[0]];
    }

    private mountJSImporMap(info: IJSONDependence, ifr: HTMLIFrameElement): void {
        try {
            if (info.importsMap.length <= 0 || !ifr.contentDocument) return;
            const js = '{"imports": { ' + info.importsMap.join(',\n') + '} }';
            const script = document.createElement('script');
            script.type = 'importmap';
            script.textContent = js;
            ifr.contentDocument.head.appendChild(script);
        } catch (e: any) {
            console.info('Error mountJSImporMap: ' + e.message);
            return;
        }

    }

    private mountLinks(info: IJSONDependence, ifr: HTMLIFrameElement): void {

        try {
            if (info.importsLinks.length <= 0 || !ifr.contentDocument) return;
            for (let link of info.importsLinks) {
                const linkRef = document.createElement('link');
                linkRef.href = link.ref;
                linkRef.rel = link.rel;
                ifr.contentDocument.head.appendChild(linkRef);
            }

        } catch (e: any) {
            console.info('Error mountJSImporMap: ' + e.message);
            return;
        }

    }

    /**
     * Injects Tailwind v4 dark mode configuration into the iframe.
     * 
     * Tailwind v4 uses `prefers-color-scheme` by default.
     * This overrides it to use the `dark` class on <html>, 
     * so toggleDarkLight() in servicePreview can control it via classList.
     * 
     * Must be called BEFORE Tailwind processes the DOM (before the script runs).
     */
    private mountTailwindDarkMode(ifr: HTMLIFrameElement): void {
        try {
            if (!ifr.contentDocument) return;

            const hasTailwind = this.json?.importsJs.some(
                (url) => url.includes('tailwindcss')
            );
            if (!hasTailwind) return;

            const style = document.createElement('style');
            style.setAttribute('type', 'text/tailwindcss');
            style.textContent = `@custom-variant dark (&:where(.dark, .dark *));`;
            ifr.contentDocument.head.appendChild(style);

        } catch (e: any) {
            console.info('Error mountTailwindDarkMode: ' + e.message);
        }
    }

    private mountTokens(tokens: string, file: mls.stor.IFileInfo): void {
        try {
            const iframe = (window as any).preview.iframe;
            if (!iframe || !iframe.contentDocument) return;
            this.removeOlderTokens(iframe, file);
            const css = tokens || '';
            if (!css) return;
            const style = document.createElement('style');
            style.textContent = css;
            style.id = this.getIdTokens(file);
            iframe.contentDocument.head.appendChild(style);

        } catch (e: any) {
            console.info('Error mountTokens: ' + e.message);
        }
    }

    private removeOlderTokens(ifr: HTMLIFrameElement, file: mls.stor.IFileInfo) {
        const id = this.getIdTokens(file);
        if (!ifr.contentDocument || !id) return;
        const st = ifr.contentDocument.head.querySelectorAll(`#${id}`);
        st.forEach((s) => s.remove());
    }

    private getIdTokens(file: mls.stor.IFileInfo) {
        if (!file) return 'ds_tokens';
        const { project } = file
        return '_' + project + '_ds_tokens';
    }

    private addGlobalCss(globalCss: string) {
        if (!globalCss) return
        try {
            const iframe = window.preview.iframe;
            if (!iframe || !iframe.contentDocument) return;
            const oldStyle = iframe.contentDocument.querySelector('style#global_css');
            if (oldStyle) oldStyle.remove();
            const style = document.createElement('style');
            style.textContent = globalCss;
            style.id = 'global_css';
            style.type = "text/tailwindcss";
            iframe.contentDocument.head.appendChild(style);

        } catch (e: any) {
            console.info('Error mountTokens: ' + e.message);
        }
    }

    private addJsReference(ifr: HTMLIFrameElement, level: string) {

        const s = document.createElement('script') as HTMLScriptElement;
        s.textContent = `
				window['mls'] = window['mls']  ? window['mls']  : parent.mls ? parent.mls : top['mls'];
				window['monaco'] = window['monaco']  ? window['monaco']  : parent.monaco ? parent.monaco : top['monaco'];
                window['fetch'] = parent.fetch.bind(parent);
				window['globalVariation'] = window['globalVariation']  ? window['globalVariation']  : parent.globalVariation ? parent.globalVariation : top['globalVariation'];
				window['latest'] = window['latest']  ? window['latest']  : parent.latest ? parent.latest : top['latest'];
				window['EasyMDE'] = window['EasyMDE']  ? window['EasyMDE']  : parent.EasyMDE ? parent.EasyMDE : top['EasyMDE'];
                window['litDisableBundleWarning'] = true;
                window['collabActualLevel'] = ${level};
                window['previewL1'] = window['previewL1']  ? window['previewL1']  : parent.previewL1 ? parent.previewL1 : top['previewL1'];
                window['preview'] = window['preview']  ? window['preview']  : parent.preview ? parent.preview : top['preview'];

                (window)['originalDefine'] = customElements.define.bind(customElements);
                    customElements.define = (name, constructor, options) => {
                    if (!customElements.get(name)) {
                        return (window)['originalDefine'](name, constructor, options);
                    }
                };

            
    `;

        ifr.contentDocument?.body.appendChild(s);
    }


}
