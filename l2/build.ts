/// <mls shortName="build" project="102020" enhancement="_blank" />

import { createAllModels } from './_100554_collabLibModel';
import { createStorFile, IReqCreateStorFile } from './_100554_collabLibStor';
import { getGlobalCss, getTokensCss } from './_100554_designSystemBase';
import { getDependenciesByHtmlFile } from './_100554_libCompile';
import { convertTagToFileName } from './_100554_utilsLit';

let esBuild: any;
export const DISTFOLDER = 'wwwroot';

export async function buildModule(project: number, moduleName: string) {

    await loadEsBuild();
    const moduleConfig = await getProjectModule(project, moduleName);
    const allPages = await getAllPages(project, moduleConfig.path) || [];
    let buildRequired: boolean = false;

    await prepareStyleFile(project, moduleConfig.theme);
    await prepareRunTimeFile(project);

    for (let storFiles of allPages) {
        let needBuild: boolean = false;
        const storFilesDist = getDistStorFile(storFiles.ts);

        if (!storFilesDist.storFileDistJs || !storFilesDist.storFileDistHtml) needBuild = true;
        else {

            const dtJsDist = new Date(storFilesDist.storFileDistJs.updatedAt || '');
            const dtHtmlDist = new Date(storFilesDist.storFileDistHtml.updatedAt || '');

            if (
                storFiles.ts.updatedAt &&
                storFiles.html.updatedAt
            ) {

                const dtJs = new Date(storFiles.ts.updatedAt);
                const dtHtml = new Date(storFiles.html.updatedAt);
                if (dtJsDist < dtJs || dtHtmlDist < dtHtml) needBuild = true;
                else needBuild = false;

                if (
                    storFilesDist.storFileDistJs.inLocalStorage &&
                    storFilesDist.storFileDistHtml.inLocalStorage &&
                    !storFiles.ts.inLocalStorage &&
                    !storFiles.html.inLocalStorage &&
                    dtJsDist > dtJs &&
                    dtHtml > dtHtml
                ) {
                    mls.stor.localStor.setContent(storFilesDist.storFileDistHtml, { content: null });
                    mls.stor.localStor.setContent(storFilesDist.storFileDistJs, { content: null });
                    needBuild = true;
                } else if (!needBuild && !storFiles.html.inLocalStorage && !storFiles.ts.inLocalStorage) {
                    mls.stor.localStor.setContent(storFilesDist.storFileDistHtml, { content: null });
                    mls.stor.localStor.setContent(storFilesDist.storFileDistJs, { content: null });
                    needBuild = false;
                }

            }

            if (!needBuild) {
                needBuild = await checkOrganismInPageIsOutdated(storFiles.defs.references?.widgets || [], dtHtmlDist, dtJsDist, storFiles.html.inLocalStorage, storFiles.ts.inLocalStorage);
            }
        }

        if (needBuild) {
            buildRequired = true;
            await buildPage(storFiles.ts, storFiles.html, moduleConfig.theme);
        }

    }

    return buildRequired;

}

async function checkOrganismInPageIsOutdated(widgets: mls.l4.DefsWidget[], outdatedHtml: Date, outdatedTs: Date, outdatedHTMLLocal: boolean, outdatedTsLocal: boolean) {
    let needBuild: boolean = false;

    for (let widget of widgets) {
        if (!widget.used) continue;
        const fileInfo = convertTagToFileName(widget.tag);
        if (!fileInfo) continue;
        const { folder, project, shortName } = fileInfo;
        const storFiles = await mls.stor.getFiles({
            folder,
            project,
            shortName,
            level: 2,
            loadContent: false
        });

        if (storFiles.ts?.updatedAt) {
            const dtJs = new Date(storFiles.ts.updatedAt);
            if (outdatedTs < dtJs || (outdatedTs > dtJs && !outdatedTsLocal && storFiles.ts.inLocalStorage)) {
                needBuild = true;
                break;
            }
        }

        if (storFiles.html?.updatedAt) {
            const dtHtml = new Date(storFiles.html.updatedAt);
            if (outdatedHtml < dtHtml || (outdatedHtml > dtHtml && !outdatedHTMLLocal && storFiles.html.inLocalStorage))
                needBuild = true;
            break;
        }
    }

    return needBuild;

}

