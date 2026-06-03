/// <mls fileReference="_102020_/l2/previewEditorL3.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { customElement } from 'lit/decorators.js';
import { setState, initState, getState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { findTextOriginByOccurrence, findTextOriginByKey, applyTextEdit, type TextOrigin } from '/_102020_/l2/previewTextEditor.js';

@customElement('preview-editor-l3-102020')
class PreviewEditorL3 extends StateLitElement {

  private overlayEl!: HTMLDivElement;
  private selectedElementRef: HTMLElement | null = null;

  constructor() {
    super();
    initState('previewL3', {
      selectedElement: null,
      selectedTagName: '',
      selectedRect: null,
      editMode: 'select',
      hoveredElement: null,
    });
  }

  createRenderRoot() {
    return this;
  }

  handleIcaStateChange(key: string, value: any) {
    if (key === 'previewL3.editMode') {
      this.updateCursorForMode(value);
    }
    if (key === 'previewL3.selectedElement') {
      this.drawSelection(value);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.onHostClick, true);
    this.addEventListener('pointerdown', this.onHostPointerDown, true);
    this.addEventListener('mousedown', this.onHostPointerDown, true);
    this.addEventListener('mousemove', this.onHostMouseMove);
    this.addEventListener('mouseleave', this.onHostMouseLeave);
    subscribe('previewL3.editMode', this);
    subscribe('previewL3.selectedElement', this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.onHostClick, true);
    this.removeEventListener('pointerdown', this.onHostPointerDown, true);
    this.removeEventListener('mousedown', this.onHostPointerDown, true);
    this.removeEventListener('mousemove', this.onHostMouseMove);
    this.removeEventListener('mouseleave', this.onHostMouseLeave);
    window.removeEventListener('scroll', this.onScrollResize);
    window.removeEventListener('resize', this.onScrollResize);

    unsubscribe('previewL3.editMode', this);
    unsubscribe('previewL3.selectedElement', this);
  }

  firstUpdated() {
    this.createOverlay();
    this.injectBaseStyles();

    window.addEventListener('scroll', this.onScrollResize);
    window.addEventListener('resize', this.onScrollResize);

    // Re-select the molecule element that was swapped before the iframe repainted
    this._tryReselectPending();
  }

  // --- Reselect after molecule swap ---

  /**
   * After a molecule tag swap the preview rebuilds the iframe, losing the
   * selection.  serviceGenome stores the new tag in 'preview.pendingReselect'
   * before triggering forceModelUpdate.  Here (first render of the fresh
   * previewEditorL3 instance) we read that tag, find the first matching
   * element in the DOM and programmatically fire the same selection logic
   * used by the click handler, then clear the pending state.
   */
  private _tryReselectPending() {
    const pendingTag: string | null = getState('preview.pendingReselect');
    if (!pendingTag) return;

    // Clear immediately so a later re-render doesn't re-trigger
    setState('preview.pendingReselect', null);

    // The child components may not be upgraded yet — wait two animation frames
    // so Lit finishes rendering the page component before we query the DOM.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._reselectTag(pendingTag);
      });
    });
  }

  private _reselectTag(tag: string) {
    // Find the element inside ourselves (excluding our own control overlays)
    const el = this.querySelector(tag) as HTMLElement | null;
    if (!el) {
      console.log('[PreviewEditorL3] pendingReselect: element not found for tag:', tag);
      return;
    }

    console.log('[PreviewEditorL3] pendingReselect: reselecting', tag, el);

    const selectableEl = this.resolveSelectableElement(el);
    this.selectedElementRef = selectableEl;
    const selector = this.buildSelector(selectableEl);

    setState('previewL3.selectedElement', selector);
    setState('previewL3.selectedTagName', selectableEl.tagName.toLowerCase());
    setState('previewL3.selectedRect', selectableEl.getBoundingClientRect());

    this.notifyHost('element-select', selectableEl);
  }

  // --- Estilos base ---

  private injectBaseStyles() {
    const style = document.createElement('style');
    style.id = 'l3-editor-styles';
    style.textContent = `
      .l3-overlay {
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none; z-index: 99990;
      }

      .l3-hover-highlight {
        outline: 2px dashed rgba(66,135,245,0.6);
        background: rgba(66,135,245,0.05);
      }

      .l3-select-highlight {
        outline: 2px solid #4287f5;
        background: rgba(66,135,245,0.08);
      }

      .l3-select-label {
        position: absolute; top: -22px; left: -1px;
        background: #4287f5; color: white;
        padding: 2px 8px; font-size: 11px;
        border-radius: 3px 3px 0 0;
        font-family: monospace;
        white-space: nowrap;
      }

      .l3-edit-span {
        display: inline;
        min-width: 1ch;
        outline: 2px solid #f5a623 !important;
        background: rgba(245, 166, 35, 0.08) !important;
        border-radius: 2px;
        padding: 0 2px;
      }

      @keyframes l3-error-flash {
        0%, 100% { outline: 2px solid transparent; background: transparent; }
        20%, 60% { outline: 2px solid #e53935; background: rgba(229,57,53,0.12); }
      }
      .l3-edit-error {
        animation: l3-error-flash 600ms ease;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Criação dos elementos de controle ---

  private createOverlay() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.classList.add('l3-control', 'l3-overlay');
    this.appendChild(this.overlayEl);
  }

  // --- Eventos principais ---

  private onHostPointerDown = (e: Event) => {
    e.stopPropagation(); // Page NEVER receives pointer events in any mode

    const mode = getState('previewL3.editMode');
    if (mode !== 'text' || !(e instanceof MouseEvent) || !this._editSpan) return;

    // In text mode: reposition cursor or end editing
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range && this._editSpan.contains(range.startContainer)) {
        this._editSpan.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else {
        this._editSpan.blur();
      }
    } else {
      this._editSpan.blur();
    }
  }

  private onHostClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent link navigation and other default browser actions

    const currentMode = getState('previewL3.editMode');
    if (currentMode === 'text') return;

    const target = e.target as HTMLElement;
    if (!target || this.isL3Control(target) || (target as unknown) === this) return;

    const selectableEl = this.resolveSelectableElement(target);

    this.selectedElementRef = selectableEl;
    const selector = this.buildSelector(selectableEl);

    setState('previewL3.selectedElement', selector);
    setState('previewL3.selectedTagName', selectableEl.tagName.toLowerCase());
    setState('previewL3.selectedRect', selectableEl.getBoundingClientRect());

    this.notifyHost('element-select', selectableEl);

    const textResult = this.findClickedTextNode(e, target);
    if (textResult) {
      // 1. Caminho preferencial: chave i18n vinda do data-i18n-key (helper t()).
      //    Resolução 100% determinística — sem contagem de ocorrência.
      const i18nKey = this.resolveI18nKey(textResult.textNode);

      // 2. Fallback (texto não tagueado): heurística por ocorrência no DOM.
      let occurrenceIndex = 0;
      if (!i18nKey) {
        const pageTag = this.findPageComponent();
        const clickedText = (textResult.textNode.textContent || '').trim();
        occurrenceIndex = pageTag
          ? this.getTextOccurrenceIndex(textResult.textNode, clickedText, pageTag)
          : 0;
      }

      setState('previewL3.editMode', 'text');
      this.enableTextEdit(selectableEl, textResult.textNode, textResult.offset, occurrenceIndex, i18nKey);
    }
  }

  private resolveSelectableElement(target: HTMLElement): HTMLElement {
    let current: HTMLElement | null = target;

    while (current && current !== this) {
      const parent: HTMLElement | null = current.parentElement;
      if (!parent || parent === this) break;

      const parentTag = parent.tagName.toLowerCase();

      if (parentTag.includes('-') && parentTag !== 'preview-editor-l3-102020') {
        const pageTag = this.findPageComponent();
        if (pageTag && parentTag !== pageTag) {
          return parent;
        }
      }

      current = parent;
    }

    return target;
  }

  private _lastHoveredEl: HTMLElement | null = null;

  private onHostMouseMove = (e: MouseEvent) => {
    const mode = getState('previewL3.editMode');
    if (mode === 'text') return;

    const target = e.target as HTMLElement;
    if (!target || target === this._lastHoveredEl) return;
    if (this.isL3Control(target) || (target as unknown) === this) return;

    this._lastHoveredEl = target;

    if (mode === 'inspect') {
      this.drawBoxModel(target);
    } else {
      this.drawHover(target);
    }

    setState('previewL3.hoveredElement', this.buildSelector(target));
  }

  private onHostMouseLeave = () => {
    const mode = getState('previewL3.editMode');
    if (mode === 'text') return;

    this._lastHoveredEl = null;
    this.clearHover();
    setState('previewL3.hoveredElement', null);
  }

  private onScrollResize = () => {
    if (this.selectedElementRef) {
      const selector = getState('previewL3.selectedElement');
      if (selector) this.drawSelection(selector);
    }
  }

  // --- Text node helpers ---

  private findClickedTextNode(e: MouseEvent, el: HTMLElement): { textNode: Text; offset: number } | null {
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = (range.startContainer.textContent || '').trim();
        if (text) {
          return { textNode: range.startContainer as Text, offset: range.startOffset };
        }
      }
    }

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent || '').trim()) {
        return { textNode: child as Text, offset: 0 };
      }
    }

    return null;
  }

  /**
   * Lê a chave i18n do ancestral mais próximo marcado com data-i18n-key
   * (emitido pelo helper t()). Retorna null para texto não tagueado, que
   * então cai no fallback baseado em ocorrência.
   */
  private resolveI18nKey(textNode: Text): string | null {
    let el: HTMLElement | null = textNode.parentElement;
    while (el && el !== this) {
      const key = el.getAttribute('data-i18n-key');
      if (key) return key;
      el = el.parentElement;
    }
    return null;
  }

  // --- Edição de texto ---

  /**
   * Edita um text node específico, isolando-o num span temporário.
   * A chave i18n (se houver) é resolvida ANTES de entrar aqui (data-i18n-key);
   * caso contrário, usa-se o occurrenceIndex resolvido com o DOM intacto.
   */
  // Pending unlock timer — cancelled if a new edit starts before it fires
  private _moleculeUnlockTimer: number | null = null;
  private _editSpan: HTMLSpanElement | null = null;

  private enableTextEdit(
    selectableEl: HTMLElement,
    textNode: Text,
    caretOffset: number = 0,
    occurrenceIndex: number = 0,
    i18nKey: string | null = null,
  ) {
    const oldText = (textNode.textContent || '').trim();
    if (!oldText) return;

    const editParent = textNode.parentElement;
    if (!editParent) return;

    if (this._moleculeUnlockTimer !== null) {
      clearTimeout(this._moleculeUnlockTimer);
      this._moleculeUnlockTimer = null;
    }

    const moleculeHost = this.findMoleculeHost(editParent);
    if (moleculeHost) moleculeHost._mutationLock = true;

    // Replace the text node with an isolated contenteditable span.
    // This prevents the native button Space→click behavior since
    // focus goes to the span, not the button.
    const span = document.createElement('span');
    span.className = 'l3-edit-span';
    span.contentEditable = 'true';
    span.textContent = oldText;
    editParent.replaceChild(span, textNode);
    this._editSpan = span;

    span.focus();

    // Place caret at click position
    const innerTextNode = span.firstChild;
    if (innerTextNode && document.createRange) {
      const range = document.createRange();
      const clampedOffset = Math.min(caretOffset, (innerTextNode.textContent || '').length);
      range.setStart(innerTextNode, clampedOffset);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const onBlur = () => {
      const newText = (span.textContent || '').trim();

      // Optimistic update: show newText immediately so the user sees the change.
      // On error (dynamic origin), applyTextEditToSource will revert via restoredNode.
      const restoredNode = document.createTextNode(newText !== oldText ? newText : oldText);
      if (span.parentElement) {
        span.parentElement.replaceChild(restoredNode, span);
      }
      this._editSpan = null;

      setState('previewL3.editMode', 'select');

      if (newText !== oldText) {
        this.applyTextEditToSource(oldText, newText, selectableEl, occurrenceIndex, editParent, restoredNode, i18nKey);
      }

      span.removeEventListener('blur', onBlur);
      span.removeEventListener('keydown', onKeydown);

      this._moleculeUnlockTimer = window.setTimeout(() => {
        this._moleculeUnlockTimer = null;
        if (moleculeHost) moleculeHost._mutationLock = false;
      }, 50);
    };

    const onKeydown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        span.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        span.blur(); // onBlur always restores oldText
      }
    };

    span.addEventListener('blur', onBlur);
    span.addEventListener('keydown', onKeydown);
  }

  /**
   * Walks up from an element and returns the first MoleculeAuraElement ancestor,
   * or null if the element is in the page's own DOM.
   */
  private findMoleculeHost(el: HTMLElement): any | null {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== this) {
      if (typeof (current as any)._mutationLock === 'boolean') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Applies the text edit to the source .ts file.
   *
   * Resolução da origem:
   *  - Se i18nKey está presente (data-i18n-key) → findTextOriginByKey:
   *    resolução determinística, sem ambiguidade entre chaves com o mesmo valor.
   *  - Caso contrário → findTextOriginByOccurrence (heurística de ocorrência).
   *
   * Em ambos os casos, se a origem for 'dynamic' no arquivo da página, tenta-se
   * o arquivo shared antes de marcar como não editável.
   */
  private async applyTextEditToSource(
    oldText: string,
    newText: string,
    el: HTMLElement,
    occurrenceIndex: number = 0,
    editTarget?: HTMLElement,
    restoredNode?: Text,
    i18nKey: string | null = null,
  ) {
    const pageComponent = this.findPageComponent();
    if (!pageComponent) return;

    const tsModel = this.getPageTsModel(pageComponent);
    if (!tsModel) return;

    const source = tsModel.model.getValue();
    const lang = getState('preview.language') || 'en';

    console.log('[TextEdit] applyTextEditToSource', { oldText, newText, lang, occurrenceIndex, i18nKey });

    const resolve = (src: string): TextOrigin =>
      i18nKey
        ? findTextOriginByKey(i18nKey, src, lang)
        : findTextOriginByOccurrence(oldText, src, occurrenceIndex, lang);

    let origin = resolve(source);
    let activeModel = tsModel;
    let activeSource = source;

    if (origin.type === 'dynamic') {
      const sharedModel = await this.getSharedTsModel();
      if (sharedModel) {
        const sharedSource = sharedModel.model.getValue();
        const sharedOrigin = resolve(sharedSource);
        if (sharedOrigin.type !== 'dynamic') {
          origin = sharedOrigin;
          activeModel = sharedModel;
          activeSource = sharedSource;
        }
      }
    }

    console.log('[TextEdit] origin resolved:', origin.type === 'i18n' ? {
      type: origin.type,
      key: origin.key,
      languages: origin.languages.map(l => ({ lang: l.lang, value: l.value, offset: l.startOffset + '-' + l.endOffset })),
    } : origin);

    if (origin.type === 'dynamic') {
      if (restoredNode) restoredNode.textContent = oldText;
      if (editTarget) {
        editTarget.classList.add('l3-edit-error');
        setTimeout(() => editTarget.classList.remove('l3-edit-error'), 650);
      }
      return;
    }

    const result = applyTextEdit(origin, newText, activeSource, lang);

    console.log('[TextEdit] applyTextEdit result:', { success: result.success, error: result.error });

    if (!result.success || !result.newSource) return;

    setState('preview.pausePreview', true);
    activeModel.model.pushEditOperations(
      [],
      [{
        range: activeModel.model.getFullModelRange(),
        text: result.newSource,
      }],
      () => null,
    );
  }

  private async getSharedTsModel(): Promise<any | null> {
    try {
      const service = getState('preview.service') as any;
      if (!service?.actualFiles?.ts) return null;

      const { project, folder, shortName } = service.actualFiles.ts;

      // folder: "petshop/web/desktop/page11" → moduleName: "petshop", genomeKey: "web/desktop/page11"
      const slashIdx = folder.indexOf('/');
      if (slashIdx < 0) return null;
      const moduleName = folder.slice(0, slashIdx);
      const genomeKey = folder.slice(slashIdx + 1);
      const genomeSegments = genomeKey.split('/');
      const device = genomeSegments[0];
      if (!device) return null;

      const mod = await import(`/_${project}_/l2/${moduleName}/module.js`) as any;
      const deviceSkills = mod?.skills?.[device];
      if (!deviceSkills?.sharedPath) return null;

      // sharedPath may be a full MLS path like '/_102029_/l2/web/shared' or just '/web/shared'
      // Strip leading /_XXXXX_/l2/ prefix, then any remaining slashes
      const sharedPath = (deviceSkills.sharedPath as string)
        .replace(/^\/?_\d+_\/l2\//, '')
        .replace(/^\/|\/$/g, '');

      const sharedFolder = sharedPath;

      const level = service.isL3 ? 2 : service.level;
      const mlsAny = (globalThis as any).mls;
      const storKey = mlsAny.stor.getKeyToFile({ project, shortName, folder: sharedFolder, extension: '.ts', level });
      const storFile = mlsAny.stor.files[storKey];
      if (!storFile) return null;

      return await (storFile as any).getOrCreateModel();
    } catch (e) {
      return null;
    }
  }

  private getTextOccurrenceIndex(targetTextNode: Text, text: string, pageTag: string): number {
    const pageEl = this.querySelector(pageTag);
    if (!pageEl) return 0;

    const normalizedText = text.trim();

    // 1. Coleta, em document order, TODOS os text nodes que casam com o valor.
    const matches: { node: Text; litBound: boolean }[] = [];
    const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      if ((node.textContent || '').trim() === normalizedText) {
        matches.push({ node: node as Text, litBound: this.isLitBoundTextNode(node as Text) });
      }
      node = walker.nextNode();
    }

    // 2. Se existe pelo menos um nó vinculado pelo Lit, restringe o universo aos
    //    vinculados — assim texto estático/incidental (não bindado) não infla o
    //    índice. O alvo entra SEMPRE por identidade, mesmo que o marcador dele
    //    não tenha sido detectado (era o ponto que quebrava antes: o retorno por
    //    identidade ficava gateado pelo check de ?lit$).
    const anyBound = matches.some(m => m.litBound);
    const universe = anyBound
      ? matches.filter(m => m.litBound || m.node === targetTextNode)
      : matches;

    // 3. Índice do alvo por identidade.
    const idx = universe.findIndex(m => m.node === targetTextNode);
    return idx >= 0 ? idx : 0;
  }

  private isLitBoundTextNode(node: Text): boolean {
    const prev = node.previousSibling;
    return !!prev
      && prev.nodeType === Node.COMMENT_NODE
      && (prev as Comment).data.startsWith('?lit$');
  }

  private findPageComponent(): string | null {
    for (const child of Array.from(this.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag.includes('-') && !child.classList.contains('l3-control') && tag !== 'preview-editor-l3-102020') {
        return tag;
      }
    }
    return null;
  }

  private getPageTsModel(tag: string): any | null {
    try {
      const service = getState('preview.service') as any;
      if (!service?.actualFiles?.ts) return null;

      const { project, shortName, folder } = service.actualFiles.ts;
      const level = service.isL3 ? 2 : service.level;

      const keyModel = (mls as any).editor.getKeyModel(project, shortName, folder, level);
      const models = (mls as any).editor.models[keyModel];
      if (models?.ts) return models.ts;

      if (service.actualModels?.ts) {
        const src = service.actualModels.ts.model.getValue();
        if (src.includes(tag)) return service.actualModels.ts;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // --- Desenho de highlights ---

  private drawHover(el: HTMLElement) {
    const rect = el.getBoundingClientRect();

    let html = '';

    if (this.selectedElementRef && this.selectedElementRef.isConnected) {
      const selRect = this.selectedElementRef.getBoundingClientRect();
      const tag = this.selectedElementRef.tagName.toLowerCase();
      html += this.getSelectionHtml(selRect, tag);
    }

    if (el !== this.selectedElementRef) {
      html += `<div class="l3-hover-highlight" style="
        position:fixed;
        top:${rect.top}px; left:${rect.left}px;
        width:${rect.width}px; height:${rect.height}px;
      "></div>`;
    }

    this.overlayEl.innerHTML = html;
  }

  private drawSelection(selector: string | null) {
    if (!selector || !this.selectedElementRef || !this.selectedElementRef.isConnected) {
      this.overlayEl.innerHTML = '';
      return;
    }
    const rect = this.selectedElementRef.getBoundingClientRect();
    const tag = this.selectedElementRef.tagName.toLowerCase();

    this.overlayEl.innerHTML = this.getSelectionHtml(rect, tag);
  }

  private getSelectionHtml(rect: DOMRect, tag: string): string {
    return `<div class="l3-select-highlight" style="
      position:fixed;
      top:${rect.top}px; left:${rect.left}px;
      width:${rect.width}px; height:${rect.height}px;
    ">
      <span class="l3-select-label">${tag}</span>
    </div>`;
  }

  private drawBoxModel(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const mt = parseFloat(cs.marginTop);
    const mr = parseFloat(cs.marginRight);
    const mb = parseFloat(cs.marginBottom);
    const ml = parseFloat(cs.marginLeft);
    const pt = parseFloat(cs.paddingTop);
    const pr = parseFloat(cs.paddingRight);
    const pb = parseFloat(cs.paddingBottom);
    const plv = parseFloat(cs.paddingLeft);

    this.overlayEl.innerHTML = `
      <div style="position:fixed;
        top:${rect.top - mt}px; left:${rect.left - ml}px;
        width:${rect.width + ml + mr}px; height:${rect.height + mt + mb}px;
        background:rgba(246,178,107,0.3);
        pointer-events:none;"></div>
      <div style="position:fixed;
        top:${rect.top}px; left:${rect.left}px;
        width:${rect.width}px; height:${rect.height}px;
        border-top:${pt}px solid rgba(147,196,125,0.4);
        border-right:${pr}px solid rgba(147,196,125,0.4);
        border-bottom:${pb}px solid rgba(147,196,125,0.4);
        border-left:${plv}px solid rgba(147,196,125,0.4);
        box-sizing:border-box;
        pointer-events:none;"></div>
      <div style="position:fixed;
        top:${rect.top + pt}px; left:${rect.left + plv}px;
        width:${rect.width - plv - pr}px; height:${rect.height - pt - pb}px;
        background:rgba(66,135,245,0.1);
        pointer-events:none;"></div>
    `;
  }

  // --- Helpers ---

  private isL3Control(el: HTMLElement): boolean {
    return el.closest('.l3-control') !== null;
  }

  private buildSelector(el: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = el;
    while (current && current !== this) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        path.unshift(part);
        break;
      }
      const parent: HTMLElement | null = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current!.tagName && !c.classList.contains('l3-control')
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      path.unshift(part);
      current = parent;
    }
    return path.join(' > ');
  }

  private notifyHost(type: string, el: HTMLElement, extra?: Record<string, any>) {
    window.parent.postMessage({
      source: 'preview-editor-l3',
      type,
      selector: this.buildSelector(el),
      tagName: el.tagName.toLowerCase(),
      textContent: type === 'text-edit' ? el.textContent : undefined,
      outerHTML: type === 'element-delete' || type === 'element-duplicate' ? el.outerHTML : undefined,
      ...extra,
    }, '*');
  }

  private updateCursorForMode(mode: string) {
    const cursors: Record<string, string> = {
      select: 'default',
      text: 'text',
      inspect: 'crosshair',
    };
    // @ts-ignore
    this.style.cursor = cursors[mode] || 'default';
  }

  private clearHover() {
    if (this.selectedElementRef && this.selectedElementRef.isConnected) {
      this.drawSelection(getState('previewL3.selectedElement'));
    } else {
      this.overlayEl.innerHTML = '';
    }
  }
}