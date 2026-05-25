/// <mls fileReference="_102020_/l2/servicePreview.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { globalState, setState, initState, getState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { getPath } from '/_102027_/l2/utils.js';
import { convertFileToTag } from '/_102020_/l2/utils.js';
import { getTokensCss, getTokensLess, removeTokensFromSource } from '/_102027_/l2/designSystemBase.js';
import { getConfigProject } from '/_102027_/l2/libProjectConfig.js';
import { getLastOpenedFiles, } from '/_102027_/l2/libCommom.js';
import { compileStyleUsingStorFile } from '/_102027_/l2/libCompileStyle.js';
import { createModel } from '/_102027_/l2/libModel.js';

import { createThread, getUserId } from '/_102025_/l2/collabMessagesHelper.js';
import { getThreadByName } from '/_102025_/l2/collabMessagesIndexedDB.js';
import { loadAgent, executeBeforePrompt } from '/_102027_/l2/aiAgentOrchestration.js';
import { getTemporaryContext } from '/_102027_/l2/aiAgentHelper.js';

import { getDependenciesByHtml } from '/_102020_/l2/buildFile.js';

import '/_102025_/l2/collabMessagesPrompt.js';

import '/_102027_/l2/collabSpliterVerticalVarFixed.js';
import '/_102027_/l2/collabSpliterHorizontalVarFixed.js';

import { PreviewModeAura } from '/_102020_/l2/previewModeAura.js';
import { IJSONDependence } from '/_102027_/l2/libCompile.js';
import { OpenedFileL2 } from '/_102027_/l2/libCommom.js';
import { ServiceBase, IService, IToolbarContent, IServiceMenu, IOptions } from '/_102027_/l2/serviceBase.js';


/// **collab_i18n_start**
const message_pt = {
  loading: 'Carregando preview...',
  promptPlaceholder: 'Digite aqui @@ para agentes',
  dark: ' escuro',
  light: 'claro',
  pause: 'Preview pausado',
  run: 'Preview executando',
}

const message_en = {
  loading: 'Loading preview...',
  promptPlaceholder: 'Type here @@ for agents',
  pause: 'Preview paused',
  run: 'Preview running',
  dark: 'dark',
  light: 'light',
}

type MessageType = typeof message_en;

const messages: { [key: string]: MessageType } = {
  'en': message_en,
  'pt': message_pt
}
/// **collab_i18n_end**

@customElement('service-preview-102020')
export class ServicePreview extends ServiceBase {

  private msg: MessageType = messages['en'];
  private languages: ILanguage = {};
  private tasksInProgress: Map<string, Set<mls.msg.ExecutionContext>> = new Map();
  private monacoEditor: HTMLElement | undefined;
  private _ed1: monaco.editor.IStandaloneCodeEditor | undefined;
  private threadCache = new Map<string, Promise<mls.msg.ThreadPerformanceCache | undefined>>();

  @query('iframe') elPreview: HTMLIFrameElement | undefined;

  @property() modePreview: PreviewMode = 'Desktop';
  @property({ type: Boolean }) watch: boolean = true;
  @property({ type: Boolean }) light: boolean = true;
  @property() msize: string = '';
  @property() lang: string = 'en';

  @state() actualFiles: mls.stor.IInfo | undefined;
  @state() actualModels: mls.editor.IModels = { defs: undefined, html: undefined, style: undefined, test: undefined, ts: undefined };
  @state() actualTheme: string = 'Default';

  @state() project: number = 0;
  @state() shortName: string = '';
  @state() folder: string = '';

  @state() hasErrorLess: boolean = false;

  get page(): string {
    return `_${this.project}_${this.folder ? this.folder + '/' : ''}${this.shortName}`;
  }

  get confE() { return `l${this.level}_${this.position}`; }

  get isL3(): boolean { return this.level === 3; }
  get isL4(): boolean { return this.level === 4; }

  constructor() {
    super();
    (window as any).preview = {
      editor: undefined,
      iframe: undefined,
      refresh: undefined
    };
    this.initStatesPreview();
    this.initStatesPreviewL3();
    this.initStatesPreviewL4();
  }

