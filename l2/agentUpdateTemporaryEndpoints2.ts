/// <mls shortName="agentUpdateTemporaryEndpoints2" project="102020" enhancement="_blank" />

import { IAgent, svg_agent } from './_100554_aiAgentBase';
import { getPromptByHtml } from './_100554_aiPrompts';
import { createAllModels } from './_100554_collabLibModel';

import {
    appendLongTermMemory,
    getNextPendingStepByAgentName,
    getNextInProgressStepByAgentName,
    getNextFlexiblePendingStep,
    updateTaskTitle,
    notifyTaskChange,
    updateStepStatus,
    getNextPendentStep
} from "./_100554_aiAgentHelper";

import {
    startNewInteractionInAiTask,
    startNewAiTask,
    executeNextStep,
    addNewStep
} from "./_100554_aiAgentOrchestration";

const agentName = "agentUpdateTemporaryEndpoints2";
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

    const pagesRemaing: mls.cbe.IPath[] = JSON.parse(context.task?.iaCompressed?.longMemory['pages_remaing'] || '[]');
    if (!pagesRemaing || pagesRemaing.length === 0) {
        context.task = await updateTaskTitle(context.task, "Ok, all temporary endepoints created, see result");
        await executeNextStep(context);
        return;
    }

    const stepPendent = getNextPendentStep(context.task);
    if (!stepPendent) throw new Error(`[${agentName}](afterPrompt) Invalid next stepPendent`);

    const newStep: mls.msg.AIPayload = {
        agentName: 'agentUpdateTemporaryEndpoints2',
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

async function initTask(data: IDataMessage, context: mls.msg.ExecutionContext) {

    try {
        const allPages = await getAllPagesInStatusMockup(+data.project, data.modulePath);
        if (!allPages || allPages.length === 0) {
            return;
        }

        const updatedAt = new Date().toISOString()
        const actualPage = allPages.pop();
        if (!actualPage) return;

        const inputs = await getPrompts(context, actualPage as mls.cbe.IPath, data.project, data.modulePath, updatedAt);
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
                'pages_remaing': `${JSON.stringify(allPages)}`
            }
        ).catch((err) => {
            throw new Error(err.message)
        });
    } catch (err: any) {
        throw new Error(err.message)
    }
}


async function continueTask(context: mls.msg.ExecutionContext) {

    if (!context.task) throw new Error(`[${agentName}](continueTask) No task found for this agent.`);
    const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
    const pagesRemaing: mls.cbe.IPath[] = JSON.parse(context.task?.iaCompressed?.longMemory['pages_remaing'] || '[]');
    const project = context.task?.iaCompressed?.longMemory['project'];
    const modulePath = context.task?.iaCompressed?.longMemory['module_path'];
    const updatedAt = context.task?.iaCompressed?.longMemory['update_at'] || new Date().toISOString();
    const actualPage = pagesRemaing.pop();
    await appendLongTermMemory(context, { "pages_remaing": JSON.stringify(pagesRemaing) });

    const inputs = await getPrompts(context, actualPage as mls.cbe.IPath, project, modulePath, updatedAt);
    const taskTitle = `Updating Endpoints`;
    await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);

}


function getParamsFromPrompt(context: mls.msg.ExecutionContext): IDataMessage {
    let messageReplace = context.message.content
        .replace(`@@ ${agentName}`, '')
        .replace(`@@${agentName}`, '').trim()
        .replace(`@@UpdateTemporaryEndpoints2`, '');
    let data: IDataMessage;
    data = mls.common.safeParseArgs(messageReplace) as IDataMessage;
    if (!('modulePath' in data) || !('project' in data)) throw new Error(`[${agentName}] beforePrompt: Invalid prompt structure missing modulePath or project`);

    return data;
}

