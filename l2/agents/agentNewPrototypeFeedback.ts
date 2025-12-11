/// <mls shortName="agentNewPrototypeFeedback" project="102020" enhancement="_100554_enhancementLit" folder="agents" />

import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StateLitElement } from '/_100554_/l2/stateLitElement.js';
import { getPayload3 } from '/_102020_/l2/agents/agentNewPrototype3.js';
import { getPayload4, PayLoad4 } from '/_102020_/l2/agents/agentNewPrototype4.js';
import { selectLevel, openService } from '/_100554_/l2/libCommom.js';

import {
    getAgentStepByAgentName,
} from "/_100554_/l2/aiAgentHelper.js";

/// **collab_i18n_start** 
const message_pt = {
    loading: 'Carregando...',
    agent1Title: 'Agente (1/4)',
    agent1PromptAnalysis: 'Análise do prompt',
    agent1Clarification: 'Clarificação prompt (humano)',

    agent2Title: 'Agente (2/4)',
    agent2RequirementAnalysis: 'Análise de requisitos',
    agent2SecurityAnalysis: 'Análise de segurança',
    agent2Clarification: 'Clarificação prompt (humano)',

    agent3Title: 'Agente (3/4)',
    agent3ModulePlanning: 'Planejamento do módulo',
    agent3InterfacePlanning: 'Planejamento de interface',
    agent3PagePlanning: 'Planejamento de páginas',
    agent3DesignSystem: 'Definição do design system',

    agent4Title: 'Agente (4/4)',
    agent4CreatePages: 'Criação das páginas',
    agent4SeePage: 'Ver página',

    nextStepsTitle: 'Próximos passos',
    nextStepsMessage: 'O protótipo foi criado com sucesso, agora você pode navegar entre as páginas.'
};

const message_en = {
    loading: 'Loading...',
    agent1Title: 'Agent (1/4)',
    agent1PromptAnalysis: 'Prompt analysis',
    agent1Clarification: 'Prompt clarification (human)',

    agent2Title: 'Agent (2/4)',
    agent2RequirementAnalysis: 'Requirements analysis',
    agent2SecurityAnalysis: 'Security analysis',
    agent2Clarification: 'Prompt clarification (human)',

    agent3Title: 'Agent (3/4)',
    agent3ModulePlanning: 'Module planning',
    agent3InterfacePlanning: 'Interface planning',
    agent3PagePlanning: 'Page planning',
    agent3DesignSystem: 'Design system definition',

    agent4Title: 'Agent (4/4)',
    agent4CreatePages: 'Page creation',
    agent4SeePage: 'See page',

    nextStepsTitle: 'Next steps',
    nextStepsMessage: 'The prototype was successfully created, now you can navigate between the pages.'
};

type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = {
    en: message_en,
    pt: message_pt
};
/// **collab_i18n_end**


@customElement('agents--agent-new-prototype-feedback-102020')
export class AgentGeneratePrototypeFeedback100554 extends StateLitElement {

    private msg: MessageType = messages['en'];

    @state() task?: mls.msg.TaskData;

    @state() agent1Running: boolean = false;
    @state() agent1Complete: boolean = false;
    @state() agent1ClarificationPending: boolean = false;
    @state() agent1ClarificationComplete: boolean = false;

    @state() agent2Running: boolean = false;
    @state() agent2Complete: boolean = false;
    @state() agent2ClarificationPending: boolean = false;
    @state() agent2ClarificationComplete: boolean = false;

    @state() agent3Running: boolean = false;
    @state() agent3Complete: boolean = false;

    @state() agent4Running: boolean = false;
    @state() agent4Complete: boolean = false;
    @state() agent4Pages: IPages[] | undefined;

    async firstUpdated(_changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(_changedProperties);
        //this.task = await getTask('20250917143000.1001');
    }

    updated(_changedProperties: Map<PropertyKey, unknown>) {
        super.updated(_changedProperties);
        if (_changedProperties.has('task')) {
            this.prepareState();
        }
    }
    