async function buildPage(storFileTs: mls.stor.IFileInfo, storFileHtml: mls.stor.IFileInfo, theme: string) {

    const { folder, project, shortName, level } = storFileTs;
    let models = mls.editor.getModels(project, shortName, folder, level);
    if (!models) {
        models = await createAllModels(storFileTs, true, true);
    }

    const html = await storFileHtml.getContent();
    if (!html || typeof html !== 'string') return;

    let data = await getDependenciesByHtmlFile(storFileHtml, html, theme, true);

    const importsMap = parseImportsMap(data.importsMap);
    const webcomponets = findWidgets(html)
    const valids = [...new Set([...Object.keys(importsMap), ...data.importsJs, ...webcomponets])];

    const result = await executeEsBuild(importsMap, valids, webcomponets, data.importsJs);
    generateOutput(storFileTs, html, result.outputFiles[0].text);

}


async function buildRunTimeFile(storFile: mls.stor.IFileInfo) {

    const { folder, project, shortName, level } = storFile;
    let models = mls.editor.getModels(project, shortName, folder, level);
    if (!models) {
        models = await createAllModels(storFile, true, true);
    }
    let data = await getDependenciesByHtmlFile(storFile, '', '', true);

    const ts = await storFile.getContent();
    if (!ts || typeof ts !== 'string') return;

    const importsMap = parseImportsMap(data.importsMap);
    const valids = [...new Set([...Object.keys(importsMap), ...data.importsJs])];
    const result = await executeEsBuild(importsMap, valids, [], data.importsJs);
    generateOutputRunTime(project, result.outputFiles[0].text);

}


async function executeEsBuild(importsMap: Record<string, string>, valids: string[], webcomponets: string[], importsJs: string[]) {

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

                    if ((args.path.startsWith("./") || args.path.startsWith("../")) &&
                        !args.importer.startsWith("https://") && !importsMap[args.importer]) {

                        const url = new URL(args.path, 'file:' + args.importer);
                        let path = url.pathname;

                        if (!(/_(\d+)_/.test(path))) {

                            const info = mls.l2.getPath(args.importer.replace('/l2/', '').replace('/', ''));

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
                    if (args.path.startsWith("/") && importsMap[args.importer]) {
                        const url = new URL(args.path, importsMap[args.importer]);
                        return { path: url.href, namespace: 'virtual' };
                    }

                    // url externa
                    if (args.path.startsWith("http")) {
                        return { path: args.path, namespace: 'virtual' };
                    }


                return null;
            });

            build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: any) => {
                try {

                    let path = importsMap[args.path] ? importsMap[args.path] : args.path;
                    if (path.startsWith('_')) return;
                    const res = await fetch(path);
                    if (!res.ok) throw new Error(`Error get ${args.path}`);

                    const text = await res.text();
                    return { contents: text, loader: 'js' };

                } catch (e) {
                    console.info('erro:' + args.path);
                    return { contents: '', loader: 'js' }
                }

            });
        },
    };

    let allImports = [...importsJs, ...webcomponets];
    allImports = [...new Set(allImports)];
    const virtualEntryPath = "virtual-entry.js";
    const virtualEntryContent = allImports.map(path => `import "${path}";`).join("\n");
    const result = await esBuild.build({
        stdin: {
            contents: virtualEntryContent,
            resolveDir: "/",
            sourcefile: virtualEntryPath,
            loader: "js"
        },
        bundle: true,
        minify: false,
        format: "esm",
        sourcemap: false,
        write: false,
        plugins: [virtualFsPlugin]
    });

    return result;

}

async function generateOutput(storFile: mls.stor.IFileInfo, htmlString: string, jsString: string) {
    const { project, shortName, folder } = storFile;
    const newDistFolder = folder ? `${DISTFOLDER}/${folder}` : DISTFOLDER;
    const storFilesDist = getDistStorFile(storFile);
    let storFileJs = storFilesDist.storFileDistJs;
    let storFileHtml = storFilesDist.storFileDistHtml;

    if (!storFileJs) storFileJs = await createStorFileOutput({ project, shortName, folder: newDistFolder, ext: '.js' }, jsString);
    else await mls.stor.localStor.setContent(storFileJs, { contentType: 'string', content: jsString });
    if (!storFileHtml) storFileHtml = await createStorFileOutput({ project, shortName, folder: newDistFolder, ext: '.html' }, htmlString);
    else await mls.stor.localStor.setContent(storFileHtml, { contentType: 'string', content: htmlString });

    storFileHtml.updatedAt = new Date().toISOString();
    storFileJs.updatedAt = new Date().toISOString();

    await mls.stor.cache.addIfNeed({
        project,
        folder: newDistFolder,
        content: htmlString,
        extension: '.html',
        shortName,
        version: storFileHtml.versionRef,
    });

    await mls.stor.cache.addIfNeed({
        project,
        folder: newDistFolder,
        content: jsString,
        extension: '.js',
        shortName,
        version: storFileJs.versionRef,
    });

}