  public details: IService = {
    icon: '&#xf06e',
    state: 'foreground',
    position: 'right',
    tooltip: 'Aura Preview',
    visible: true,
    widget: '_102020_servicePreview',
    level: [2, 3, 4]
  }

  public onClickMain(op: string): void {
    if (this.menu.setMode) this.menu.setMode('initial');
  }

  public onClickTabs(index: number) {

    if (index === PreviewType.Desktop) {
      this.modePreview = 'Desktop';
    }
    if (index === PreviewType.Mobile) {
      this.modePreview = 'Mobile';
    }

    this.modePreview = PreviewType[index] as PreviewMode;
    this.updatePreviewMode();
  }


  public onClickTools(op: string) {

    if (op === 'watchPreview') this.toogleWatch();
    else if (op === 'languages') this.onChangeLanguage();
    else if (op === 'darkLight') this.toggleDarkLight();
  }


  public menu: IServiceMenu = {
    title: 'Example',
    main: {},
    tools: {
      darkLight: {
        type: 'cycle',
        selected: 0,
        options: [
          { text: this.msg.light, icon: 'f185' },
          { text: this.msg.dark, icon: 'f186' },
        ]
      },
      languages: {
        type: 'dropdown',
        selected: 0,
        options: []
      },
      watchPreview: {
        type: 'cycle',
        selected: 0,
        options: [
          { text: this.msg.run, icon: 'f04c' },
          { text: this.msg.pause, icon: 'f04b' },
        ]
      },
    },
    tabs: {
      group: 'Mode',
      type: 'full',
      selected: 0,
      options: [
        { text: 'Desktop', icon: 'f390' },
        { text: 'Mobile', icon: 'f3cf' },
      ]
    },
    onClickMain: this.onClickMain.bind(this),
    onClickTabs: this.onClickTabs.bind(this),
    onClickTools: this.onClickTools.bind(this),
  }

  async onServiceClick(visible: boolean, reinit: boolean, el: IToolbarContent | null) {

    if (visible) {
      await this.setActualFileInfos();
      this.createPreview();
    }

  }

  private setEvents() {
    mls.events.addEventListener([this.level], ['FileAction'], this.onFileAction.bind(this));
    mls.events.addEventListener([this.level], ['styleChanged' as any], this.onStyleChanged.bind(this));
  }

  handleIcaStateChange(key: string, value: any) {
    if (key === 'preview.language') {
      this.changeLanguagePreview(value);
    }
    if (key === 'preview.file') {
      console.info(value);
      this.changeFilePreview(value)
    }
  }

  private initStatesPreview() {
    const pendingReselect = getState('preview.pendingReselect')
    initState('preview', { pausePreview: !this.watch, service: this, language: this.lang, pendingReselect });
  }

  private initStatesPreviewL3() {
    initState('previewL3', {
      selectedElement: null,       // selector do elemento selecionado
      selectedTagName: '',
      selectedAttributes: {},
      selectedStyles: {},
      selectedRect: null,
      breadcrumb: [],
      editMode: 'select',          // 'select' | 'text' | 'drag' | 'inspect'
      hoveredElement: null,
      panelVisible: true,
    });
  }

  private initStatesPreviewL4() {
    initState('previewL4', {
      selectedElement: null,
      selectedTagName: '',
      selectedAttributes: {},
      selectedStyles: {},
      selectedRect: null,
      breadcrumb: [],
      editMode: 'select',
      hoveredElement: null,
      panelVisible: true,
    });
  }

  // Implementations

  private toogleWatch() {
    this.watch = this.menu.tools.watchPreview.selected === 0;
    if (this.watch) {
      this.createPreview();
    }
  }

  private toggleDarkLight() {
    this.light = !this.light;
    if (!mls.actual[this.level].left || !this.watch) return this.light;

    const htmlEl: HTMLHtmlElement | undefined = this.getIframePreviewHTML();
    if (htmlEl) {
      if (this.light) {
        htmlEl.removeAttribute('data-theme');
        htmlEl.classList.remove('dark');
      } else {
        htmlEl.setAttribute('data-theme', 'dark');
        htmlEl.classList.add('dark');
      }
    }

    this.onStyleChanged();
    return this.light;
  }

