/// <mls shortName="agentNewPrototype4" project="102020" enhancement="_blank" folder="agents" />

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts';
import { getImages } from '/_100554_/l2/libUnsplash';
import { convertFileNameToTag, convertTagToFileName } from '/_100554_/l2/utilsLit';
import { createNewFile } from "/_100554_/l2/pluginNewFileBase";
import { formatHtml } from '/_100554_/l2/collabDOMSync';
import { addModule, configureMasterFrontEnd } from '/_100554_/l2/projectAST';
import { getPayload3, PayLoad3 } from '/_102020_/l2/agents/agentNewPrototype3';
import { getGlobalLess } from '/_100554_/l2/designSystemBase.js';
import { createAllModels } from '/_100554_/l2/collabLibModel.js';
import { removeTokensFromSource } from '/_102027_/l2/libCompileStyle.js';

import {
    getNextPendingStepByAgentName,
    getNextInProgressStepByAgentName,
    notifyTaskChange,
    updateTaskTitle,
    updateStepStatus,
    appendLongTermMemory,
    getNextPendentStep,
    getInteractionStepId,
    getStepById
} from "/_100554_/l2/aiAgentHelper";

import {
    startNewInteractionInAiTask,
    startNewAiTask,
    executeNextStep,
    addNewStep,
} from "/_100554_/l2/aiAgentOrchestration";

const agentName = "agentNewPrototype4";
const agentProject = 102020;
const projectToSave = mls.actualProject || 0;
const enhancementTs = '_102020_enhancementAura';
const enhancementStyle = '_100554_enhancementStyle';
const auraStart = '_102020_start';
const auraBuild = '_102020_build';
const auraLiveView = '_102020_collabAuraLiveView';