async function prepareStyleFile(project: number, theme: string): Promise<boolean> {

    const shortName = 'globalStyle';
    const keyStorFileCssGlobal = mls.stor.getKeyToFiles(project, 2, 'project', '', '.less');
    const storFile = mls.stor.files[keyStorFileCssGlobal];
    if (!storFile) return false;

    const keyStorFileCssGlobalDist = mls.stor.getKeyToFiles(project, 2, shortName, DISTFOLDER, '.css');
    const storFileDist = mls.stor.files[keyStorFileCssGlobalDist];

    if (!storFileDist || storFile.inLocalStorage) {
        const globalCss: string | undefined = await getGlobalCss(project, theme);
        const tokens: string = await getTokensCss(project, theme);
        await generateOutputCssGlobal(project, `${globalCss}\n\n${tokens || ''}`);
        return true;
    }

    const versionStyle = storFileDist?.versionRef || '0';
    const cacheStyle = await mls.stor.cache.getFileFromCache(project, DISTFOLDER, shortName, '.css', versionStyle);
    if (!cacheStyle) {
        const contentStyle = await storFileDist.getContent();
        if (contentStyle && typeof contentStyle === 'string') {
            await mls.stor.cache.addIfNeed({
                project: project,
                folder: DISTFOLDER,
                content: contentStyle,
                extension: '.css',
                shortName,
                version: versionStyle,
                contentType: 'text/plain'
            });
        }
    }
    return false;
}

async function prepareRunTimeFile(project: number) {

    const shortName = 'collabRunTime';
    const runTimeStorTime = mls.stor.getKeyToFiles(project, 2, shortName, '', '.ts');
    const storFile = mls.stor.files[runTimeStorTime];
    if (!storFile) return;
    const keyDist = mls.stor.getKeyToFiles(project, 2, shortName, DISTFOLDER, '.js');
    const storFileDist = mls.stor.files[keyDist];
    if (!storFileDist || storFile.inLocalStorage) {
        await buildRunTimeFile(storFile);
    }
    const version = storFileDist?.versionRef || '0';
    const cacheRunTime = await mls.stor.cache.getFileFromCache(project, DISTFOLDER, shortName, '.js', version);
    if (!cacheRunTime) {
        const contentRunTime = await storFileDist.getContent();
        if (contentRunTime && typeof contentRunTime === 'string') {
            await mls.stor.cache.addIfNeed({
                project: project,
                folder: DISTFOLDER,
                content: contentRunTime,
                extension: '.js',
                shortName,
                version,
            });
        }
    }
}

async function generateOutputRunTime(project: number, content: string) {
    const shortName = 'collabRunTime';
    const keyToDistRunTime = mls.stor.getKeyToFiles(project, 2, shortName, DISTFOLDER, '.js');
    let storFileDistRunTime = mls.stor.files[keyToDistRunTime];
    if (!storFileDistRunTime) storFileDistRunTime = await createStorFileOutput({ project, shortName, folder: DISTFOLDER, ext: '.js' }, content);
    else await mls.stor.localStor.setContent(storFileDistRunTime, { contentType: 'string', content: content });
    await mls.stor.cache.addIfNeed({
        project,
        folder: DISTFOLDER,
        content: content,
        extension: '.js',
        shortName,
        version: storFileDistRunTime.versionRef,
    });
}

async function generateOutputCssGlobal(project: number, cssString: string) {

    const shortName = 'globalStyle';
    const keyToDistCssGlobal = mls.stor.getKeyToFiles(project, 2, shortName, DISTFOLDER, '.css');
    let storFileDistCssGlobal = mls.stor.files[keyToDistCssGlobal];
    if (!storFileDistCssGlobal) storFileDistCssGlobal = await createStorFileOutput({ project, shortName, folder: DISTFOLDER, ext: '.css' }, cssString);
    else await mls.stor.localStor.setContent(storFileDistCssGlobal, { contentType: 'string', content: cssString });
    await mls.stor.cache.addIfNeed({
        project,
        folder: DISTFOLDER,
        content: cssString,
        extension: '.css',
        shortName,
        version: storFileDistCssGlobal.versionRef,
    });
}