    render() {
        const lang = this.getMessageKey(messages);
        this.msg = messages[lang];

        return html`
        <section class="feedback-section">
            <h3>${this.msg.agent1Title} ${this.agent1Running ? html`<span class="loader"></span>` : ''}</h3>
            <ul>
                <li>[ ${this.agent1Complete ? 'x' : ''} ] ${this.msg.agent1PromptAnalysis}</li>
                <li>[ ${this.agent1ClarificationComplete ? 'x' : ''} ] ${this.msg.agent1Clarification}</li>
            </ul>

            <h3>${this.msg.agent2Title} ${this.agent2Running ? html`<span class="loader"></span>` : ''}</h3>
            <ul>
                <li>[ ${this.agent2Complete ? 'x' : ''} ] ${this.msg.agent2RequirementAnalysis}</li>
                <li>[ ${this.agent2Complete ? 'x' : ''} ] ${this.msg.agent2SecurityAnalysis}</li>
                <li>[ ${this.agent2ClarificationComplete ? 'x' : ''} ] ${this.msg.agent2Clarification}</li>
            </ul>

            <h3>${this.msg.agent3Title} ${this.agent3Running ? html`<span class="loader"></span>` : ''}</h3>
            <ul>
                <li>[ ${this.agent3Complete ? 'x' : ''} ] ${this.msg.agent3ModulePlanning}</li>
                <li>[ ${this.agent3Complete ? 'x' : ''} ] ${this.msg.agent3InterfacePlanning}</li>
                <li>[ ${this.agent3Complete ? 'x' : ''} ] ${this.msg.agent3PagePlanning}</li>
                <li>[ ${this.agent3Complete ? 'x' : ''} ] ${this.msg.agent3DesignSystem}</li>
            </ul>

            <h3>${this.msg.agent4Title} ${this.agent4Running ? html`<span class="loader"></span>` : ''}</h3>
            <ul>
                <li>[ ${this.agent4Complete ? 'x' : ''} ] ${this.msg.agent4CreatePages}</li>
                <ul>
                    ${this.agent4Pages?.map((page) => {
                        return html`
                        <li>
                            <span>[ ${page.status === 'completed' ? 'x' : ''} ] 
                                  ${page.pageName} 
                                  ${page.status === 'running' ? html`<span class="loader"></span>` : ''} 
                            </span>
                            ${page.status === 'completed' && +(this.task?.iaCompressed?.longMemory.project || '0') === mls.actualProject ? html`
                                <a
                                    href="#"
                                    @click=${(e: MouseEvent) => {
                                        e.preventDefault();
                                        this.openPage(
                                            page.pageName,
                                            this.task?.iaCompressed?.longMemory.project,
                                            this.task?.iaCompressed?.longMemory.module_name
                                        )
                                    }} >
                                    ${this.msg.agent4SeePage}
                                </a>` : ''}
                            <ul>
                                ${page.organism.map((organism) => {
                                    return html`<li>[ x ] ${organism}</li>`
                                })}
                            </ul>
                        </li>`
                    })}
                </ul>
            </ul>

    
            <h3> ${this.msg.nextStepsTitle}</h3>
            <span>${this.msg.nextStepsMessage}</span>
        
        </section>
    `;
    }


    private prepareState() {
        this.prepareAgentGeneratePrototype1();
        this.prepareAgentGeneratePrototype2();
        this.prepareAgentGeneratePrototype3();
        this.prepareAgentGeneratePrototype4();
    }

    private prepareAgentGeneratePrototype1() {
        if (!this.task) return;
        const agent1 = getAgentStepByAgentName(this.task, 'agentGeneratePrototype');
        if (!agent1) return;
        this.agent1Running = agent1.status === 'pending';
        if (agent1.status === 'completed') {
            this.agent1Complete = true;
            const payload1 = agent1.interaction?.payload ? agent1.interaction?.payload[0] : undefined;
            if (payload1) {
                this.agent1ClarificationPending = payload1.status === 'pending';
                this.agent1ClarificationComplete = payload1.status === 'completed';
            }
        }
    }