export function createAgent(): IAgent {
    return {
        agentName,
        avatar_url: svg_agent,
        agentDescription: "Agent for create a new Module - 4",
        visibility: "private",
        async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _beforePrompt(context);
        },
        async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _afterPrompt(context);
        },
        async replayForSupport(context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> {
            return _replayForSupport(context, payload);
        }
    };

}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

    const taskTitle = "Planning 4...";
    if (!context || !context.message) throw new Error("Invalid context");

    if (!context.task) {
        const pageIndex: number = 0;
        const organism: string[] = []
        const payload3: PayLoad3 = getPayload3Mock();
        const totalPages = payload3.pages.length;
        const inputs: any = await getPrompts(payload3, organism, pageIndex);
        const moduleName = sanitizeFolder(payload3.finalModuleDetails.moduleName, projectToSave);

        await startNewAiTask(agentName, taskTitle, context.message.content, context.message.threadId, context.message.senderId, inputs, context, _afterPrompt, { 'next_page': `${pageIndex}`, 'organism_created': JSON.stringify(organism), "total_pages": totalPages.toString(), "module_name": moduleName });
        return;
    }

    const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
    if (!step) {
        throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
    }
    const organismAlreadyDeclared = getOrganismsAlreadyCreated(context);
    let payload3: PayLoad3 | undefined;
    if (context.modeSingleStep) payload3 = getPayload3Mock(); // only for dev test on preview
    else payload3 = getPayload3(context);

    const totalPages = payload3.pages.length;
    let moduleName = context.task?.iaCompressed?.longMemory['module_name'];
    if (!moduleName) {
        moduleName = sanitizeFolder(payload3.finalModuleDetails.moduleName, projectToSave);
        appendLongTermMemory(context, { "total_pages": totalPages.toString(), "module_name": moduleName });
    }

    const inputs = await getPrompts(payload3, organismAlreadyDeclared, Number(step.prompt));
    await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);

}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

    if (!context || !context.message || !context.task) throw new Error("Invalid context");
    const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](afterPrompt) No in progress interaction found.`);

    context = await updateStepStatus(context, step.stepId, "completed", "no more agents");
    context = await createPage(context);
    notifyTaskChange(context);

    if (!context.task) throw new Error(`[${agentName}](afterPrompt) Invalid context task`);
    const nextPage = context.task?.iaCompressed?.longMemory['next_page'] ? +(context.task?.iaCompressed?.longMemory['next_page']) : -1;
    const totalPagesIndex = context.task?.iaCompressed?.longMemory['total_pages'] ? +(context.task?.iaCompressed?.longMemory['total_pages']) : undefined;

    if (totalPagesIndex === undefined || nextPage >= totalPagesIndex) {
        context.task = await updateTaskTitle(context.task, "Ok, all pages created, see result");
        await executeNextStep(context);
        return;
    }

    context.task = await updateTaskTitle(context.task, "Ok, page created");
    const stepPendent = getNextPendentStep(context.task);
    if (!stepPendent) throw new Error(`[${agentName}](afterPrompt) Invalid next stepPendent`);

    const newStep: mls.msg.AIPayload = {
        agentName: 'agentNewPrototype4',
        prompt: nextPage.toString(),
        status: 'pending',
        stepId: stepPendent.stepId + 1,
        interaction: null,
        nextSteps: null,
        rags: null,
        type: 'agent'
    }
    await addNewStep(context, stepPendent.stepId, [newStep]);

}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceByPriority(source: string, key: string, value: string): string {
    const escapedKey = escapeRegex(key);

    const pattern1 = new RegExp(`\\{{2}${escapedKey}\\}{2}`, 'g'); // {{key}}
    const pattern2 = new RegExp(`\\$\\{${escapedKey}\\}`, 'g');     // ${key}
    const pattern3 = new RegExp(escapedKey, 'g');                   // key

    if (pattern1.test(source)) {
        return source.replace(pattern1, value);
    } else if (pattern2.test(source)) {
        return source.replace(pattern2, value);
    } else if (pattern3.test(source)) {
        return source.replace(pattern3, value);
    }

    return source;
}

async function createPage(context: mls.msg.ExecutionContext) {

    if (!context || !context.task) throw new Error(`[${agentName}](createPage) Not found context to createPage`);
    const step = getNextPendentStep(context.task);
    if (!step || step.type !== 'flexible') throw new Error(`[${agentName}](createPage) Invalid step in createPage`);
    const payload4: PayLoad4 = step.result;
    if (!payload4 || !payload4.pageHtml) throw new Error(`[${agentName}](createPage) Not found "pageHtml" in payload`);

    let payload3: PayLoad3 | undefined;
    if (context.modeSingleStep) payload3 = getPayload3Mock(); // only for dev test on preview
    else payload3 = getPayload3(context);

    consistPayload3(payload3)

    const resolvedImages = await getAllImages(payload4.images);

    let finalSource = payload4.pageHtml;


    for (const [key, url] of Object.entries(resolvedImages)) {
        finalSource = replaceByPriority(finalSource, key, url);
    }

    if (finalSource) {
        console.info(finalSource);
        // throw new Error('Error force');
    }


    const actualTaskIndex = context.task?.iaCompressed?.longMemory['next_page'] ? +(context.task?.iaCompressed?.longMemory['next_page']) : 0;
    const folder = context.task?.iaCompressed?.longMemory['module_name'];
    if (!folder) throw new Error(`[${agentName}](createPage) Invalid module name`)

    const groupName = folder;
    const pageData = payload3.pages[actualTaskIndex];
    const shortName = pageData.pageName;
    const shortName1 = sanitizeMeta(shortName, projectToSave, folder);

    if (actualTaskIndex === 0) {
        await createModuleFile(shortName1, projectToSave, folder, groupName, payload3);
        await createProjectFile(groupName, projectToSave, payload3);
    }

    const organismUsed = extractOrganismTags(finalSource);
    context.task = await updateLongMemory(context, organismUsed, actualTaskIndex, shortName1, step.stepId);
    await generateFiles(step, context.task, payload4, payload3, finalSource, organismUsed, projectToSave, folder, groupName, shortName1, actualTaskIndex);
    return context;
}

const _replayForSupport = async (context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> => {
    throw new Error("[replayForSupport] not implemented");
}

async function getPrompts(payload3: PayLoad3, organismDeclared: string[], pageIndex: number): Promise<mls.msg.IAMessageInputType[]> {

    const actualProject = projectToSave;
    const organismNames = extractOrganismNames(payload3.pagesWireframe[pageIndex].pageHtml);
    const organismsUsed = payload3.organism.filter((item) => organismNames.includes(item.organismTag));
    const tagName = convertFileNameToTag({ project: actualProject, shortName: payload3.pages[pageIndex].pageName });

    const { pageName, pageGoal } = payload3.pages[pageIndex];
    const { pageHtml } = payload3.pagesWireframe[pageIndex];

    const { moduleGoal, moduleName, userLanguage, requirements, } = payload3.finalModuleDetails;

    const finalModuleDetails = {
        moduleGoal,
        moduleName,
        userLanguage,
        requirements,
    };

    const data: Record<string, string> = {
        pageName,
        pageGoal,
        pageWireframe: arrayToHtml(pageHtml),
        organismDetails: JSON.stringify(organismsUsed, null, 2),
        finalModuleDetails: JSON.stringify(finalModuleDetails, null, 2),
        organismDeclared: JSON.stringify(organismDeclared),
        project: actualProject?.toString() || '',
        tag: tagName,
    }

    const prompts = await getPromptByHtml({ project: agentProject, shortName: agentName, folder: 'agents', data })
    return prompts;
}

function arrayToHtml(lines: string[]): string {
    let indentLevel = 0;
    const indentChar = "\t";
    const html: string[] = [];

    const isClosingTag = (line: string) => /^<\/.+?>$/.test(line.trim());
    const isSelfClosing = (line: string) =>
        /\/>$/.test(line.trim()) ||
        /^<.+><\/.+>$/.test(line.trim());

    for (let raw of lines) {
        const line = raw.trim();
        if (isClosingTag(line)) {
            indentLevel = Math.max(indentLevel - 1, 0);
        }
        html.push(indentChar.repeat(indentLevel) + line);

        if (!isClosingTag(line) && !isSelfClosing(line) && /^<[^/!][^>]*>$/.test(line)) {
            indentLevel++;
        }
    }
    return html.join("\n");
}


async function updateLongMemory(context: mls.msg.ExecutionContext, newOrganism: string[], actualTaskIndex: number, pageName: string, stepId: number) {
    const byLongMemory = context.task?.iaCompressed?.longMemory['organism_created'];
    const pagesCreated = context.task?.iaCompressed?.longMemory['pages_created'];

    const data = (byLongMemory ? JSON.parse(byLongMemory) : []) as string[]
    const dataPagesCreated = (pagesCreated ? JSON.parse(pagesCreated) : {}) as Record<number, string>

    const newOrganismData: string[] = [...data].concat(newOrganism);
    const newOrganismArr = Array.from(new Set(newOrganismData))
    if (actualTaskIndex !== undefined && actualTaskIndex > -1) {
        actualTaskIndex = actualTaskIndex + 1;
    }

    if (!dataPagesCreated[stepId]) dataPagesCreated[stepId] = pageName;

    const task = await appendLongTermMemory(context, {
        'organism_created': JSON.stringify(newOrganismArr),
        'next_page': actualTaskIndex.toString(),
        'pages_created': JSON.stringify(dataPagesCreated),
    });

    context.task = task;
    return task;
}

function consistPayload3(payload3: PayLoad3): PayLoad3 {
    if (!payload3) throw new Error(`[${agentName}](consistPayload3) No find payload`);
    if (!payload3.organism) throw new Error(`[${agentName}](consistPayload3) No find payload organism`);
    if (!payload3.pages) throw new Error(`[${agentName}](consistPayload3) No find payload pages`);
    return payload3;
}

function getOrganismsAlreadyCreated(context: mls.msg.ExecutionContext): string[] {
    const byLongMemory = context.task?.iaCompressed?.longMemory['organism_created'];
    return (byLongMemory ? JSON.parse(byLongMemory) : []) as string[]
}

function extractOrganismTags(htmlString: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const organismElements = Array.from(doc.querySelectorAll('*')).filter((el) =>
        el.tagName.toLowerCase().startsWith('organism-')
    );
    return [...new Set(organismElements.map((el) => el.tagName.toLowerCase()))];
}

function extractOrganismNames(pageHtml: string[]): string[] {
    const organismRegex = /<organism-([\w-]+)>/g;
    const organisms = new Set<string>();

    for (const line of pageHtml) {
        let match;
        while ((match = organismRegex.exec(line)) !== null) {
            organisms.add(`organism-${match[1]}`);
        }
    }

    return Array.from(organisms);
}

async function getAllImages(
    images: Images[]
): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};


    for (const img of images) {
        try {
            const result = await getImages(img.searchText, 1, 1);
            if (result.images && result.images.length > 0) {
                const image = result.images[0];
                resolved[img.key] = image.urls[img.type];
            } else {
                resolved[img.key] = `https://source.unsplash.com/800x600/?${encodeURIComponent(img.key)}`;
            }
        } catch (err) {
            console.warn(`Failed to get image for "${img.key}":`, err);
            resolved[img.key] = `https://source.unsplash.com/800x600/?${encodeURIComponent(img.key)}`;
        }
    }

    return resolved;
}

