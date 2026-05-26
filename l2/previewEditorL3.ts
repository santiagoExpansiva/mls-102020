/// <mls fileReference="_102020_/l2/previewEditorL3.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { customElement } from 'lit/decorators.js';
import { setState, initState, getState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import {  findTextOriginByOccurrence, applyTextEdit } from '/_102020_/l2/previewTextEditor.js';

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
    this.addEventListener('click', this.onClick);
    this.addEventListener('mouseover', this.onHover);
    this.addEventListener('mouseout', this.onHoverOut);

    subscribe('previewL3.editMode', this);
    subscribe('previewL3.selectedElement', this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('mouseover', this.onHover);
    this.removeEventListener('mouseout', this.onHoverOut);
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

  private onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (this.isL3Control(target)) return;

    const currentMode = getState('previewL3.editMode');
    if (currentMode === 'text') return;

    e.preventDefault();
    e.stopPropagation();

    const selectableEl = this.resolveSelectableElement(target);

    this.selectedElementRef = selectableEl;
    const selector = this.buildSelector(selectableEl);

    setState('previewL3.selectedElement', selector);
    setState('previewL3.selectedTagName', selectableEl.tagName.toLowerCase());
    setState('previewL3.selectedRect', selectableEl.getBoundingClientRect());

    this.notifyHost('element-select', selectableEl);

    const textResult = this.findClickedTextNode(e, target);
    if (textResult) {
      const pageTag = this.findPageComponent();
      const clickedText = (textResult.textNode.textContent || '').trim();
      const occurrenceIndex = pageTag
        ? this.getTextOccurrenceIndex(textResult.textNode, clickedText, pageTag)
        : 0;
      setState('previewL3.editMode', 'text');
      this.enableTextEdit(selectableEl, textResult.textNode, textResult.offset, occurrenceIndex);
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

  private onHover = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (this.isL3Control(target)) return;

    const mode = getState('previewL3.editMode');
    if (mode === 'text') return;

    if (mode === 'inspect') {
      this.drawBoxModel(target);
    } else {
      this.drawHover(target);
    }

    setState('previewL3.hoveredElement', this.buildSelector(target));
  }

  private onHoverOut = () => {
    const mode = getState('previewL3.editMode');
    if (mode === 'text') return;

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

  // --- Edição de texto ---

  /**
   * Edita um text node específico, isolando-o num span temporário.
   * O expressionIndex é resolvido ANTES de entrar aqui (enquanto o DOM ainda está intacto).
   */
  // Pending unlock timer — cancelled if a new edit starts before it fires
  private _moleculeUnlockTimer: number | null = null;

  private enableTextEdit(selectableEl: HTMLElement, textNode: Text, caretOffset: number = 0, occurrenceIndex: number = 0) {
    const oldText = (textNode.textContent || '').trim();
    if (!oldText) return;

    const editTarget = textNode.parentElement;
    if (!editTarget) return;

    // Cancel any pending unlock from a previous edit so we don't accidentally
    // release the lock while this new edit is still active.
    if (this._moleculeUnlockTimer !== null) {
      clearTimeout(this._moleculeUnlockTimer);
      this._moleculeUnlockTimer = null;
    }

    const moleculeHost = this.findMoleculeHost(editTarget);
    if (moleculeHost) moleculeHost._mutationLock = true;

    editTarget.contentEditable = 'true';
    editTarget.style.outline = '2px solid #f5a623';
    editTarget.focus();

    // Place caret at the click position
    if (textNode && document.createRange) {
      const range = document.createRange();
      const clampedOffset = Math.min(caretOffset, (textNode.textContent || '').length);
      range.setStart(textNode, clampedOffset);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const onBlur = () => {
      const newText = (editTarget.textContent || '').trim();

      // Remove contenteditable WHILE lock is still active so the attribute
      // mutation is absorbed by the still-locked observer.
      editTarget.removeAttribute('contenteditable');
      editTarget.style.outline = '';

      setState('previewL3.editMode', 'select');

      if (newText !== oldText) {
        this.applyTextEditToSource(oldText, newText, selectableEl, occurrenceIndex);
      }

      editTarget.removeEventListener('blur', onBlur);
      editTarget.removeEventListener('keydown', onKeydown);

      // Schedule unlock — delayed past the molecule debounce (16ms).
      // Stored so a rapid second click can cancel it before it fires.
      this._moleculeUnlockTimer = window.setTimeout(() => {
        this._moleculeUnlockTimer = null;
        if (moleculeHost) moleculeHost._mutationLock = false;
      }, 50);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editTarget.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        editTarget.textContent = oldText;
        editTarget.blur();
      }
    };

    editTarget.addEventListener('blur', onBlur);
    editTarget.addEventListener('keydown', onKeydown);
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
   * Three cases, detected from the DOM at the time of the edit:
   *
   * 1. Text inside a slot tag written by the page:
   *      <my-wc><Label display:none>${this.msg.email}</Label></my-wc>
   *    → occurrenceIndex recalculated using the hidden slot node
   *
   * 2. Text directly in the page DOM (normal case)
   *    → occurrenceIndex used as-is
   *
   * 3. Attribute on a wc written by the page (future, not yet handled here)
   */
  private async applyTextEditToSource(oldText: string, newText: string, el: HTMLElement, occurrenceIndex: number = 0) {
    const pageComponent = this.findPageComponent();
    if (!pageComponent) return;

    const tsModel = this.getPageTsModel(pageComponent);
    if (!tsModel) return;

    const source = tsModel.model.getValue();
    const lang = getState('preview.language') || 'en';

    console.log('[TextEdit] applyTextEditToSource', { oldText, newText, lang, occurrenceIndex });

    let origin = findTextOriginByOccurrence(oldText, source, occurrenceIndex, lang);
    let activeModel = tsModel;
    let activeSource = source;

    if (origin.type === 'dynamic') {
      const sharedModel = await this.getSharedTsModel();
      if (sharedModel) {
        const sharedSource = sharedModel.model.getValue();
        const sharedOrigin = findTextOriginByOccurrence(oldText, sharedSource, occurrenceIndex, lang);
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

    if (origin.type === 'dynamic') return;

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

      const sharedFolder = `${moduleName}/${sharedPath}`;

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
    let occurrenceCount = 0;

    const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_ALL, null);

    let node: Node | null = walker.firstChild();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim()) {
        const prev = node.previousSibling;
        const isLitBinding = prev
          && prev.nodeType === Node.COMMENT_NODE
          && (prev as Comment).data.startsWith('?lit$');

        if (isLitBinding) {
          const nodeText = (node.textContent || '').trim();
          if (nodeText === normalizedText) {
            if (node === targetTextNode) return occurrenceCount;
            occurrenceCount++;
          }
        }
      }
      node = walker.nextNode();
    }

    // Fallback: targetTextNode was not found via Lit markers (e.g. it lives
    // inside a wc's rendered DOM without a direct ?lit$ predecessor).
    // Re-walk counting ALL text nodes with matching content — the
    // applyTextEditToSource will resolve the correct source occurrence via
    // findSlotTextNodeForRendered anyway, so index 0 is safe here.
    return 0;
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