async function getPrompts(context: mls.msg.ExecutionContext, page: mls.cbe.IPath, moduleProject: string | undefined, modulePath: string | undefined, updatedAt: string): Promise<mls.msg.IAMessageInputType[]> {

    if (context.modeSingleStep) {
        const dataForReplace = {
            typescript: pageTsTest,
            html: pageHtmlTest,
            defs: pageDefsTest,
            moduleEndPoints: moduleEndPointsTest,
            updatedAt
        }
        const prompts = await getPromptByHtml({ project: projectAgent, shortName: agentName, folder: '', data: dataForReplace })
        return prompts;
    }


    const pageData = await getPagesContents(page);
    const moduleDefs = await getModuleDefs(moduleProject, modulePath);
    const dataForReplace = {
        typescript: pageData.ts,
        html: pageData.html,
        defs: pageData.defs,
        moduleEndPoints: moduleDefs,
        updatedAt

    }

    console.info({ dataForReplace, page });
    const prompts = await getPromptByHtml({ project: projectAgent, shortName: agentName, folder: '', data: dataForReplace })

    return prompts;

}

async function updateFile(context: mls.msg.ExecutionContext) {
    if (!context || !context.task) throw new Error(`[${agentName}] updateFile: Not found context`);
    const step = getNextFlexiblePendingStep(context.task);

    if (!step || step.type !== 'flexible') throw new Error(`[${agentName}] updateFile: Invalid step in updateFile`);
    const result: IDataResult = step.result;

    if (!result) throw new Error(`[${agentName}] updateFile: Not found "result"`);

    console.info(result.logs)
    console.info(result.moduleEndPoints);
    console.info(result.organismUsed)

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

async function getPagesContents(page: mls.cbe.IPath) {

    const contentTs = await getContentByExtension(page, 'ts');
    const contentHtml = await getContentByExtension(page, 'html');
    const contentDefs = await getContentByExtension(page, 'defs');

    return {
        ts: typeof contentTs === 'string' ? contentTs : '',
        html: typeof contentHtml === 'string' ? contentHtml : '',
        defs: typeof contentDefs === 'string' ? contentDefs : '',
    }
}

async function getModuleDefs(moduleProject: string | undefined, modulePath: string | undefined,): Promise<string> {
    if (!moduleProject || !modulePath) throw new Error(`[${agentName}] getModuleDefs: Invalid module file.`);
    const content = await getContentByExtension({ folder: modulePath, project: +moduleProject, shortName: 'module' }, 'defs');
    if (typeof content !== 'string') throw new Error(`[${agentName}] getModuleDefs: Invalid typeof module file, must be string.`);
    return content;

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


async function getAllPagesInStatusMockup(project: number, modulePath: string) {

    const allPages: mls.cbe.IPath[] = [];

    for (let key of Object.keys(mls.stor.files)) {
        const storFile = mls.stor.files[key];

        if (storFile.extension !== '.defs.ts' || storFile.project !== project || storFile.folder !== modulePath) continue;

        const keyToImport = storFile.folder ? `_${storFile.project}_${storFile.folder}_${storFile.shortName}` : `./_${storFile.project}_${storFile.shortName}`

        try {
            const module = await import(`./${keyToImport}.defs.js`);
            if (!module) continue;
            const defs = module?.defs;
            if (!defs || defs.meta.type !== 'page' || defs.meta.devFidelity !== 'scaffold') continue;

            allPages.push({
                folder: storFile.folder,
                project: storFile.project,
                shortName: storFile.shortName
            })

        } catch (err) {
            console.error('Error on get defs from page:' + keyToImport)
            continue;
        }

    }

    return allPages;
}


interface IDataMessage {
    project: string,
    modulePath: string
}

interface IDataResult {
    organismUsed: string[],
    moduleEndPoints: string,
    logs: string[],
}


const pageTsTest = `/// <mls shortName="productCatalog" project="102017" folder="petshop" enhancement="_100554_enhancementLit" groupName="petshop" />

import { CollabPageElement } from '_100554_collabPageElement';
import { customElement } from 'lit/decorators.js';
import { globalState, initState, setState } from '_100554_collabState';

@customElement('petshop--product-catalog-102017')
export class PageProductCatalog extends CollabPageElement {
    initPage() {

    }
}`;
const pageHtmlTest = `<petshop--product-catalog-102017
	id='productCatalog-core-petshop--product-catalog-1020171'>
	<header
		id='productCatalog-core-header1'>
		<petshop--organism-nav-102017
			id='productCatalog-nav1'>
		</petshop--organism-nav-102017>
	</header>
	<aside
		id='productCatalog-core-aside1'>
		<petshop--organism-filters-102017
			id='productCatalog-filters1'>
		</petshop--organism-filters-102017>
	</aside>
	<main
		id='productCatalog-core-main1'>
		<petshop--organism-product-list-102017
			id='productCatalog-product-list1'>
		</petshop--organism-product-list-102017>
	</main>
	<footer
		id='productCatalog-core-footer1'>
		<petshop--organism-footer-102017
			id='productCatalog-footer1'>
		</petshop--organism-footer-102017>
	</footer>
</petshop--product-catalog-102017>`;
const pageDefsTest = `/// <mls shortName="productCatalog" project="102017" folder="petshop" groupName="petshop" enhancement="_blank" />

// Do not change – automatically generated code.

export const defs: mls.l4.BaseDefs = {
  "meta": {
    "projectId": 102017,
    "folder": "petshop",
    "shortName": "productCatalog",
    "type": "page",
    "devFidelity": "scaffold",
    "group": "petshop",
    "tags": [
      "lit",
      "page"
    ]
  },
  "references": {
    "widgets": [
      {
        "tag": "organism-nav",
        "bindings": [],
        "purpose": "",
        "used": true
      },
      {
        "tag": "organism-filters",
        "bindings": [],
        "purpose": "",
        "used": true
      },
      {
        "tag": "organism-product-list",
        "bindings": [],
        "purpose": "",
        "used": true
      },
      {
        "tag": "organism-footer",
        "bindings": [],
        "purpose": "",
        "used": true
      }
    ],
    "plugins": [],
    "statesRO": [],
    "statesRW": [],
    "statesWO": [],
    "imports": []
  },
  "planning": {
    "generalDescription": "",
    "goal": "Página para navegar e pesquisar produtos para pets.",
    "userStories": [
      {
        "story": "Como visitante, quero acessar a página \"productCatalog\" para página para navegar e pesquisar produtos para pets.",
        "derivedRequirements": [
          {
            "description": "Exibir lista de produtos com filtros por categoria."
          },
          {
            "description": "Permitir adicionar produtos ao carrinho."
          },
          {
            "description": "Incluir detalhes do produto como preço e descrição."
          }
        ]
      }
    ],
    "userRequestsEnhancements": [],
    "constraints": []
  }
}
`;
const moduleEndPointsTest = `/// <mls shortName="module" project="102017" enhancement="_blank" folder="petshop" />

const temporaryEndpoints = [
  {
    name: "organismServiceSelection",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchServices",
        intent: "I need an endpoint to fetch available services for selection.",
        responseInterfaces: "interface ServicesResponse {\nservices: Service[];\n}\ninterface Service {\nid: string;\nname: string;\ndescription: string;\nprice: string;\niconUrl: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismServiceHighlights",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchHighlightedServices",                                                                  
        intent: "I need an endpoint to fetch the list of highlighted services.",
        responseInterfaces: "interface ServicesResponse {\nservices: Service[];\n}\ninterface Service {\nname: string;\ndescription: string;\nimageUrl: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismRewardsList",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchRewards",
        intent: "I need an endpoint to fetch available rewards for redemption.",
        responseInterfaces: "interface Reward {\nid: string;\nimageUrl: string;\naltText: string;\ntitle: string;\ncost: number;\n}\ninterface RewardsResponse {\nrewards: Reward[];\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismRedeemForm",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchRedeemData",
        intent: "I need an endpoint to fetch available rewards and user balance.",
        responseInterfaces: "interface RedeemResponse {\nrewards: Array<{ id: string; name: string; points: number }>;\nuserBalance: number;\n}",
        requestInterfaces: ""
      },
      {
        name: "redeemReward",
        intent: "I need an endpoint to process reward redemption.",
        responseInterfaces: "",
        requestInterfaces: "interface RedeemRequest {\nrewardId: string;\n}"
      }
    ],
    actions: []
  },
  {
    name: "organismProductList",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchProducts",
        intent: "I need an endpoint to fetch the list of products.",
        responseInterfaces: "interface ProductsResponse {\nproducts: Product[];\n}\ninterface Product {\nid: number;\nname: string;\nprice: string;\nimage: string;\nalt: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismProductCategories",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchProductCategories",
        intent: "I need an endpoint to fetch product categories.",
        responseInterfaces: "interface CategoriesResponse {\n categories: Category[];\n}\ninterface Category {\n id: number;\n name: string;\n imageUrl: string;\n alt: string;\n link: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismPointsBalance",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchPointsBalance",
        intent: "I need an endpoint to fetch the user's loyalty points balance.",
        responseInterfaces: "interface PointsResponse {\npoints: number;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismNav",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchNavData",
        intent: "I need an endpoint to fetch navigation data for the petshop site.",
        responseInterfaces: "interface NavData {\nlogo: string;\nmenuItems: { icon: string; text: string; href: string }[];\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismManageProducts",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchProducts",
        intent: "I need an endpoint to fetch the list of products.",
        responseInterfaces: "interface ProductsResponse {\nproducts: Product[];\n}\ninterface Product {\nid: number;\nname: string;\ncategory: string;\nprice: number;\nstock: number;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismFooter",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchFooter",
        intent: "I need an endpoint to fetch footer content.",
        responseInterfaces: "interface FooterResponse {\ncontact: {\nphone: string;\nemail: string;\naddress: string;\n};\nusefulLinks: Array<{ text: string; href: string }>;\nsocialNetworks: Array<{ icon: string; href: string }>;\ncopyright: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismFilters",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchFilters",
        intent: "I need an endpoint to fetch available filter options for products.",
        responseInterfaces: "interface AppliedFilters {\ncategory: string;\nminPrice: number;\nmaxPrice: number;\n}",
        requestInterfaces: ""
      },
      {
        name: "applyFilters",
        intent: "I need an endpoint to apply filters and retrieve filtered products.",
        responseInterfaces: "interface AppliedFilters {\ncategory: string;\nminPrice: number;\nmaxPrice: number;\n}",
        requestInterfaces: "interface AppliedFilters {\ncategory: string;\nminPrice: number;\nmaxPrice: number;\n}"
      }
    ],
    actions: []
  },
  {
    name: "organismDashboardStats",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchDashboardStats",
        intent: "I need an endpoint to fetch dashboard statistics.",
        responseInterfaces: "interface StatsResponse {\ntotalSales: number;\ntodayAppointments: number;\nactiveClients: number;\nstockProducts: number;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismConfirmation",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchAppointmentDetails",
        intent: "I need an endpoint to fetch the current appointment details for confirmation.",
        responseInterfaces: "interface AppointmentResponse {\nservice: string;\ndate: string;\ntime: string;\nprice: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismCalendar",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchAvailability",
        intent: "I need an endpoint to fetch available dates and times for scheduling.",
        responseInterfaces: "interface AvailabilityResponse {\ndates: number[];\ntimes: string[];\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismBlogPost",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchBlogPost",
        intent: "I need an endpoint to fetch the blog post content.",
        responseInterfaces: "interface BlogPostResponse {\ntitle: string;\nmeta: string;\nimageUrl: string;\nimageAlt: string;\ncontent: {\nintro: string;\nnutrition: { title: string; text: string; };\nexercise: { title: string; text: string; };\ncare: { title: string; text: string; };\nreminder: string;\n};\nshareButtons: {\nfacebook: string;\ntwitter: string;\nwhatsapp: string;\n};\ncomments: Array<{ author: string; text: string; }>;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismBlogList",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchBlogPosts",
        intent: "I need an endpoint to fetch the list of blog posts.",
        responseInterfaces: "interface BlogPost {\nid: string;\nimageUrl: string;\naltText: string;\ntitle: string;\nsummary: string;\n}\ntype ContentResponse = BlogPost[];",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismBanner",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchBannerContent",
        intent: "I need an endpoint to fetch the banner content.",
        responseInterfaces: "interface ContentResponse {\nbannerUrl: string;\ntitle: string;\nsubtitle: string;\nctaText: string;\nctaLink: string;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  },
  {
    name: "organismAdminMenu",
    pages: [],
    updatedAt: "2025-11-14",
    endpoints: [
      {
        name: "fetchAdminMenu",
        intent: "I need an endpoint to fetch the admin menu items based on user permissions.",
        responseInterfaces: "interface AdminMenuResponse {\nitems: MenuItem[];\n}\ninterface MenuItem {\nid: number;\nlabelKey: string;\nhref: string;\nvisible: boolean;\n}",
        requestInterfaces: ""
      }
    ],
    actions: []
  }
];`