  private async changeFilePreview(file: mls.stor.IFileInfo) {
    const { project, shortName, folder } = file;

    if (this.actualFiles &&
      this.actualFiles.ts &&
      this.actualFiles.ts.folder === folder &&
      this.actualFiles.ts.project === project &&
      this.actualFiles.ts.shortName === shortName
    ) return;

    await this.setActualFiles(project, shortName, folder)
    setState('preview.pausePreview', false);
    if (!this.watch && this.menu.selectTool) this.menu.selectTool('watchPreview');
    this.createPreview();
  }

  private async changeLanguagePreview(lang: string) {

    const hasLang = Object.values(this.languages).findIndex((item) => item.acronym === lang);

    if (hasLang === -1) {
      await this.setLanguages();
    }
    const htmlEl: HTMLHtmlElement | undefined = this.getIframePreviewHTML();
    if (htmlEl) htmlEl.lang = lang;
    this.lang = lang;
    const variation = Object.values(this.languages).findIndex((item) => item.acronym === lang)
    globalState.globalVariation = !isNaN(variation) ? variation : 0;
    this.menu.tools.languages.selected = variation;
    if (this.menu.refresh) this.menu.refresh('tools');
    if (window.top) (window.top.window as any).globalVariation = !isNaN(variation) ? variation : 0;
    this.createPreview();

  }


  private onChangeLanguage() {

    if (this.menu.tools.languages.selected === undefined) return;
    const opMenu = this.menu.tools.languages.options[this.menu.tools.languages.selected as number].text;
    const lang = this.languages[opMenu].acronym;
    setState('preview.language', lang);

    return true;
  }

  private getIframePreviewHTML(): HTMLHtmlElement | undefined {
    if (!(window as any).preview.iframe) throw new Error('Preview not created yet');
    const htmlEl = (window as any).preview.iframe
      ?.contentDocument
      ?.querySelector('html') as HTMLHtmlElement;
    return htmlEl;
  }

  private onStyleChanged() {

    if (!this.actualFiles || !this.actualFiles.ts || !this.actualFiles.less || !this.watch) return;

    if (!this.actualFiles.less.hasError && this.hasErrorLess) {
      this.updateLoadingToFalseIfNoTasksRunning();
      this.createPreview();
      this.hasErrorLess = false;
    }
    else if (this.actualFiles.less.hasError) this.hasErrorLess = true;

    this.addStyles();

  }

  private onFileAction(ev: mls.events.IEvent) {


    if (![2, 3, 4].includes(ev.level) || (ev.type !== 'FileAction') || !ev.desc) return;
    const fileAction = JSON.parse(ev.desc) as mls.events.IFileAction;
    const eventsValid = ['open', 'openBackground', 'statusOrErrorChanged', 'changed', 'new', 'modeCreated', 'editorChanged', 'openLink', 'editorEvents'];

    try {
      if (fileAction.position === this.position || !eventsValid.includes(fileAction.action)) return;

      if (fileAction.action === 'open' || (fileAction.action as any) === 'openBackground') {
        setState('preview.pausePreview', false);
        if (!this.watch && this.menu.selectTool) this.menu.selectTool('watchPreview');
      }

      if (fileAction.action as any === 'open') {
        this.createPreview();
        return;
      }

      if (this.menu && this.menu.closeMenu) this.menu.closeMenu();
      const rp = getState('preview.pausePreview');
      if (this.watch && !rp) {
        this.createPreview();
      }


    } catch (e) {
      console.info(e);
    }

  }


  private async setActualFileInfos() {

    this.setLastOpenedFile();
    if (!mls.actual[this.level].left) return;
    const { project, shortName, folder } = mls.actual[this.level].left as mls.stor.IFileInfo;
    this.project = project;
    this.shortName = shortName;
    this.folder = folder;

    await this.setActualFiles(project, shortName, folder);
    await this.setActualModels();


  }