export function getPayload4(task: mls.msg.TaskData, stepId: number): PayLoad4 {
    if (!task) throw new Error(`[${agentName}](getPayload) Invalid task`);
    const agentStep = getStepById(task, stepId); // Only one agent execution must exist in this task
    if (!agentStep) throw new Error(`[${agentName}](getPayload) no agent found`);

    // get result
    const resultStep = agentStep.interaction?.payload?.[0];
    if (!resultStep || resultStep.type !== "flexible" || !resultStep.result) throw new Error(`[${agentName}] [getPayload] No step flexible found for this agent.`);
    let payload4: PayLoad4 | string = resultStep.result;
    if (typeof payload4 === "string") payload4 = JSON.parse(payload4) as PayLoad4;
    return payload4;
}

async function generateFiles(
    step: mls.msg.AIPayload,
    task: mls.msg.TaskData,
    payload4: PayLoad4,
    payload3: PayLoad3,
    htmlFull: string,
    organism: string[],
    project: number,
    folder: string,
    groupName: string,
    shortName: string,
    index: number
): Promise<string> {
    try {

        const { html, style } = extractStyleFromHtml(htmlFull);

        const enhancement = enhancementTs;
        const pageTagName = convertFileNameToTag({ project, shortName, folder });
        const info = convertTagToFileName(pageTagName);
        if (!info) return '';

        await generateOrganisms(payload3, organism, htmlFull, project, folder, groupName);

        const sourceTS = generateTsPage(info, groupName, pageTagName, payload3);
        const sourceHTML = generateHtmlPage(info, pageTagName, html);
        const sourceLess = generateLessPage(info, groupName, pageTagName, htmlFull);
        const sourceDefs = generateDefsPage(info, groupName, pageTagName, payload3, index, payload4.images, organism, task, step);
        await createNewFile({ project, folder, shortName, position: 'right', enhancement, sourceTS: sourceTS.trim(), sourceHTML, sourceLess, sourceDefs, openPreview: false });

        // await updateGlobalCss(payload4.cssGlobal, project);

        return `page created: ${folder}/${shortName}`

    } catch (err: any) {
        return `[${agentName}](generateFiles) ${err.message}`;
    }
}

async function updateGlobalCss(globalCss: string, project: number) {
    const pathGlobal = mls.l2.getPath(`_${project}_project`);
    let modelsGlobal = getModel({ folder: pathGlobal.folder, project: pathGlobal.project, shortName: pathGlobal.shortName });
    if (!modelsGlobal) {
        const keyToStorFile = mls.stor.getKeyToFiles(pathGlobal.project, 2, 'project', pathGlobal.folder, '.ts');
        const storFile = mls.stor.files[keyToStorFile];
        if (!storFile) throw new Error(`[${agentName}] updateFile: Not found project file`);
        modelsGlobal = await createAllModels(storFile, true, true);
    }

    if (!modelsGlobal) throw new Error(`[${agentName}] updateFile: Not found models for project file`);
    const css = await prepareGlobalCss(globalCss, project);
    if (css && modelsGlobal.style) {
        modelsGlobal.style.model.setValue(css);
        mls.editor.forceModelUpdate(modelsGlobal.style.model);
    }
}

async function prepareGlobalCss(css: string, projectId: number) {
    let lines = css.split("\n");

    if (lines[0].trim().startsWith("///")) {
        lines.shift();
    }

    let cssContent = lines.join("\n").trim();
    cssContent = removeTokensFromSource(cssContent);
    return `/// <mls shortName="project" project="${projectId}" enhancement="enhancementStyle" folder="" />\n${cssContent}\n`;
}

function getModel(info: { project: number, shortName: string, folder: string }): mls.editor.IModels | undefined {
    const key = mls.editor.getKeyModel(info.project, info.shortName, info.folder, mls.actualLevel);
    return mls.editor.models[key];
}

async function createProjectFile(moduleName: string, project: number, payload3: PayLoad3) {
    const res = await addModule(project, moduleName, true);
    if (!res.ok) throw new Error(`[${agentName}](createProjectFile) ${res.message}`)
    const res2 = await configureMasterFrontEnd(project, auraStart, auraBuild, auraLiveView);
    if (!res2.ok) throw new Error(`[${agentName}](createProjectFile) ${res.message}`)
}

async function createModuleFile(shortName: string, project: number, folder: string, groupName: string, payload3: PayLoad3) {

    const moduleShortName = 'module';
    const enhancement = '_blank';

    const ts = `
/// <mls shortName="${moduleShortName}" project="${project}" folder="${folder}" groupName="${groupName}" enhancement="_blank" />

export const moduleConfig = {
  theme: "${folder}",
  initialPage: "${shortName}",
  menu: ${JSON.stringify(payload3.menu, null, 2)}
}

`;

    await createNewFile({ project, shortName: moduleShortName, folder, position: 'right', enhancement, sourceTS: ts.trim(), sourceHTML: '', sourceLess: '', sourceDefs: '', openPreview: false });

}

async function generateOrganisms(payload3: PayLoad3, organisms: string[], htmlString: string, project: number, folder: string, groupName: string) {

    const enhancement = enhancementTs;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const styles = doc.querySelectorAll('style[type="text/less"]');
    const scripts = doc.querySelectorAll('script');

    const resultStyles = Array.from(styles).map(style => ({
        name: style.getAttribute('data-name'),
        content: style.textContent
    }));

    const resultScripts = Array.from(scripts).map(script => ({
        name: script.getAttribute('id'),
        content: script.textContent
    }));

    for await (let organism of organisms) {

        const organismEl = doc.querySelector(organism);
        if (!organismEl) continue;
        const styleData = resultStyles.find((result) => result.name === organism);
        const scriptData = resultScripts.find((result) => result.name === organism);

        const organismData = payload3.organism.find((org) => org.organismTag === organism);
        if (!organismData) return;

        let shortName1 = sanitizeMeta(organismData.organismTag, project, folder);

        const tagNameWithFolder = `${folder}--${shortName1}-${project}`;
        const info = convertTagToFileName(tagNameWithFolder);
        if (!info) continue;

        const organismHtml = organismEl.innerHTML;
        if (!organismHtml) continue;
        const organismLess = styleData?.content?.replace(`${organism} {`, `${tagNameWithFolder} {`);
        const organismScript = scriptData?.content;

        const sourceTS = generateTsOrganism(info, tagNameWithFolder, groupName, organismHtml, organismScript);
        const sourceHTML = generateHtmlOrganism(info, tagNameWithFolder);
        const sourceLess = generateLessOrganism(info, groupName, organismLess || '');
        const sourceDefs = generateDefsOrganism(info, groupName, tagNameWithFolder, payload3, organism);

        await createNewFile({ project, shortName: info.shortName, folder, position: 'right', enhancement, sourceTS: sourceTS.trim(), sourceHTML, sourceLess, sourceDefs, openPreview: false });

    }

}

