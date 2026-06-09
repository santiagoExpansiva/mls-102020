/// <mls fileReference="_102020_/l2/agentMaterializeSolution/materializeOrchestrator.ts" enhancement="_blank"/>

import { getMaterializeIndex } from '/_102027_/l2/defsAST.js'
import { collabImport } from '/_102027_/l2/collabImport.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { createModelAnyFile } from '/_102027_/l2/libModel.js';

const cacheMaterializeOrchestrator = new Map<string, MaterializeOrchestrator>();
const buildCache = new Map<string, Record<string, any>>();
let esbuildReady: Promise<void> | null = null;

export function getMaterializeOrchestrator(defPath: string): MaterializeOrchestrator {
    if (!cacheMaterializeOrchestrator.has(defPath)) {
        const orchestrator = new MaterializeOrchestrator(defPath);
        orchestrator.onAllCompleted = () => {
            console.info('kill path:' + defPath);
            cacheMaterializeOrchestrator.delete(defPath);
            buildCache.delete(defPath);
        };
        cacheMaterializeOrchestrator.set(defPath, orchestrator);
    }
    return cacheMaterializeOrchestrator.get(defPath)!;
}



async function getEsbuild() {
    const url = 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.4/esm/browser.js'
    const esbuild = await import(url);
    if (!esbuildReady) {
        esbuildReady = esbuild.initialize({
            wasmURL: 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.4/esbuild.wasm',
        });
    }
    await esbuildReady;
    return esbuild;
}

export class MaterializeOrchestrator {

    private jsonPath: string;
    private items: mls.defs.MaterializeEntry[];
    private completedIds: Set<string>;
    public onAllCompleted: (() => void) | null;

    constructor(jsonPath: string) {
        this.jsonPath = jsonPath;
        this.items = [];
        this.completedIds = new Set<string>();
        this.onAllCompleted = null;
    }

    async loadItems(): Promise<void> {

        const sfInfo = await mls.stor.convertFileReferenceToFile(this.jsonPath);
        if (!sfInfo) return;

        const key = mls.stor.getKeyToFile(sfInfo);
        const sf = mls.stor.files[key];
        if (!sf) return;

        const data = await sf.getContent() as string;
        this.items = getMaterializeIndex(data);
    }

    public async getToExecuteOnlyMaterialize(id: string): Promise<mls.defs.MaterializeEntry | undefined> {

        if (!this.items.length) await this.loadItems();
        const item = this.items.find((i) => i.id === id);
        if (item) item.dependsOn = [];
        return item;

    }

    isAllCompleted(): boolean {
        return (
            this.items.length > 0 &&
            this.items.every((item) => this.completedIds.has(item.id))
        );
    }

    async process(trigger: OrchestratorTrigger): Promise<mls.defs.MaterializeEntry[]> {
        if (!this.items.length) await this.loadItems();

        if (trigger === 'init') {
            return this.items.filter((item) => item.dependsOn.length === 0);
        }

        this.completedIds.add(trigger);

        if (this.isAllCompleted()) {
            this.onAllCompleted?.();
            return [];
        }

        return this.items.filter((item) => {
            if (!item.dependsOn.includes(trigger)) return false;
            if (this.completedIds.has(item.id)) return false;
            if (item.dependsOn.length === 0) return false;
            return item.dependsOn.every((dep) => this.completedIds.has(dep));
        });
    }

    getStatus(): OrchestratorStatus {
        return {
            total: this.items.length,
            completed: this.completedIds.size,
            pending: this.items.length - this.completedIds.size,
            completedIds: [...this.completedIds],
            pendingIds: this.items
                .filter((item) => !this.completedIds.has(item.id))
                .map((item) => item.id),
            isAllCompleted: this.isAllCompleted(),
        };
    }

    reset(): void {
        this.completedIds.clear();
    }

