/// <mls shortName="agentUpdateTemporaryEndpoints" project="102020" enhancement="_blank" />

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts';
import { createAllModels } from '/_100554_/l2/collabLibModel';

import {
  appendLongTermMemory,
  getNextPendingStepByAgentName,
  getNextInProgressStepByAgentName,
  getNextFlexiblePendingStep,
  updateTaskTitle,
  notifyTaskChange,
  updateStepStatus,
  getNextPendentStep
} from "/_100554_/l2/aiAgentHelper";

import {
  startNewInteractionInAiTask,
  startNewAiTask,
  executeNextStep,
  addNewStep
} from "/_100554_/l2/aiAgentOrchestration";

const agentName = "agentUpdateTemporaryEndpoints";
const projectAgent = 102020;

export function createAgent(): IAgent {
  return {
    agentName,
    avatar_url: svg_agent,
    agentDescription: "Prototype-level organism update agent to mockup organism.",
    visibility: "public",
    scope: [],
    async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
      return _beforePrompt(context);
    },
    async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
      return _afterPrompt(context);
    },
  };
}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

  if (!context || !context.message) throw new Error(`[${agentName}](_beforePrompt) Invalid context`);
  const data = getParamsFromPrompt(context);
  if (!context.task) {
    await initTask(data, context)
    return;
  }
  await continueTask(context);

}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

  if (!context || !context.message || !context.task) throw new Error("Invalid context");
  const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
  if (!step) throw new Error(`[${agentName}] afterPrompt: No in progress interaction found.`);

  context = await updateStepStatus(context, step.stepId, "completed");
  context = await updateFile(context);
  notifyTaskChange(context);

  if (!context.task) throw new Error("Invalid context task");

  const organismRemaing: mls.cbe.IPath[] = JSON.parse(context.task?.iaCompressed?.longMemory['organisms_remaing'] || '[]');
  if (!organismRemaing || organismRemaing.length === 0) {
    context.task = await updateTaskTitle(context.task, "Ok, all temporary endepoints created, see result");
    await executeNextStep(context);
    return;
  }

  const stepPendent = getNextPendentStep(context.task);
  if (!stepPendent) throw new Error(`[${agentName}](afterPrompt) Invalid next stepPendent`);

  const newStep: mls.msg.AIPayload = {
    agentName: 'agentUpdateTemporaryEndpoints',
    prompt: '',
    status: 'pending',
    stepId: stepPendent.stepId + 1,
    interaction: null,
    nextSteps: null,
    rags: null,
    type: 'agent'
  }
  await addNewStep(context, stepPendent.stepId, [newStep]);

}

async function getPrompts(context: mls.msg.ExecutionContext, organism: mls.cbe.IPath, moduleProject: string | undefined, modulePath: string | undefined, updatedAt: string): Promise<mls.msg.IAMessageInputType[]> {

  if (context.modeSingleStep) {
    const dataForReplace = {
      typescript: tsTest,
      defs: defsTest,
      moduleEndPoints,
      updatedAt
    }
    const prompts = await getPromptByHtml({ project: projectAgent, shortName: agentName, folder: '', data: dataForReplace })
    return prompts;
  }


  const organismData = await getOrganismsContents(organism);
  const moduleDefs = await getModuleDefs(context, moduleProject, modulePath);
  const dataForReplace = {
    typescript: organismData.ts,
    defs: organismData.defs,
    moduleEndPoints: moduleDefs,
    updatedAt
  }

  const prompts = await getPromptByHtml({ project: projectAgent, shortName: agentName, folder: '', data: dataForReplace })

  return prompts;

}

async function getOrganismsContents(organism: mls.cbe.IPath) {

  const keyTs = mls.stor.getKeyToFiles(organism.project, 2, organism.shortName, organism.folder, '.ts');
  const keyDefs = mls.stor.getKeyToFiles(organism.project, 2, organism.shortName, organism.folder, '.defs.ts');
  const storTs = mls.stor.files[keyTs];
  const storDefs = mls.stor.files[keyDefs];

  const contentTs = await storTs?.getContent() || '';
  const contentDefs = await storDefs?.getContent() || '';
  return {
    ts: typeof contentTs === 'string' ? contentTs : '',
    defs: typeof contentDefs === 'string' ? contentDefs : '',
  }
}