function generateTsPage(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    groupName: string,
    pageTagName: string,
    payload: PayLoad3,
): string {

    const enhancement = enhancementTs;

    const ts = `
/// <mls shortName="${info.shortName}" project="${info.project}" folder="${info.folder}" enhancement="${enhancement}" groupName="${groupName}" />

import { CollabPageElement } from '/_100554_/l2/collabPageElement.js';
import { customElement } from 'lit/decorators.js';

@customElement('${pageTagName}')
export class Page${info.shortName.charAt(0).toUpperCase()}${info.shortName.slice(1)} extends CollabPageElement {
    initPage() {

    }
}`;

    return ts;
}


function generateLessPage(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    groupName: string,
    pageTagName: string,
    htmlString: string
): string {


    const enhancement = enhancementStyle;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const styles = doc.querySelectorAll('style[type="text/less"]');
    const resultStyles = Array.from(styles).map(style => ({
        name: style.getAttribute('data-name'),
        content: style.textContent
    }));

    const tagNameWithoutFolder = convertFileNameToTag({ shortName: info.shortName, project: info.project });
    let styleData = resultStyles.find((result) => result.name === `page-${tagNameWithoutFolder}`); // page-home-100554
    if (!styleData) styleData = resultStyles.find((result) => result.name === `page-${info.shortName}`); //page-adminPanel
    if (!styleData) return "";

    if (styleData && !styleData.content) return "";
    const lessContent = replacePageLessTag(styleData.content as string, info.project, info.shortName, pageTagName);
    const lessResult = `/// <mls shortName="${info.shortName}" project="${info.project}" folder="${info.folder}" groupName="${groupName}" enhancement="${enhancement}" />\n\n ${lessContent || ''}`;
    return lessResult;

}

function generateHtmlPage(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    pageTagName: string,
    htmlFull: string,
): string {

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlFull, 'text/html');
    const allElements = doc.querySelectorAll('*');
    const countByTags: Record<string, number> = {};
    const pageName = info.shortName;

    allElements.forEach((element) => {
        const tag = element.tagName.toLowerCase();
        if (tag.startsWith('organism')) {
            if (!countByTags[tag]) {
                countByTags[tag] = 1;
            } else {
                countByTags[tag]++;
            }
            element.id = pageName + tag.replace('organism', '') + countByTags[tag].toString()
        } else {
            if (!countByTags[tag]) {
                countByTags[tag] = 1;
            } else {
                countByTags[tag]++;
            }
            element.id = pageName + '-core-' + tag + countByTags[tag].toString()
        }
    });

    let newHtml = replaceOrganismTags(doc.body.outerHTML, info.project, info.folder);
    newHtml = replacePageTag(newHtml, info.project, info.shortName, pageTagName);

    const htmlFinal = `${formatHtml(newHtml)}`;
    return htmlFinal;
}

function generateDefsPage(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    groupName: string,
    pageTagName: string,
    payload: PayLoad3,
    index: number,
    images: Images[],
    organism: string[],
    task: mls.msg.TaskData,
    step: mls.msg.AIPayload
): string {

    const page = payload.pages[index];
    const wireframe = payload.pagesWireframe.find(p => p.pageSequential === page.pageSequential);
    const widgets = wireframe ? extractOrganismTagsFromHtml(wireframe.pageHtml) : [];

    const defs: mls.l4.BaseDefs = {
        meta: {
            projectId: info.project,
            folder: info.folder,
            shortName: info.shortName,
            type: "page",
            devFidelity: "scaffold",
            group: payload.finalModuleDetails.moduleName,
            tags: ["lit", "page"]
        },
        references: {
            widgets,
            plugins: [],
            statesRO: [],
            statesRW: [],
            statesWO: [],
            imports: []
        },
        planning: {
            generalDescription: "",
            goal: page.pageGoal,
            userStories: [
                {
                    story: `Como visitante, quero acessar a página "${page.pageName}" para ${page.pageGoal.toLowerCase()}`,
                    derivedRequirements: page.pageRequirements.map(desc => ({ description: desc }))
                }
            ],
            userRequestsEnhancements: [],
            constraints: []
        }
    };

    let trace: string = '';
    const stepInteractionId = getInteractionStepId(task, step.stepId);
    if (stepInteractionId) {
        const stepInteraction = getStepById(task, stepInteractionId);
        if (stepInteraction) trace = stepInteraction.interaction?.trace.join('\n') || ''
    }

    return `/// <mls shortName="${info.shortName}" project="${info.project}" folder="${info.folder}" groupName="${groupName}" enhancement="_blank" />\n\n` +
        `// Do not change – automatically generated code.\n\n` +
        `export const defs: mls.l4.BaseDefs = ${JSON.stringify(defs, null, 2)}\n\n
/*\n
Task Id: ${task.PK}\n
Step Trace: ${trace}
Organism used in page: ${JSON.stringify(organism, null, 2)} \n
Images:\n ${JSON.stringify(images, null, 2)}\n 
\n*/
`;
}


function generateTsOrganism(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    tagName: string,
    groupName: string,
    organismHtml: string,
    organismScript: string | null | undefined
) {

    const enhancement = enhancementTs;
    const shortName = info.shortName;

    const parser = new DOMParser();
    const doc = parser.parseFromString(organismHtml, 'text/html');
    let counter = 1;
    const prefixId = tagName.replace('organism-', '');
    doc.body.querySelectorAll('*').forEach(el => {
        el.id = el.id || `${prefixId}-${counter++}`;
    });

    doc.body.querySelectorAll('script').forEach((scr) => scr.remove());
    doc.body.querySelectorAll('style').forEach((stl) => stl.remove());

    const ts = `
/// <mls shortName="${shortName}" project="${info.project}" folder="${info.folder}" enhancement="${enhancement}" groupName="${groupName}" />

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { IcaOrganismBase } from '/_100554_/l2/icaOrganismBase.js';

@customElement('${tagName}')
export class ${shortName} extends IcaOrganismBase {

    ${organismScript ? `
        firstUpdated(){
            ${organismScript}
        }
    `: ''}

    render(){
        return html\`${doc.body.innerHTML}\`
    }
}`;

    return ts;

}