  private setLastOpenedFile() {
    if (!mls.actual[this.level].left) {

      // L3/L4: fallback para o arquivo aberto no L2
      if ((this.isL3 || this.isL4) && mls.actual[2]?.left) {
        const l2Info = mls.actual[2].left as mls.stor.IFileInfo;
        mls.actual[this.level].setFullName(`_${l2Info.project}_/l2/${l2Info.folder ? l2Info.folder + '/' : ''}${l2Info.shortName}`);
        return;
      }

      const lastFileOpened = getLastOpenedFiles(mls.actualProject || 0);

      // Tenta o level atual, senão fallback pro L2
      const levelKey = String(this.level);
      const fallbackKey = (this.isL3 || this.isL4) ? '2' : levelKey;
      let targetKey = levelKey;

      if (!lastFileOpened || !lastFileOpened[targetKey as any]) {
        if ((this.isL3 || this.isL4) && lastFileOpened && lastFileOpened[fallbackKey as any]) {
          targetKey = fallbackKey;
        } else {
          this.clearPreview();
          return;
        }
      }

      const lastFileLeft = (lastFileOpened[targetKey as any] as OpenedFileL2).left;
      if (!lastFileLeft) {
        this.clearPreview();
        return;
      }

      mls.actual[this.level].setFullName(lastFileLeft);
      const infoLast = getPath(lastFileLeft);
      if (!infoLast) throw new Error('[servicePreview] Not found path:' + lastFileLeft);

      const key = mls.stor.getKeyToFiles(infoLast.project, this.level, infoLast.shortName, infoLast.folder, '.ts');
      const file = mls.stor.files[key];
      if (!file) {
        // L3/L4: tenta buscar o file no level 2
        if (this.isL3 || this.isL4) {
          const keyL2 = mls.stor.getKeyToFiles(infoLast.project, 2, infoLast.shortName, infoLast.folder, '.ts');
          const fileL2 = mls.stor.files[keyL2];
          if (!fileL2) {
            this.clearPreview();
            return;
          }
        } else {
          this.clearPreview();
          return;
        }
      }

    }
  }

  private async setActualFiles(project: number, shortName: string, folder: string) {
    const storLevel = (this.isL3 || this.isL4) ? 2 : this.level;
    const files = await mls.stor.getFiles({
      folder,
      project,
      shortName,
      loadContent: true,
      level: storLevel
    });
    this.actualFiles = { ...files };
  }

  private async setActualModels() {
    if (!this.actualFiles) return;

    if (!this.actualModels.ts && this.actualFiles.ts) {
      this.actualModels.ts = await this.actualFiles.ts.getOrCreateModel();
    }

    if (!this.actualModels?.html && this.actualFiles.html) {
      this.actualModels.html = await this.actualFiles.html.getOrCreateModel();
    }

    if (!this.actualModels?.style && this.actualFiles.less) {
      this.actualModels.style = await this.actualFiles.less.getOrCreateModel();
      let src = this.actualModels.style.model.getValue();
      const lessTokens = await getTokensLess(this.actualFiles.less.project, 'Default');
      const lineTokens = `\n\n//Start Less Tokens\n${lessTokens}\n//End Less Tokens\n`;
      src = removeTokensFromSource(src);
      src = src.trim().concat(lineTokens);
      this.actualModels.style.model.setValue(src);
    }

  }

  private createPreview() {

    this.initStatesPreview();
    this.initStatesPreviewL3();
    this.clearPreview();

    const container = this.querySelector('#preview-container') as HTMLElement;
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.classList.add('preview-wrapper');
    wrapper.classList.add(this.modePreview === 'Mobile' ? 'preview-mobile' : 'preview-desktop');

    const iframe = document.createElement('iframe');
    iframe.classList.add('preview-iframe');
    iframe.src = '/_102020_servicePreview';

    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    wrapper.appendChild(iframe);
    container.appendChild(wrapper);

    (window as any).preview.iframe = iframe;

    iframe.addEventListener('load', async () => {

      await this.writePreviewContent(iframe);
      this.loading = false;

      // Apply current dark/light state and language to the new iframe
      const htmlEl = iframe.contentDocument?.querySelector('html');
      if (htmlEl) {
        htmlEl.lang = this.lang;
        if (!this.light) {
          htmlEl.setAttribute('data-theme', 'dark');
          htmlEl.classList.add('dark');
        }
      }

    });

    this.configureTools(true);
    this.loading = true;
    if (this.actualFiles && this.actualFiles.html) this.setModel(this.actualFiles.html);

  }