async function getModuleDefs(context: mls.msg.ExecutionContext, moduleProject: string | undefined, modulePath: string | undefined,): Promise<string> {
  if (!moduleProject || !modulePath) throw new Error(`[${agentName}] getModuleDefs: Invalid module file.`);
  const content = await getContentByExtension({ folder: modulePath, project: +moduleProject, shortName: 'module' }, 'defs');
  if (typeof content !== 'string') throw new Error(`[${agentName}] getModuleDefs: Invalid typeof module file, must be string.`);
  return content;
}

async function continueTask(context: mls.msg.ExecutionContext) {

  if (!context.task) throw new Error(`[${agentName}](continueTask) No task found for this agent.`);
  const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
  if (!step) throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
  const organismRemaing: mls.cbe.IPath[] = JSON.parse(context.task?.iaCompressed?.longMemory['organisms_remaing'] || '[]');
  const project = context.task?.iaCompressed?.longMemory['project'];
  const modulePath = context.task?.iaCompressed?.longMemory['module_path'];
  const updatedAt = context.task?.iaCompressed?.longMemory['update_at'] || new Date().toISOString();
  const actualOrganism = organismRemaing.pop();
  await appendLongTermMemory(context, { "organisms_remaing": JSON.stringify(organismRemaing) });

  const inputs = await getPrompts(context, actualOrganism as mls.cbe.IPath, project, modulePath, updatedAt);
  const taskTitle = `Updating Endpoints`;
  await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);

}

async function initTask(data: IDataMessage, context: mls.msg.ExecutionContext) {

  try {
    const allOrganisms = await getAllOrganismsInStatusMockup(+data.project, data.modulePath);
    if (!allOrganisms || allOrganisms.length === 0) {
      return;
    }

    const updatedAt = new Date().toISOString()
    const actualOrganism = allOrganisms.pop();
    const inputs = await getPrompts(context, actualOrganism as mls.cbe.IPath, data.project, data.modulePath, updatedAt);
    const title = `Updating Endpoints`;
    await startNewAiTask(
      agentName,
      title,
      context.message.content,
      context.message.threadId,
      context.message.senderId,
      inputs,
      context,
      _afterPrompt,
      {
        'module_path': `${data.modulePath}`,
        'project': `${data.project}`,
        'update_at': `${updatedAt}`,
        'organisms_remaing': `${JSON.stringify(allOrganisms)}`
      }
    ).catch((err) => {
      throw new Error(err.message)
    });
  } catch (err: any) {
    throw new Error(err.message)
  }
}

function getParamsFromPrompt(context: mls.msg.ExecutionContext): IDataMessage {
  let messageReplace = context.message.content
    .replace(`@@ ${agentName}`, '')
    .replace(`@@${agentName}`, '').trim()
    .replace(`@@UpdateTemporaryEndpoints`, '');
  let data: IDataMessage;
  data = mls.common.safeParseArgs(messageReplace) as IDataMessage;
  if (!('modulePath' in data) || !('project' in data)) throw new Error(`[${agentName}] beforePrompt: Invalid prompt structure missing modulePath or project`);

  return data;
}

async function getContentByExtension(info: mls.cbe.IPath, modelType: 'html' | 'ts' | 'style' | 'defs') {
  try {
    let models = getModel(info);

    if (!models) {
      const keyToStorFile = mls.stor.getKeyToFiles(info.project, 2, info.shortName, info.folder, '.ts');
      const stotFile = mls.stor.files[keyToStorFile];
      if (!stotFile) throw new Error(`[${agentName}][getContentByExtension]: Invalid storFile`);
      models = await createAllModels(stotFile);
    }

    if (!models) throw new Error(`[${agentName}][getContentByExtension]:Not found models for file:` + info.shortName);
    if (!models[modelType]) return '';
    return models[modelType]?.model.getValue();
  } catch (e: any) {
    throw new Error(`[${agentName}][getContentByExtension]: ${e.message}`);
  }
}

function getModel(info: { project: number, shortName: string, folder: string }): mls.editor.IModels | undefined {
  const key = mls.editor.getKeyModel(info.project, info.shortName, info.folder, 2);
  return mls.editor.models[key];
}