    public async getSkill(path: string): Promise<string> {

        let module: any;
        if (path.startsWith('/')) path = path.slice(1);
        const f = mls.stor.convertFileReferenceToFile(path);
        if (!f) return '';

        try {

            module = await collabImport(f as any);

        } catch (err) {
            module = await this.getModuleByBuild(path);
        }

        if (!module) {
            console.info(`[getSkill]Módulo não registrado: ${path}`);
            return '';
        }

        let src = module.skill;
        return await this.processTemplate(src);
    }

    private async processTemplate(input: string): Promise<string> {
        const regex = /\[\[\((.*?)\)(?:\.(.*?))?\]\]/g;

        let result = input;

        const matches = [...input.matchAll(regex)];

        for (const match of matches) {
            const fullMatch = match[0];
            const filePath = match[1];
            const expression = match[2];

            if (!expression) {

                const f = mls.stor.convertFileReferenceToFile(filePath);
                if (!f) continue;

                const key = mls.stor.getKeyToFile(f);
                const sf = mls.stor.files[key];

                if (!sf) continue;
                let replacement = await sf.getContent() as string;
                result = result.replace(fullMatch, JSON.stringify(replacement));


            } else {

                const isFunction = expression.endsWith("()");
                const exportName = isFunction
                    ? expression.replace("()", "")
                    : expression;

                try {
                    const f = mls.stor.convertFileReferenceToFile(filePath);
                    if (!f) continue;
                    let module: any;

                    try {
                        module = await collabImport(f as any);
                    } catch (e) { }

                    if (!module || !(exportName in module)) {
                        module = await this.getModuleByBuild(filePath);

                        if (!module || !(exportName in module)) {
                            throw new Error(`Módulo não registrado: ${filePath} var:${exportName}`);
                        }

                    }

                    let replacement;

                    if (isFunction) {
                        replacement = await module[exportName]();
                    } else {
                        replacement = module[exportName];
                    }

                    if (typeof replacement === "object") {
                        result = result.replace(fullMatch, JSON.stringify(replacement));
                    } else {
                        result = result.replace(fullMatch, String(replacement));
                    }



                } catch (err) {
                    console.error(`Erro em ${fullMatch}`, err);
                }

            }

        }

        return result;
    }