function getDistStorFile(storFile: mls.stor.IFileInfo) {
    const { project, shortName, folder, level } = storFile;
    const newDistFolder = folder ? `${DISTFOLDER}/${folder}` : DISTFOLDER;
    const keyToDistJs = mls.stor.getKeyToFiles(project, level, shortName, newDistFolder, '.js');
    const keyToDistHtml = mls.stor.getKeyToFiles(project, level, shortName, newDistFolder, '.html');

    let storFileDistJs = mls.stor.files[keyToDistJs];
    let storFileDistHtml = mls.stor.files[keyToDistHtml];
    return {
        storFileDistJs,
        storFileDistHtml,
    }
}

async function createStorFileOutput(data: { project: number, shortName: string, folder: string, ext: string }, source: string) {
    const param: IReqCreateStorFile = {
        project: data.project,
        shortName: data.shortName,
        folder: data.folder,
        level: 2,
        extension: data.ext,
        source,
        status: 'new'
    }

    const storFile = await createStorFile(param, false, false, false);
    return storFile;
}

async function getAllPages(project: number, modulePath: string) {

    const allPages: { ts: mls.stor.IFileInfo, html: mls.stor.IFileInfo, defs: mls.l4.BaseDefs }[] = [];

    for (let key of Object.keys(mls.stor.files)) {
        const storFile = mls.stor.files[key];
        if (storFile.extension !== '.defs.ts' || storFile.project !== project || storFile.folder !== modulePath) continue;
        const keyToImport = storFile.folder ? `_${storFile.project}_${storFile.folder}_${storFile.shortName}` : `./_${storFile.project}_${storFile.shortName}`

        try {
            const module = await import(`./${keyToImport}.defs.js`);
            if (!module) continue;
            const defs = module?.defs;
            if (!defs || defs.meta.type !== 'page') continue;
            const keyHTML = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, '.html');
            const keyTs = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, '.ts');
            const sfTs = mls.stor.files[keyTs];
            const sfHtml = mls.stor.files[keyHTML];
            if (!sfTs || !sfHtml) continue;
            allPages.push({
                ts: sfTs,
                html: sfHtml,
                defs
            });
        } catch (err) {
            console.error('Error on get defs from page:' + keyToImport)
            continue;
        }


    }

    return allPages;
}

async function getProjectModule(project: number, moduleName: string): Promise<IModuleInfo> {
    const keyToImportProject = `./_${project}_project`;
    const moduleProject = await import(`./${keyToImportProject}`);
    if (!moduleProject) throw new Error(`_${project}_project not found`);
    if (!moduleProject.modules) throw new Error(`No modules configured`);
    const moduleConfig = moduleProject.modules.find((item: any) => item.name === moduleName);
    if (!moduleConfig) throw new Error(`Not found module in project: ${moduleName}`);

    const keyToImportModule = `./_${project}_${moduleConfig.path}_module`;
    const moduleInfo = await import(`./${keyToImportModule}`);
    if (!moduleInfo) throw new Error(`Not found module config : ${moduleName}`);

    const rc: IModuleInfo = {
        name: moduleName,
        path: moduleConfig.path,
        theme: moduleInfo.moduleConfig.theme
    }
    return rc;
}

function parseImportsMap(importsArray: string[]) {
    return Object.fromEntries(
        importsArray.map(str => {
            const match = str.match(/^"(.+?)":\s*"(.+?)"$/);
            if (!match) throw new Error("Formato inválido: " + str);
            const [, key, value] = match;
            return [key, value];
        })
    );
}

function findWidgets(html: string) {
    if (!html) return [];
    const tempEl = document.createElement('div');
    tempEl.innerHTML = html;
    const els = tempEl.querySelectorAll('*');
    const array = Array.from(els)
        .map((el) => {
            const info = convertTagToFileName(el.tagName.toLowerCase() || '');
            if (!info) return '';
            if (info.folder) {
                return '/' + `_${info.project}_${info.folder}/${info.shortName}`;
            }
            return '/' + `_${info.project}_${info.shortName}`;

        }).filter(Boolean);
    const ret = [...new Set(array)]
    return ret;

}

async function loadEsBuild() {

    if ((mls as any).esbuild) {
        esBuild = (mls as any).esbuild;
    } else if (!(mls as any).esbuildInLoad) await initializeEsBuild();
}

async function initializeEsBuild() {

    (mls as any).esbuildInLoad = true;
    const url = 'https://unpkg.com/esbuild-wasm@0.14.54/esm/browser.min.js';
    if (!esBuild) {
        esBuild = await import(url);
        await esBuild.initialize({
            wasmURL: "https://unpkg.com/esbuild-wasm@0.14.54/esbuild.wasm"
        });
        (mls as any).esbuild = esBuild;
        (mls as any).esbuildInLoad = false
    }

}


interface IModuleInfo {
    path: string,
    name: string,
    theme: string
}