async function updateFile(context: mls.msg.ExecutionContext) {

  if (!context || !context.task) throw new Error(`[${agentName}] updateFile: Not found context`);
  const step = getNextFlexiblePendingStep(context.task);

  if (!step || step.type !== 'flexible') throw new Error(`[${agentName}] updateFile: Invalid step in updateFile`);
  const result: IDataResult = step.result;

  if (!result) throw new Error(`[${agentName}] updateFile: Not found "result"`);

  // console.info(result.logs)
  // console.info(result.moduleEndPoints);
  // console.info(result.endPoints);

  if (context.modeSingleStep) {
    return context;
  }

  const projectMemory = context.task?.iaCompressed?.longMemory['project'];
  const folderMemory = context.task?.iaCompressed?.longMemory['module_path'];
  if (!folderMemory || !projectMemory) throw new Error(`[${agentName}] updateFile: Invalid task memory arguments`);

  const models = getModel({ folder: folderMemory || '', project: +projectMemory, shortName: 'module' });
  if (!models || !models.defs) throw new Error(`[${agentName}] updateFile: Not found models`);

  models.defs.model?.setValue(result.moduleEndPoints);
  return context;

}

async function getAllOrganismsInStatusMockup(project: number, modulePath: string) {

  const allOrganisms: mls.cbe.IPath[] = [];

  for (let key of Object.keys(mls.stor.files)) {
    const storFile = mls.stor.files[key];

    if (storFile.extension !== '.defs.ts' || storFile.project !== project || storFile.folder !== modulePath) continue;

    const keyToImport = storFile.folder ? `_${storFile.project}_${storFile.folder}_${storFile.shortName}` : `./_${storFile.project}_${storFile.shortName}`

    try {
      const module = await import(`./${keyToImport}.defs.js`);
      if (!module) continue;
      const defs = module?.defs;
      if (!defs || defs.meta.type !== 'organism' || defs.meta.devFidelity !== 'organismMock') continue;

      allOrganisms.push({
        folder: storFile.folder,
        project: storFile.project,
        shortName: storFile.shortName
      })

    } catch (err) {
      console.error('Error on get defs from page:' + keyToImport)
      continue;
    }

  }

  return allOrganisms;
}

interface IDataResult {
  moduleEndPoints: string,
  endPoints: string[]
  logs: string[],
}

interface IDataMessage {
  project: string,
  modulePath: string
}

interface ITemporaryEndPoints {

  name: string,
  pages: string[],
  updatedAt: string,
  endpoints: [
    {
      name: string,
      intent: string,
      responseInterfaces: string,
      requestInterfaces: string,
      organism: string[]
    }
  ],
  actions: [
    {
      action: string,
      pageOrOrganismName: string,
    }
  ]
}

const moduleEndPoints = `
/// <mls shortName="module" project="102017" folder="petshop" enhancement="_blank" />

export const temporaryEndpoints:ITemporaryEndPoints[] = [
    {
        name: "blogPostsEndpoints",
        pages: [],
        updatedAt: "2025-11-14T20:01:57.524Z",
        endpoints: [
              {
                "name": "getBlogPost",
                "intent": "I need an endpoint to fetch the blog post content.",
                "responseInterfaces": "interface BlogPostResponse {\ntitle: string;\nmeta: string;\nimageUrl: string;\nalttext: string;\ncontent: {\nintro: string;\nnutrition: { title: string; text: string; };\nexercise: { title: string; text: string; };\ncare: { title: string; text: string; };\nreminder: string;\n};\nshareButtons: {\nfacebook: string;\ntwitter: string;\nwhatsapp: string;\n};\ncomments: Array<{ author: string; text: string; }>;\n}",
                "requestInterfaces": ""
                "organism": ["organismBlogView"]
            }
        ],
        actions: []
    }
];

`