function generateHtmlOrganism(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    tagName: string
): string {

    try {
        const htmlResult = `<${tagName}></${tagName}>`;
        return htmlResult;

    } catch (err: any) {
        throw new Error(`[${agentName}](generateHtmlOrganism) ${err.message}`);
    }
}

function generateLessOrganism(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    groupName: string,
    less: string
): string {

    try {

        const shortName = info.shortName;
        const enhancement = enhancementStyle;
        if (!less) return '';
        const lessResult = `/// <mls shortName="${shortName}" project="${info.project}" folder="${info.folder}" groupName="${groupName}" enhancement="${enhancement}" />\n\n ${less}`
        return lessResult;

    } catch (err: any) {
        throw new Error(`[${agentName}](generateLessOrganism) ${err.message}`);
    }
}

function generateDefsOrganism(
    info: {
        shortName: string;
        project: number;
        folder: string;
    },
    groupName: string,
    tagName: string,
    payload: PayLoad3,
    organismTag: string,
): string {

    const organism = payload.organism.find((org) => org.organismTag === organismTag);
    if (!organism) return '';

    const defs: mls.l4.BaseDefs = {
        meta: {
            projectId: info.project,
            folder: info.folder,
            shortName: info.shortName,
            type: "organism",
            devFidelity: "scaffold",
            group: payload.finalModuleDetails.moduleName,
            tags: ["lit", "organism"]
        },
        references: {
            widgets: [],
            plugins: [],
            statesRO: [],
            statesRW: [],
            statesWO: [],
            imports: []
        },
        planning: {
            generalDescription: organism.planning?.context || '',
            goal: organism.planning.goal,
            userStories: organism.planning?.userStories,
            userRequestsEnhancements: organism.planning.userRequestsEnhancements || [],
            constraints: organism.planning.constraints || []
        }
    };

    return `/// <mls shortName="${info.shortName}" project="${info.project}" folder="${info.folder}" groupName="${groupName}" enhancement="_blank" />\n\n` +
        `// Do not change – automatically generated code.\n\n` +
        `export const defs: mls.l4.BaseDefs = ${JSON.stringify(defs, null, 2)}\n`;
}

function replaceOrganismTags(htmlString: string, project: number, folder: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const organismElements = doc.querySelectorAll('*');
    organismElements.forEach((el) => {
        if (el.tagName.toLowerCase().startsWith('organism-')) {
            const tagName = el.tagName.toLowerCase();
            const newTagName = folder ? `${folder}--${tagName}-${project}` : `${tagName}-${project}`;
            const newEl = document.createElement(newTagName);
            for (const attr of el.attributes) {
                newEl.setAttribute(attr.name, attr.value);
            }
            el.replaceWith(newEl);
        }
    });
    doc.querySelectorAll('script').forEach((sc) => sc.remove());
    return doc.body.innerHTML;
}

function replacePageTag(htmlString: string, project: number, shortName: string, newTag: string) {
    const oldTag = convertFileNameToTag({ shortName, project });
    const escapedOldTag = oldTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedOldTag, 'g');
    const newHtml = htmlString.replace(regex, newTag);
    return newHtml;
}

