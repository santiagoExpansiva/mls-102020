/// <mls fileReference="_102020_/l2/buildFile.ts" enhancement="_blank"/>

import { getTokensCss, getGlobalCss } from '/_102027_/l2/designSystemBase.js';
import { getPath } from '/_102027_/l2/utils';
import { convertFileToTag, resolveTagToFile } from '/_102020_/l2/utils';


export interface IJSONDependence {
    file: string,
    wcComponents: string[],
    importsMap: string[],
    importsJs: string[],
    importsLinks: { ref: string, rel: string }[],
    tokens: string | undefined,
    globalCss: string,
    errors: { tag: string, error: string }[]
}


export function getDependenciesByHtml(file: mls.stor.IFileInfo, html: string, theme: string, withCss: boolean = false): Promise<IJSONDependence> {
    return new Promise<IJSONDependence>(async (resolve, reject) => {
        try {
            const ret = await getDependencies(file, 'byHtml', html, theme, withCss);
            resolve(ret)
        } catch (e) {
            reject(e);
        }
    });
}

async function getDependencies(storFile: mls.stor.IFileInfo, fileName: string, html: string, theme: string, withCss: boolean = false) {

    const { project, shortName, folder } = storFile;
    let wcComponents = extractTagsCustom(html);

    const tag = convertFileToTag({ project, shortName, folder });
    if (!wcComponents.includes(tag)) wcComponents.push(tag);

    const importsMap: string[] = [];
    const importsJs: string[] = [];
    const importsLinks: { ref: string, rel: string }[] = [];
    const errors: { tag: string, error: string }[] = [];
    const modules = {};

    await getCompileInfo(
        wcComponents,
        importsMap,
        importsJs,
        importsLinks,
        errors,
        modules,
    );

    const previewEditorL3Import = '/_102020_/l2/previewEditorL3.js';
    if (!importsJs.includes(previewEditorL3Import)) {
        importsJs.push(previewEditorL3Import);
    }

    let tokens: string | undefined = await getTokensCss(project, theme);
    let globalCss: string | undefined = await getGlobalCss(project, theme);

    return {
        file: fileName,
        wcComponents,
        importsMap: Array.from(new Set(importsMap)),
        importsJs: Array.from(new Set(importsJs)),
        importsLinks: Array.from(new Set(importsLinks)),
        globalCss,
        tokens,
        errors
    }

}


function extractTagsCustom(html: string): string[] {

    const container = document.createElement('div');
    container.innerHTML = html;

    const customTags: Set<string> = new Set();
    const tagsException: Set<string> = new Set([]);

    const allElements = container.querySelectorAll('*');

    allElements.forEach(element => {
        const tagName = element.tagName.toLowerCase();
        const isCustomTag = tagName.includes('-');
        const isInCodeBlock = element.closest('code') !== null;
        if (
            isCustomTag &&
            !tagsException.has(tagName) &&
            !isInCodeBlock
        ) {
            customTags.add(tagName);
        }
    });

    return Array.from(customTags);
}

async function getCompileInfo(
    tags: string[],
    myImportsMap: string[],
    myImports: string[],
    myLinks: { ref: string; rel: string }[],
    myErrors: { tag: string; error: string }[],
    myModules: Record<string, { jsMap: boolean; mModule: any }>,
): Promise<void> {

    for (const tag of tags) {
        try {

            const info = resolveTagToFile(tag);
            if (!info?.project || !info?.shortName) continue;

            const { project, shortName, folder } = info;
            const lv = mls.actualLevel === 1 ? 1 : 2;
            const key = mls.stor.getKeyToFiles(project, lv, shortName, folder, '.ts');
            const file = mls.stor.files[key];

            const ipath: mls.stor.IFileInfoBase = {
                project,
                shortName,
                folder: file?.folder ?? folder,
            } as mls.stor.IFileInfoBase;

            const enhancementName = await getEnhancementFromFetch(ipath);
            if (!enhancementName) throw new Error('enhancementName not valid');

            if (enhancementName === '_blank') {
                await getJSBlank(myImports, ipath);
                continue;
            }

            if (!myModules[enhancementName]) {
                const pathInfo = getPath(enhancementName);
                if (!pathInfo) throw new Error(`[] Not found path: ${enhancementName}`);

                myModules[enhancementName] = {
                    jsMap: false,
                    mModule: await mls.l2.enhancement.getEnhancementModule(pathInfo),
                };
            }

            await getJSImporMap(myImportsMap, enhancementName, myModules);
            await getJSImportEnhancement(myImports, enhancementName, myModules);
            await getJS(myImports, enhancementName, ipath, myModules);
            await getLinks(myLinks, enhancementName, myModules);

        } catch (e: any) {
            myErrors.push({ tag, error: e.message });
        }
    }
}

async function getEnhancementFromFetch(file: { project: number, shortName: string, folder: string }) {

    const url = getImportUrl(file as mls.stor.IFileInfoBase);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const txt = await response.text();
    const lines = txt.replace(/\r\n/g, '\n').split('\n');
    const mlsLine = lines.find(line => line.trim().startsWith('/// <mls '));;

    if (!mlsLine) {
        throw new Error(`Not found tag 'mls' in ${url}`);
    }

    const enhancementMatch = mlsLine.match(/enhancement="([^"]+)"/);
    if (!enhancementMatch) {
        throw new Error('Not found attr "enhancement" in ' + url);
    }

    return enhancementMatch[1];

}

function getImportUrl(info: mls.stor.IFileInfoBase): string {
    let url = `/_${info.project}_/l2/${info.shortName}`;
    if (info.folder) {
        url = `/_${info.project}_/l2/${info.folder}/${info.shortName}`
    }
    return url;
}

async function getJSImportEnhancement(myImports: string[], enhacementName: string, myModules: any) {

    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');
    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;

    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i) => {
        if (i.type !== 'import') return;
        myImports.push(i.ref);
    });

}
async function getJSImporMap(myImportsMap: string[], enhacementName: string, myModules: any) {

    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');

    if (myModules[enhacementName].jsMap) return;
    myModules[enhacementName].jsMap = true;
    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;

    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i) => {
        if (i.type !== 'cdn') return;
        myImportsMap.push(`"${i.name}": "${i.ref}"`);
    });

}

async function getJSBlank(myImports: string[], mfile: mls.stor.IFileInfoBase) {
    let key = getImportUrl(mfile);
    if (myImports.includes(key)) return;
    myImports.push(key);
}

async function getJS(myImports: string[], enhacementName: string, mfile: mls.stor.IFileInfoBase, myModules: any) {
    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');
    let key = getImportUrl(mfile);
    if (myImports.includes(key)) return;
    myImports.push(key);
}

async function getLinks(myLinks: { ref: string, rel: string }[], enhacementName: string, myModules: any) {
    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');

    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;
    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i: any) => {
        if (i.type !== 'link') return;
        myLinks.push({ rel: i.args, ref: i.ref });
    });
}