const tsTest = `
/// <mls shortName="organismBlogList" project="102017" folder="petshop" enhancement="_100554_enhancementLit" groupName="petshop" />
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { IcaOrganismBase } from '_100554_icaOrganismBase';
import { setState } from '_100554_collabState';

/// **collab_i18n_start**
const message_pt = {
  readMore: 'Ler mais'
}
const message_en = {
  readMore: 'Read more'
}
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = {
  'en': message_en,
  'pt': message_pt
}
/// **collab_i18n_end**

interface BlogPost {
  id: string;
  imageUrl: string;
  altText: string;
  title: string;
  summary: string;
}

type ContentResponse = BlogPost[];

const inMemoryDb = {
  blogPosts: [
    {
      id: '1',
      imageUrl: 'https://images.unsplash.com/photo-1747577672081-991640ad50ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NDU4NjB8MHwxfHNlYXJjaHwxfHxjYWNob3JybyUyMHNhdWQlQzMlQTF2ZWwlMjBjb21lbmRvJTIwcmElQzMlQTclQzMlQTNvfGVufDB8fHx8MTc2Mjc5NTEzOHww&ixlib=rb-4.1.0&q=80&w=1080',
      altText: 'Imagem de um cachorro saudável',
      title: 'Dicas para Manter seu Pet Saudável',
      summary: 'Aprenda como cuidar da alimentação, exercícios e saúde do seu animal de estimação com essas dicas práticas.'
    },
    {
      id: '2',
      imageUrl: 'https://images.unsplash.com/photo-1652683049894-38aeeb27a3b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NDU4NjB8MHwxfHNlYXJjaHwxfHxnYXRvJTIwYnJpbmNhbmRvJTIwY29tJTIwYnJpbnF1ZWRvfGVufDB8fHx8MTc2Mjc5NTEzOXww&ixlib=rb-4.1.0&q=80&w=1080',
      altText: 'Imagem de um gato brincando',
      title: 'Brincadeiras Divertidas para Gatos',
      summary: 'Descubra jogos e brinquedos que mantêm seu gato ativo e feliz, promovendo o bem-estar.'
    },
    {
      id: '3',
      imageUrl: 'https://images.unsplash.com/photo-1757744140206-07d35af950ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NDU4NjB8MHwxfHNlYXJjaHwxfHxjYWNob3JybyUyMG5vJTIwdmV0ZXJpbiVDMyVBMXJpb3xlbnwwfHx8fDE3NjI3OTUxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
      altText: 'Imagem de um cachorro no veterinário',
      title: 'Quando Levar seu Pet ao Veterinário',
      summary: 'Saiba os sinais de alerta e a importância de check-ups regulares para a saúde do seu pet.'
    }
  ]
};

@customElement('petshop--organism-blog-list-102017')
export class organismBlogList extends IcaOrganismBase {
  @state() contentResponse?: ContentResponse;
  private i18n: MessageType = messages['en'];

  connectedCallback() {
    super.connectedCallback();
    const resp = this.mockFetchBlogPosts();
    this.updateStatesFromContent(resp);
  }

  /**
   * endpoint-intent: I need an endpoint to fetch the list of blog posts.
   * method: GET
   * notes: client-only mock, reads from inMemoryDb.blogPosts
   */
  private mockFetchBlogPosts(): ContentResponse {
    return inMemoryDb.blogPosts;
  }

  private updateStatesFromContent(resp: ContentResponse) {
    setState('ui.petshop.organismBlogList', resp);
    this.contentResponse = resp;
  }

  render() {
    const lang = this.getMessageKey(messages);
    this.i18n = messages[lang];
    return html\`<ul class="blog-list" id="petshop--blog-list-102017-1">
\${this.contentResponse?.map((post, index) => html\`<li class="blog-item" id="petshop--blog-list-102017-\${index + 2}">
<img src="\${post.imageUrl}" alt="\${post.altText}" class="blog-image" id="petshop--blog-list-102017-\${index * 5 + 3}">
<h3 class="blog-title" id="petshop--blog-list-102017-\${index * 5 + 4}">\${post.title}</h3>
<p class="blog-summary" id="petshop--blog-list-102017-\${index * 5 + 5}">\${post.summary}</p>
<a href="#" class="blog-link" id="petshop--blog-list-102017-\${index * 5 + 6}">\${this.i18n.readMore}</a>
</li>\`)}
</ul>\`;
  }
}
`;
const defsTest = `
export const defs = {
  "meta": {
    "projectId": 102017,
    "folder": "petshop",
    "shortName": "organismBlogList",
    "type": "organism",
    "devFidelity": "organismMock",
    "group": "petshop",
    "tags": [
      "lit",
      "organism"
    ]
  },
  "references": {
    "widgets": [],
    "plugins": [],
    "statesRO": [],
    "statesRW": [],
    "statesWO": [],
    "imports": []
  },
  "planning": {
    "generalDescription": "Lista de posts no blog.",
    "goal": "Exibir títulos e resumos de artigos.",
    "userStories": [
      {
        "story": "Como visitante, quero ler dicas sobre pets.",
        "derivedRequirements": [
          {
            "description": "Links para posts completos.",
            "comment": "Para engajamento."
          }
        ]
      }
    ],
    "userRequestsEnhancements": [],
    "constraints": []
  }
}

`;