  private async writePreviewContent(iframe: HTMLIFrameElement) {

    await this.setActualFileInfos();

    if (!this.actualFiles || !this.actualFiles.html) throw new Error('No find html file');
    if (!this.actualFiles || !this.actualFiles.htmlContent) throw new Error('No find html file content');

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const domVirtual = document.createElement('div');
      domVirtual.innerHTML = this.actualFiles.htmlContent;

      if (this.isL3) {
        // L3: wrapa no component editor - toda lógica L3 fica no widget
        doc.body.innerHTML = `
          <preview-editor-l3-102020>
            ${domVirtual.innerHTML}
          </preview-editor-l3-102020>
        `;
      } else if (this.isL4) {
        // L4: wrapa no component editor L4
        doc.body.innerHTML = `
          <preview-editor-l4-102020>
            ${domVirtual.innerHTML}
          </preview-editor-l4-102020>
        `;
      } else {
        // L2: conteúdo direto
        doc.body.innerHTML = domVirtual.innerHTML;
      }

      let ret = await getDependenciesByHtml(this.actualFiles.html, this.actualFiles.htmlContent, this.actualTheme, true);
      await this.modeSinglePage(ret, iframe);

    } catch (e) {
      console.error('Error writing preview content:', e);
    }
  }

  private async modeSinglePage(json: IJSONDependence, iframe: HTMLIFrameElement) {
    if (!this.actualFiles || !this.actualFiles.html) return;
    const c = new PreviewModeAura(json, iframe, String(this.level), false, this.actualFiles.html, this.actualModels);
    await c.init();
  }

  private updatePreviewMode() {

    if (!this.elPreview) return;
    const wrapper = this.querySelector('.preview-wrapper') as HTMLElement;
    if (!wrapper) {
      this.createPreview();
      return;
    }

    wrapper.classList.remove('preview-desktop', 'preview-mobile');
    wrapper.classList.add(this.modePreview === 'Mobile' ? 'preview-mobile' : 'preview-desktop');
  }

  private clearPreview() {

    const container = this.querySelector('#preview-container') as HTMLElement;
    if (!container) return;
    if ((window as any).preview &&
      (window as any).preview.iframe &&
      (window as any).preview.iframe.contentDocument
    ) {
      (window as any).preview.iframe.contentDocument.body.innerHTML = '';
    }
    container.innerHTML = '';
    (window as any).preview.iframe = undefined;
    this.configureTools(false);
  }


  // Languages

  private async setLanguages() {
    const project = mls.actualProject;

    if (!project) {
      this.languages = {
        'English': { acronym: 'en', name: 'English' }
      }
    } else {
      const config = await getConfigProject(project);

      if (!config || !config.languages || config.languages.length === 0) {
        this.languages = {
          'English': { acronym: 'en', name: 'English' }
        }
      } else {
        config.languages.forEach((entry, index) => {
          this.languages[`${entry.name}`] = {
            acronym: entry.language,
            name: entry.name,
          }
        });
      }
    }

    const languagesOptions = Object.keys(this.languages).map((lg) => {
      const obj = this.languages[lg];
      const newOpt: IOptions = {
        text: obj.name,
        class: `collab-flags ${obj.acronym}`
      }
      return newOpt;
    });

    if (this.menu.tools.languages) this.menu.tools.languages.options = languagesOptions;
    if (this.menu.refresh) this.menu.refresh();
  }

  private configureTools(enabled: boolean) {
    const tools = this.nav3Service?.querySelector('collab-nav-3-menu .tools') as HTMLElement;
    if (!tools) return;
    tools.style.opacity = enabled ? '1' : '.2';
    tools.style.pointerEvents = enabled ? 'all' : 'none';
  }

  // Styles

  private async addStyles() {

    const iframeHtml = (window as any).preview.iframe?.contentDocument
    if (!iframeHtml || !iframeHtml) return;
    const id = convertFileToTag({ project: this.project, shortName: this.shortName, folder: this.folder });

    const oldStyle = iframeHtml.head.querySelector(`style[id=${id}]`);
    const newStyle = document.createElement('style');
    const newLess = await compileStyleUsingStorFile(this.shortName, this.project, this.folder, this.actualTheme);

    if (newLess) {
      newStyle.id = id;
      newStyle.textContent = newLess;
      iframeHtml.head.appendChild(newStyle);
      if (oldStyle) oldStyle.remove();
    }

    const tokens = await getTokensCss(this.project, this.actualTheme);
    this.mountTokens(tokens || '');

  }

  private mountTokens(tokens: string): void {
    try {
      const iframe = (window as any).preview.iframe;
      if (!iframe || !iframe.contentDocument) return;
      this.removeOlderTokens(iframe);
      const css = tokens || '';
      if (!css) return;
      const style = document.createElement('style');
      style.textContent = css;
      style.id = this.getIdTokens();
      iframe.contentDocument.head.appendChild(style);

    } catch (e: any) {
      console.info('Error mountTokens: ' + e.message);
    }
  }

  private removeOlderTokens(ifr: HTMLIFrameElement) {
    const id = this.getIdTokens();
    if (!ifr.contentDocument || !id) return;
    const st = ifr.contentDocument.head.querySelectorAll(`#${id}`);
    st.forEach((s) => s.remove());
  }

  private getIdTokens() {
    return '_' + this.project + '_ds_tokens';
  }

  // Editor 

  private createEditor() {
    if (!this.monacoEditor) {
      this.monacoEditor = document.createElement('mls-editor-100529');
      this.monacoEditor.setAttribute('ismls2', 'true');

    }
    if (this._ed1) return;

    this._ed1 = monaco.editor.create(this.monacoEditor, mls.editor.conf[this.confE] as monaco.editor.IEditorOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      noImplicitAny: true
    });

    (this.monacoEditor as any)['mlsEditor'] = this._ed1;
    (window as any).preview.editor = this._ed1;

  }

  private async setModel(storFile: mls.stor.IFileInfo) {
    try {
      const model = await this.createModelIfNeeded(storFile);
      if (!this._ed1 || !model) return;
      this._ed1.setModel(model);
    } catch (e: any) {
      this.setError(`[setModel] Error:' + (e.message ? e.message : 'Not found model`);
    }

  }

  private async createModelIfNeeded(storFile: mls.stor.IFileInfo): Promise<monaco.editor.ITextModel | undefined> {
    const keyModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    const models = mls.editor.models[keyModel];
    if (!models?.html) {
      const model = await createModel(storFile, true, true);
      return model?.model;
    }
    return models.html.model;
  }

  // Tasks 

  async handleSend(value: string, opt: { isSpecialMention: boolean, agentName: string }) {

    if (!this.actualFiles || !this.actualFiles.ts) {
      this.setError('Erro page not selected');
      return;
    }

    if (!opt.isSpecialMention || !opt.agentName) {
      this.setError('Please select a agent first ex: @@Improve');
      return;
    }

    if (!value) {
      this.setError('Error: Invalid prompt');
      return;
    }

    this.loading = true;
    const fullName = `_${this.project}_/l${this.level}/${this.folder ? this.folder + '/' : ''} ${this.shortName}`;

    try {
      await this.fireCollab(opt.agentName, JSON.stringify({ fullName, page: this.page, prompt: value, position: 'left' }), fullName);
      this.loading = false;
    } catch (err: any) {
      this.setError('Error on send message:' + err.message);
      this.loading = false;
    }

  }

  private onTaskChange = async (e: Event) => {

    if (this.tasksInProgress.size === 0) return;
    const customEvent = e as CustomEvent;
    const message: mls.msg.Message = customEvent.detail.context.message;
    const task: mls.msg.TaskData = customEvent.detail.context.task;
    const { content, createAt, senderId, threadId } = message;
    const createAt2 = customEvent.detail.oldContextCreateAt ? customEvent.detail.oldContextCreateAt : createAt;

    let contextChangedByPage = Array.from(this.tasksInProgress).find((item) => {
      const [key, value] = item;
      return key === this.page
    });

    if (!contextChangedByPage) return;

    const tasks = this.tasksInProgress.get(this.page);
    if (!tasks) return;
    let contextChanged = Array.from(tasks).find((item) =>
      item.message.content === content &&
      item.message.senderId === senderId &&
      item.message.createAt === createAt2 &&
      item.message.threadId === threadId
    );

    if (!task && contextChanged || (contextChanged && task && (task.status === 'failed' || task.status === 'done'))) {
      tasks.delete(contextChanged);
      if (tasks.size === 0) this.tasksInProgress.delete(this.page);
    }

    if (!this.tasksInProgress.get(this.page) || this.tasksInProgress.get(this.page)?.size === 0) {
      this.updateLoadingToFalseIfNoTasksRunning();
      this.createPreview();
    }

  };

  private updateLoadingToFalseIfNoTasksRunning() {
    if (this.tasksInProgress.size === 0) this.loading = false;
    const actual = this.tasksInProgress.get(this.page);
    if (!actual) this.loading = false;
    else if (actual.size === 0) this.loading = false;
  }

  private async fireCollab(agentName: string, prompt: string, fullName: string) {

    fullName = fullName ? fullName : this.page;

    let threadPromise = this.threadCache.get(fullName);

    if (!threadPromise) {
      threadPromise = (async () => {
        let thread = await getThreadByName(fullName);
        if (!thread) {
          thread = await createThread(fullName, [], 'company');
        }
        return thread;
      })();
      this.threadCache.set(fullName, threadPromise);
    }

    const thread = await threadPromise;
    const userId = getUserId();
    if (!userId) return;

    const threadId = thread?.threadId;
    if (!threadId) {
      this.setError('Cannot find thread');
      return;
    }

    const moduleAgent = await loadAgent(agentName);
    if (!moduleAgent) throw new Error('Invalid agent');
    const context = getTemporaryContext(threadId, userId, prompt);

    if (!this.tasksInProgress.get(fullName)) {
      this.tasksInProgress.set(fullName, new Set());
    }
    this.tasksInProgress.get(fullName)?.add(context);
    await executeBeforePrompt(moduleAgent, context);
  }

  // Life cycle

  async firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
    super.firstUpdated(changedProperties);
    this.createEditor();
    this.setLanguages();
    this.configureTools(false);
    subscribe('preview.language', this);
    subscribe('preview.file', this);
    window.addEventListener('task-change', this.onTaskChange);
  }

  connectedCallback() {
    super.connectedCallback();
    (window as any).preview.refresh = this.createPreview.bind(this);
    this.setEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearPreview();
    unsubscribe('preview.language', this);
    unsubscribe('preview.file', this);
    window.removeEventListener('task-change', this.onTaskChange);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
    const hasMsize = changedProperties.has('msize');

    if (changedProperties.has('modePreview')) {
      this.updatePreviewMode();
    }
  }

  render() {
    this.style.display = 'block';
    const lang = this.getMessageKey(messages);
    this.msg = messages[lang];

    return html`<collab-spliter-vertical-var-fixed-102027 msize=${this.msize} withresize="false" fixedheight="100" complementcolor="var(--bg-primary-color)">

                <collab-spliter-horizontal-var-fixed-102027
                    slot="top"
                    complementcolor="var(--bg-primary-color);"
                    fixedwidth="30%"
                    fixedvisible= "closed" 
                >
                    <div slot="left" style="height:100%;" id="preview-container"></div>
                    <div slot="right" style="height:100%;" id="preview-details"></div>
                </collab-spliter-horizontal-var-fixed-102027>
                <div slot="bottom">
                    <collab-messages-prompt-102025
                        acceptAutoCompleteAgents="true"
                        scope="l${this.level}_preview"  
                        placeholder="${this.msg.promptPlaceholder}"
                        .onSend=${this.handleSend.bind(this)}
                    ></collab-messages-prompt-102025>
                </div>
            </collab-spliter-vertical-var-fixed-102027>`;
  }

}



enum PreviewType {
  'Desktop' = 0,
  'Mobile' = 1,
}

type PreviewMode = 'Desktop' | 'Mobile'

interface ILanguage {
  [key: string]: { acronym: string, name: string }
}