function replacePageLessTag(lessString: string, project: number, shortName: string, newTag: string) {
    const oldTag = convertFileNameToTag({ shortName, project });
    const escapedOldTag = oldTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedOldTag}(?=\\s*\\{)`);
    const newLess = lessString.replace(regex, (match, prefix) => `${prefix}${newTag}`);
    return newLess;
}


function extractStyleFromHtml(htmlString: string): { html: string; style: string } {
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;

    let styleContent = '';
    let match: RegExpExecArray | null;

    while ((match = styleRegex.exec(htmlString)) !== null) {
        styleContent += match[1].trim() + '\n';
    }

    const cleanedHtml = htmlString.replace(styleRegex, '').trim();
    return {
        html: cleanedHtml,
        style: styleContent.trim(),
    };
}


function verifyFileIfExists(args: { project: number, shortName: string, folder: string }): boolean {
    const key = mls.stor.getKeyToFiles(args.project, 2, args.shortName, args.folder, ".ts")
    return !!mls.stor.files[key];
}

function sanitizeMeta(baseShortName: string, project: number, folder: string): string {
    let candidateName = baseShortName;
    let suffix = 1;

    while (verifyFileIfExists({ project, shortName: candidateName, folder })) {
        candidateName = `${baseShortName}${suffix}`;
        suffix++;
    }
    return candidateName;
}

function verifyFolderAlreadyExists(args: { project: number, folder: string }): boolean {

    let alreadyExists: boolean = false;
    for (let storFile of Object.values(mls.stor.files)) {
        if (storFile.folder === args.folder && storFile.project === args.project) {
            alreadyExists = true;
            break;
        }
    }

    return alreadyExists;

}

function sanitizeFolder(folderName: string, project: number): string {
    let candidateName = folderName;
    let suffix = 1;

    while (verifyFolderAlreadyExists({ project, folder: candidateName })) {
        candidateName = `${folderName}${suffix}`;
        suffix++;
    }
    return candidateName;
}

function extractOrganismTagsFromHtml(pageHtml: string[]): mls.l4.DefsWidget[] {
    const tags = new Set<string>();
    for (const line of pageHtml) {
        const match = line.match(/<organism-[\w-]+/g);
        if (match) {
            match.forEach(tag => {
                const clean = tag.replace("<", "").split(" ")[0].trim();
                tags.add(clean);
            });
        }
    }

    const widgets = Array.from(tags);
    const arr = widgets.map((tag) => {
        const w: mls.l4.DefsWidget = {
            tag,
            bindings: [],
            purpose: '',
            used: true
        }
        return w;
    });

    return arr;
}

function getPayload3Mock(): PayLoad3 {

    const data: PayLoad3 = {
        "finalModuleDetails": {
            "userLanguage": "pt-BR",
            "executionRegions": "BR",
            "userPrompt": "criar um web site para petshop",
            "moduleGoal": "Desenvolver um website completo para petshop com funcionalidades de agendamento de serviços e loja online, direcionado para donos de pets, com tom amigável e profissional",
            "moduleName": "petshop",
            "requirements": [
                "Website para petshop com público-alvo donos de pets",
                "Dois papéis de usuário: administrador e cliente",
                "Tom amigável e profissional",
                "Idioma: apenas português",
                "Funcionalidades principais: agendamento de serviços e loja online",
                "Criação de conteúdo e imagens necessária",
                "Design moderno e limpo como referência",
                "Serviços oferecidos: banho, tosa, consulta veterinária e vacinação",
                "Categorias de produtos: ração, brinquedos, acessórios e produtos de higiene",
                "Métodos de pagamento: cartão de crédito, PIX e boleto",
                "Fluxo de agendamento: confirmação automática com lembretes por email",
                "Horários de funcionamento: segunda a sábado, das 8h às 18h"
            ],
            "userRequestsEnhancements": [
                {
                    "description": "Incluir gestão automática de estoque para os produtos",
                    "priority": "should"
                },
                {
                    "description": "Permitir criação de perfis detalhados para pets (histórico médico, preferências)",
                    "priority": "should"
                },
                {
                    "description": "Implementar programa de fidelidade ou sistema de pontos para clientes",
                    "priority": "could"
                },
                {
                    "description": "Incluir opções de entrega para produtos comprados online",
                    "priority": "could"
                },
                {
                    "description": "Adicionar integração com redes sociais para compartilhamento e login",
                    "priority": "could"
                }
            ]
        },
        "pages": [
            {
                "pageSequential": 0,
                "pageName": "homePage",
                "pageGoal": "Página inicial para apresentar o petshop, serviços e produtos de forma atrativa",
                "pageRequirements": [
                    "Exibir banner principal com chamada para ação",
                    "Listar serviços oferecidos",
                    "Destaques de produtos",
                    "Informações de contato e horários"
                ]
            },
            {
                "pageSequential": 1,
                "pageName": "servicesPage",
                "pageGoal": "Página para listar serviços e permitir agendamento",
                "pageRequirements": [
                    "Listar serviços: banho, tosa, consulta veterinária e vacinação",
                    "Formulário de agendamento com confirmação automática",
                    "Lembretes por email"
                ]
            },
            {
                "pageSequential": 2,
                "pageName": "shopPage",
                "pageGoal": "Loja online para venda de produtos",
                "pageRequirements": [
                    "Categorizar produtos: ração, brinquedos, acessórios e produtos de higiene",
                    "Carrinho de compras",
                    "Integração com métodos de pagamento: cartão, PIX, boleto"
                ]
            },
            {
                "pageSequential": 3,
                "pageName": "appointmentPage",
                "pageGoal": "Página dedicada ao agendamento de serviços",
                "pageRequirements": [
                    "Formulário de agendamento",
                    "Seleção de serviços e horários disponíveis",
                    "Confirmação automática e lembretes"
                ]
            },
            {
                "pageSequential": 4,
                "pageName": "aboutPage",
                "pageGoal": "Página sobre o petshop",
                "pageRequirements": [
                    "Informações sobre a empresa",
                    "Horários de funcionamento",
                    "Equipe e missão"
                ]
            },
            {
                "pageSequential": 5,
                "pageName": "contactPage",
                "pageGoal": "Página de contato",
                "pageRequirements": [
                    "Formulário de contato",
                    "Informações de localização e telefone",
                    "Mapa integrado"
                ]
            },
            {
                "pageSequential": 6,
                "pageName": "adminPanel",
                "pageGoal": "Painel administrativo para gerenciar agendamentos, produtos e clientes",
                "pageRequirements": [
                    "Gerenciar agendamentos",
                    "Gerenciar produtos e estoque",
                    "Visualizar pedidos e clientes"
                ]
            },
            {
                "pageSequential": 7,
                "pageName": "petProfilePage",
                "pageGoal": "Página para clientes criarem e gerenciarem perfis de pets",
                "pageRequirements": [
                    "Criar perfis de pets",
                    "Histórico médico e preferências"
                ]
            }
        ],
        "plugins": [
            {
                "pluginSequential": 0,
                "pluginName": "pluginstripe",
                "pluginType": "third-party",
                "pluginGoal": "Integrar métodos de pagamento como cartão de crédito, PIX e boleto",
                "pluginRequirements": [
                    "Processar pagamentos online",
                    "Suporte a PIX e boleto no Brasil"
                ]
            },
            {
                "pluginSequential": 1,
                "pluginName": "plugingoogleanalytics",
                "pluginType": "third-party",
                "pluginGoal": "Rastrear uso e comportamento dos usuários no site",
                "pluginRequirements": [
                    "Coletar dados de visitantes",
                    "Análise de tráfego e conversões"
                ]
            },
            {
                "pluginSequential": 2,
                "pluginName": "pluginthemeswitcher",
                "pluginType": "ui",
                "pluginGoal": "Permitir alternância entre temas claro e escuro",
                "pluginRequirements": [
                    "Botão para mudar tema",
                    "Aplicar tokens de cor dinamicamente"
                ]
            }
        ],
        "pagesWireframe": [
            {
                "pageSequential": 0,
                "pageName": "homePage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-hero-banner></organism-hero-banner>",
                    "<organism-services-overview></organism-services-overview>",
                    "<organism-products-highlights></organism-products-highlights>",
                    "<organism-contact-info></organism-contact-info>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 1,
                "pageName": "servicesPage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-services-list></organism-services-list>",
                    "<organism-appointment-form></organism-appointment-form>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 2,
                "pageName": "shopPage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<aside>",
                    "<organism-product-filters></organism-product-filters>",
                    "</aside>",
                    "<main>",
                    "<organism-product-grid></organism-product-grid>",
                    "<organism-shopping-cart></organism-shopping-cart>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 3,
                "pageName": "appointmentPage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-appointment-form></organism-appointment-form>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 4,
                "pageName": "aboutPage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-about-content></organism-about-content>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 5,
                "pageName": "contactPage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-contact-form></organism-contact-form>",
                    "<organism-map></organism-map>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 6,
                "pageName": "adminPanel",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-admin-nav></organism-admin-nav>",
                    "</header>",
                    "<aside>",
                    "<organism-admin-sidebar></organism-admin-sidebar>",
                    "</aside>",
                    "<main>",
                    "<organism-appointments-management></organism-appointments-management>",
                    "<organism-products-management></organism-products-management>",
                    "<organism-orders-management></organism-orders-management>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            },
            {
                "pageSequential": 7,
                "pageName": "petProfilePage",
                "pageHtml": [
                    "<body>",
                    "<header>",
                    "<organism-nav></organism-nav>",
                    "</header>",
                    "<main>",
                    "<organism-pet-profiles-list></organism-pet-profiles-list>",
                    "<organism-pet-profile-form></organism-pet-profile-form>",
                    "</main>",
                    "<footer>",
                    "<organism-footer></organism-footer>",
                    "</footer>",
                    "</body>"
                ]
            }
        ],
        "organism": [
            {
                "organismSequential": 0,
                "organismTag": "organism-nav",
                "planning": {
                    "context": "Navegação principal do site, presente em todas as páginas públicas, para facilitar o acesso a seções principais.",
                    "goal": "Exibir menu de navegação com links para páginas principais como Início, Serviços, Loja, Sobre e Contato.",
                    "userStories": [
                        {
                            "story": "Como usuário, quero navegar facilmente entre as seções do site para encontrar informações rapidamente.",
                            "derivedRequirements": [
                                {
                                    "description": "Incluir links para homePage, servicesPage, shopPage, aboutPage e contactPage",
                                    "comment": "Links devem ser responsivos e acessíveis"
                                },
                                {
                                    "description": "Adicionar botão de login/cadastro para clientes",
                                    "comment": "Integração com autenticação"
                                }
                            ]
                        },
                        {
                            "story": "Como administrador, quero acessar o painel admin diretamente da navegação.",
                            "derivedRequirements": [
                                {
                                    "description": "Link condicional para adminPanel se logado como admin",
                                    "comment": "Verificação de papel de usuário"
                                }
                            ]
                        }
                    ],
                    "constraints": [
                        "Deve ser responsivo para mobile e desktop",
                        "Usar tokens de cor para temas claro e escuro"
                    ]
                }
            },
            {
                "organismSequential": 1,
                "organismTag": "organism-hero-banner",
                "planning": {
                    "context": "Banner principal na página inicial para capturar atenção e direcionar ações.",
                    "goal": "Exibir imagem ou vídeo atrativo com título, subtítulo e botão de chamada para ação, como agendar serviço ou ver produtos.",
                    "userStories": [
                        {
                            "story": "Como visitante, quero ver um banner atrativo que me incentive a explorar os serviços do petshop.",
                            "derivedRequirements": [
                                {
                                    "description": "Incluir imagem de pets felizes",
                                    "comment": "Tom amigável e profissional"
                                },
                                {
                                    "description": "Botão para redirecionar a servicesPage ou appointmentPage",
                                    "comment": "Chamada para ação clara"
                                }
                            ]
                        }
                    ],
                    "constraints": [
                        "Deve carregar rapidamente",
                        "Responsivo"
                    ]
                }
            },
            {
                "organismSequential": 2,
                "organismTag": "organism-services-overview",
                "planning": {
                    "context": "Visão geral dos serviços na homePage para informar rapidamente.",
                    "goal": "Listar serviços oferecidos com ícones e breves descrições.",
                    "userStories": [
                        {
                            "story": "Como dono de pet, quero ver os serviços disponíveis para decidir qual agendar.",
                            "derivedRequirements": [
                                {
                                    "description": "Exibir banho, tosa, consulta veterinária e vacinação",
                                    "comment": "Baseado em servicesOffered"
                                },
                                {
                                    "description": "Links para servicesPage para mais detalhes",
                                    "comment": "Navegação fluida"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 3,
                "organismTag": "organism-products-highlights",
                "planning": {
                    "context": "Destaques de produtos na homePage para promover vendas.",
                    "goal": "Mostrar produtos em destaque das categorias ração, brinquedos, acessórios e higiene.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero ver produtos recomendados para comprar online.",
                            "derivedRequirements": [
                                {
                                    "description": "Grid de produtos com imagens e preços",
                                    "comment": "Integração com shopPage"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 4,
                "organismTag": "organism-contact-info",
                "planning": {
                    "context": "Informações de contato na homePage.",
                    "goal": "Exibir horários, telefone e endereço.",
                    "userStories": [
                        {
                            "story": "Como usuário, quero ver horários de funcionamento para planejar visita.",
                            "derivedRequirements": [
                                {
                                    "description": "Mostrar segunda a sábado, 8h-18h",
                                    "comment": "Baseado em businessHours"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 5,
                "organismTag": "organism-footer",
                "planning": {
                    "context": "Rodapé comum a todas as páginas.",
                    "goal": "Exibir links de navegação, redes sociais e copyright.",
                    "userStories": [
                        {
                            "story": "Como usuário, quero acessar links rápidos no rodapé.",
                            "derivedRequirements": [
                                {
                                    "description": "Incluir links para políticas de privacidade e termos",
                                    "comment": "Conformidade legal"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 6,
                "organismTag": "organism-services-list",
                "planning": {
                    "context": "Lista de serviços na servicesPage.",
                    "goal": "Exibir detalhes dos serviços com opção de agendamento.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero ver descrições e preços dos serviços para escolher.",
                            "derivedRequirements": [
                                {
                                    "description": "Listar serviços com botões de agendamento",
                                    "comment": "Link para appointmentPage"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 7,
                "organismTag": "organism-appointment-form",
                "planning": {
                    "context": "Formulário de agendamento em servicesPage e appointmentPage.",
                    "goal": "Permitir seleção de serviço, data, horário e confirmação.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero agendar um serviço facilmente com confirmação automática.",
                            "derivedRequirements": [
                                {
                                    "description": "Campos para nome, pet, serviço, data/hora",
                                    "comment": "Validação de horários disponíveis"
                                },
                                {
                                    "description": "Enviar lembrete por email",
                                    "comment": "Baseado em appointmentFlow"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 8,
                "organismTag": "organism-product-filters",
                "planning": {
                    "context": "Filtros na shopPage.",
                    "goal": "Permitir filtrar produtos por categoria.",
                    "userStories": [
                        {
                            "story": "Como comprador, quero filtrar produtos para encontrar o que preciso.",
                            "derivedRequirements": [
                                {
                                    "description": "Filtros por ração, brinquedos, acessórios, higiene",
                                    "comment": "Baseado em productsCategories"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 9,
                "organismTag": "organism-product-grid",
                "planning": {
                    "context": "Grid de produtos na shopPage.",
                    "goal": "Exibir produtos em grid com imagens, nomes e preços.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero navegar produtos e adicionar ao carrinho.",
                            "derivedRequirements": [
                                {
                                    "description": "Botões de adicionar ao carrinho",
                                    "comment": "Integração com shopping-cart"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 10,
                "organismTag": "organism-shopping-cart",
                "planning": {
                    "context": "Carrinho de compras na shopPage.",
                    "goal": "Mostrar itens selecionados, total e checkout.",
                    "userStories": [
                        {
                            "story": "Como comprador, quero revisar meu carrinho e finalizar compra.",
                            "derivedRequirements": [
                                {
                                    "description": "Integração com pluginStripe para pagamento",
                                    "comment": "Suporte a cartão, PIX, boleto"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 11,
                "organismTag": "organism-about-content",
                "planning": {
                    "context": "Conteúdo na aboutPage.",
                    "goal": "Exibir história, missão e equipe do petshop.",
                    "userStories": [
                        {
                            "story": "Como visitante, quero conhecer mais sobre o petshop.",
                            "derivedRequirements": [
                                {
                                    "description": "Texto e imagens sobre a empresa",
                                    "comment": "Tom profissional"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 12,
                "organismTag": "organism-contact-form",
                "planning": {
                    "context": "Formulário de contato na contactPage.",
                    "goal": "Permitir envio de mensagens.",
                    "userStories": [
                        {
                            "story": "Como usuário, quero entrar em contato com dúvidas.",
                            "derivedRequirements": [
                                {
                                    "description": "Campos para nome, email, mensagem",
                                    "comment": "Envio por email"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 13,
                "organismTag": "organism-map",
                "planning": {
                    "context": "Mapa na contactPage.",
                    "goal": "Mostrar localização do petshop.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero ver onde fica o petshop.",
                            "derivedRequirements": [
                                {
                                    "description": "Integração com Google Maps",
                                    "comment": "Exibir endereço"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 14,
                "organismTag": "organism-admin-nav",
                "planning": {
                    "context": "Navegação específica para admin.",
                    "goal": "Menu para painel admin.",
                    "userStories": [
                        {
                            "story": "Como administrador, quero navegar no painel facilmente.",
                            "derivedRequirements": [
                                {
                                    "description": "Links para seções de gerenciamento",
                                    "comment": "Acesso restrito"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 15,
                "organismTag": "organism-admin-sidebar",
                "planning": {
                    "context": "Sidebar no adminPanel.",
                    "goal": "Menu lateral para navegação admin.",
                    "userStories": [
                        {
                            "story": "Como admin, quero acessar rapidamente agendamentos e produtos.",
                            "derivedRequirements": [
                                {
                                    "description": "Links para appointments-management, etc.",
                                    "comment": "Organização clara"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 16,
                "organismTag": "organism-appointments-management",
                "planning": {
                    "context": "Gerenciamento de agendamentos no admin.",
                    "goal": "Listar e editar agendamentos.",
                    "userStories": [
                        {
                            "story": "Como admin, quero visualizar e confirmar agendamentos.",
                            "derivedRequirements": [
                                {
                                    "description": "Tabela de agendamentos com ações",
                                    "comment": "Baseado em appointmentFlow"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 17,
                "organismTag": "organism-products-management",
                "planning": {
                    "context": "Gerenciamento de produtos no admin.",
                    "goal": "Adicionar, editar produtos e estoque.",
                    "userStories": [
                        {
                            "story": "Como admin, quero gerenciar inventário.",
                            "derivedRequirements": [
                                {
                                    "description": "Formulários para CRUD de produtos",
                                    "comment": "Integração com inventoryManagement (should)"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 18,
                "organismTag": "organism-orders-management",
                "planning": {
                    "context": "Gerenciamento de pedidos no admin.",
                    "goal": "Visualizar pedidos e status.",
                    "userStories": [
                        {
                            "story": "Como admin, quero acompanhar vendas.",
                            "derivedRequirements": [
                                {
                                    "description": "Lista de pedidos com detalhes",
                                    "comment": "Integração com pagamentos"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 19,
                "organismTag": "organism-pet-profiles-list",
                "planning": {
                    "context": "Lista de perfis de pets.",
                    "goal": "Mostrar perfis criados pelo cliente.",
                    "userStories": [
                        {
                            "story": "Como dono de pet, quero gerenciar perfis dos meus pets.",
                            "derivedRequirements": [
                                {
                                    "description": "Listar pets com opções de editar",
                                    "comment": "Baseado em petProfiles (should)"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                "organismSequential": 20,
                "organismTag": "organism-pet-profile-form",
                "planning": {
                    "context": "Formulário para criar/editar perfil de pet.",
                    "goal": "Campos para nome, raça, histórico médico, preferências.",
                    "userStories": [
                        {
                            "story": "Como cliente, quero adicionar detalhes do meu pet para personalizar serviços.",
                            "derivedRequirements": [
                                {
                                    "description": "Campos obrigatórios e opcionais",
                                    "comment": "Armazenamento seguro"
                                }
                            ]
                        }
                    ]
                }
            }
        ],
        "visualIdentity": {
            "logoDescription": "A simple, friendly SVG logo featuring a paw print inside a circle, with clean lines and a modern style, using primary and secondary colors for a professional yet approachable look.",
            "fontFamily": "Roboto for body text and Montserrat for headings",
            "iconStyle": "outline",
            "illustrationStyle": "flat illustrations with soft colors depicting pets and pet care items",
            "colorPalette": {
                "primary": "#007BFF",
                "secondary": "#28A745",
                "text": "#333333",
                "background": "#FFFFFF",
                "border": "#E0E0E0",
                "error": "#DC3545",
                "warning": "#FFC107",
                "success": "#28A745"
            }
        },
        "menu": [
            {
                "pageName": "homePage",
                "title": "Início",
                "auth": "user",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9,22 9,12 15,12 15,22'/></svg>"
            },
            {
                "pageName": "servicesPage",
                "title": "Serviços",
                "auth": "user",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/></svg>"
            },
            {
                "pageName": "productsPage",
                "title": "Produtos",
                "auth": "user",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='2' y='3' width='20' height='14' rx='2' ry='2'/><line x1='8' y1='21' x2='16' y2='21'/><line x1='12' y1='17' x2='12' y2='21'/></svg>"
            },
            {
                "pageName": "appointmentPage",
                "title": "Agendar",
                "auth": "user",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>"
            },
            {
                "pageName": "cartPage",
                "title": "Carrinho",
                "auth": "user",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><circle cx='9' cy='21' r='1'/><circle cx='20' cy='21' r='1'/><path d='M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'/></svg>"
            },
            {
                "pageName": "adminPanel",
                "title": "Admin",
                "auth": "admin",
                "icon": "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M12 1l3 6 6 3-6 3-3 6-3-6-6-3 6-3z'/></svg>"
            }
        ]
    }
    return data;
}


export interface PayLoad4 {
    pageHtml: string,
    organismToImplement: string[],
    images: Images[],
}

interface Images {
    key: string,
    searchText: string,
    type: 'raw' | 'full' | 'regular' | 'small' | 'thumb',
    height: number, // px
    width: number, // px
    toolTip: string
}