    async getModuleByBuild(path: string) {

        console.info('Needed esbuild processTemplate:' + path);

        const f = mls.stor.convertFileReferenceToFile(path);
        if (!f) return null;

        const key = mls.stor.getKeyToFile(f);
        const sf = mls.stor.files[key];
        if (!sf) return null;

        const src = await sf.getContent() as string;

        const esbuild = await getEsbuild();
        const result = await esbuild.transform(src, {
            loader: 'ts',
            format: 'esm',
            target: 'esnext',
        });

        const blob = new Blob([result.code], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        try {
            const mod = await import(blobUrl);

            return mod;
        } finally {

        }
    }


    async processGroup(trigger: OrchestratorTrigger): Promise<GroupedByAgent> {
        if (!this.items.length) await this.loadItems();

        if (trigger === 'init') {
            return this.groupByAgent(this.items.filter((item) => item.dependsOn.length === 0));
        }

        this.completedIds.add(trigger);

        if (this.isAllCompleted()) {
            this.onAllCompleted?.();
            return {};
        }

        return this.groupByAgent(this.items.filter((item) => {
            if (!item.dependsOn.includes(trigger)) return false;
            if (this.completedIds.has(item.id)) return false;
            if (item.dependsOn.length === 0) return false;
            return item.dependsOn.every((dep) => this.completedIds.has(dep));
        }));
    }


    public groupByAgent(tasks: mls.defs.MaterializeEntry[]): GroupedByAgent {
        return tasks.reduce((acc, task) => {
            if (!acc[task.agent]) acc[task.agent] = [];
            acc[task.agent].push(task);
            return acc;
        }, {} as GroupedByAgent);
    }

    public async getVarOld(path: string, variable: string): Promise<string> {

        try {
            const f = mls.stor.convertFileReferenceToFile(path);
            if (!f) return '';

            let module: any;
            try {
                module = await collabImport(f as any);
            } catch (e) { 
                module = await this.getModuleByBuild(path);
            }

            if (!module) {
                console.info(`Módulo não registrado: ${path}`);
                return '';
            }

            if (!module[variable]) {
                console.info(`Variable não registrado: ${path}; ${variable}`);
                return '';
            }


            let result = module[variable];

            if (typeof result === 'object') {
                return JSON.stringify(result);
            }

            return await this.processTemplate(result);

        } catch (err) {
            console.error(`Erro em ${path}`, err);
            return '';
        }

    }

    public async createStorFile(fileRef: string, src: string): Promise<mls.stor.IFileInfo> {

        if (!fileRef.startsWith('_')) fileRef = `_${mls.actualProject || 0}_${fileRef}`;

        const info = mls.stor.convertFileReferenceToFile(fileRef);

        const k = mls.stor.getKeyToFile(info);

        let sf = mls.stor.files[k];

        if (!sf) {
            const param: IReqCreateStorFile = {
                ...info,
                source: src
            }

            sf = await createStorFile(param, false, false, false);

        } else {

            if (!['.ts', '.less', '.defs.ts', '.test.ts'].includes(sf.extension)) {

                const m = await createModelAnyFile(sf);
                if (m && m.model) m.model.setValue(src);

            } else {

                const m = await sf.getOrCreateModel();
                if (m && m.model) m.model.setValue(src);
            }
        }

        return sf;

    }




    public async getVar(path: string, variable: string): Promise<string> {
        try {
            const f = mls.stor.convertFileReferenceToFile(path);
            if (!f) return '';

            let module: any;
            try {
                module = await collabImport(f as any);
            } catch (e) { 
                module = await this.getModuleByBuild(path);
            }

            if (module && variable in module) {
                const result = module[variable];
                if (typeof result === 'object') return JSON.stringify(result);
                return await this.processTemplate(result);
            }

            // Módulo não tinha a variável — tenta buildar via esbuild
            const built = await this.buildAndExtract(path, variable);
            console.info(built);
            if (built !== null) return built;

            throw new Error(`[getVar] Not found variable after build: ${path}; ${variable}`);

        } catch (err) {
            console.error(`Erro em ${path}`, err);
            return '';
        }
    }

    private async buildAndExtract(path: string, variable: string): Promise<string | null> {
        try {
            // Retorna do cache se já foi buildado
            if (buildCache.has(path)) {
                const cached = buildCache.get(path)!;
                if (variable in cached) {
                    const value = cached[variable];
                    if (typeof value === 'object') return JSON.stringify(value);
                    return await this.processTemplate(String(value));
                }
                // Arquivo já foi buildado mas não tem a variável — não tenta de novo
                console.warn(`[buildAndExtract] Variável não encontrada no cache: ${path}; ${variable}`);
                return null;
            }

            const f = mls.stor.convertFileReferenceToFile(path);
            if (!f) return null;

            const key = mls.stor.getKeyToFile(f);
            const sf = mls.stor.files[key];
            if (!sf) return null;

            const src = await sf.getContent() as string;

            console.info('Needed esbuild:' + path);
            const esbuild = await getEsbuild();

            const result = await esbuild.transform(src, {
                loader: 'ts',
                format: 'esm',
                target: 'esnext',
            });

            const blob = new Blob([result.code], { type: 'text/javascript' });
            const blobUrl = URL.createObjectURL(blob);

            try {
                const mod = await import(blobUrl);

                // Salva o módulo inteiro no cache — não só a variável pedida
                buildCache.set(path, mod);

                if (variable in mod) {
                    const value = mod[variable];
                    if (typeof value === 'object') return JSON.stringify(value);
                    return await this.processTemplate(String(value));
                }
                return null;
            } finally {
                URL.revokeObjectURL(blobUrl);
            }

        } catch (err) {
            console.error(`[buildAndExtract] Erro ao buildar ${path}`, err);
            return null;
        }
    }

}

export interface OrchestratorStatus {
    total: number;
    completed: number;
    pending: number;
    completedIds: string[];
    pendingIds: string[];
    isAllCompleted: boolean;
}



type GroupedByAgent = Record<string, mls.defs.MaterializeEntry[]>;

export type OrchestratorTrigger = 'init' | string;