    private prepareAgentGeneratePrototype2() {
        if (!this.task) return;
        const agent2 = getAgentStepByAgentName(this.task, 'agentGeneratePrototype2');
        if (!agent2) return;
        this.agent2Running = agent2.status === 'pending';
        if (agent2.status === 'completed') {
            this.agent2Complete = true;
            const payload2 = agent2.interaction?.payload ? agent2.interaction?.payload[0] : undefined;
            if (payload2) {
                this.agent2ClarificationPending = payload2.status === 'pending';
                this.agent2ClarificationComplete = payload2.status === 'completed';
            }
        }
    }

    private prepareAgentGeneratePrototype3() {
        if (!this.task) return;
        const agent3 = getAgentStepByAgentName(this.task, 'agentGeneratePrototype3');
        if (!agent3) return;
        this.agent3Running = agent3.status === 'pending';
        if (agent3 && agent3.status === 'completed') {
            this.agent3Complete = true;
            const payload3 = getPayload3({ message: undefined, task: this.task } as any);
            if (!payload3) return;
            this.agent4Pages = payload3.pages.map((page) => {
                const obj: IPages = { index: page.pageSequential, pageName: page.pageName, status: 'pending', organism: [] };
                return obj;
            })
        }

    }

    private async prepareAgentGeneratePrototype4() {
        if (!this.task) return;

        const totalPages = this.agent4Pages?.length;
        const rootSteps = this.task.iaCompressed?.nextSteps || [];
        const allSteps = await this.getAllSteps(rootSteps);
        const allAgents4 = allSteps.filter((agent) => agent.type === 'agent' && agent.agentName === 'agentGeneratePrototype4');

        const allCompleted = allAgents4.every((agent) => agent.status === 'completed');
        const someRunning = allAgents4.some((agent) => agent.status === 'pending');

        this.agent4Running = someRunning;
        if (allCompleted && allAgents4.length === totalPages) {
            this.agent4Complete = true;
        }

        allAgents4.forEach((item, index) => {
            if (!this.agent4Pages || !this.task) return;
            const pageObj = this.agent4Pages[index];
            if (item.status === 'completed') {
                pageObj.status = 'completed';
                pageObj.result = getPayload4(this.task, item.stepId);
                pageObj.organism = pageObj.result.organismToImplement || [];
            }
            if (item.status === 'pending' || item.status === 'in_progress') pageObj.status = 'running';
        });

    }

    private getAllSteps(steps: mls.msg.AIPayload[]): mls.msg.AIPayload[] {
        let result: mls.msg.AIPayload[] = [];

        for (const step of steps) {
            result.push(step);
            if (step.nextSteps && step.nextSteps.length) {
                result = result.concat(this.getAllSteps(step.nextSteps));
            }
            if (step.interaction?.payload && step.interaction.payload.length) {
                for (const payload of step.interaction.payload) {
                    result.push(payload);
                    if (payload.nextSteps && payload.nextSteps.length) {
                        result = result.concat(this.getAllSteps(payload.nextSteps));
                    }
                }
            }
        }
        return result;
    };

    private openPage(shortName: string, project?: string, folder?: string) {
        if (!project || !shortName) return;
        let data: string = '';
        if (folder) {
            data = `_${project}_${folder}/${shortName}`;
            mls.setActualModule(folder);
        } else data = `_${project}_${shortName}`;

        mls.actual[4].setFullName(data);
        selectLevel(4);
        setTimeout(() => {
            openService('_100554_servicePage', 'left', 4);
        }, 100);
    }
}

interface IPages {
    index: number,
    pageName: string;
    status: 'pending' | 'completed' | 'running',
    organism: string[],
    result?: PayLoad4
}

