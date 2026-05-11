/// <mls fileReference="_102020_/l2/previewEditorL3.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { customElement, property, state, query } from 'lit/decorators.js';
import { globalState, setState, initState, getState, subscribe, unsubscribe } from '/_102027_/l2/collabState.js';
import { findTextOrigin, findTextOriginByIndex, buildTemplateMap, applyTextEdit } from '/_102020_/l2/previewTextEditor.js';

/// **collab_i18n_start**
const message_pt = {
  attributes: 'Atributos',
  computedStyles: 'Estilos Computados',
  noSelection: 'Clique em um elemento para inspecionar',
  modeSelect: 'Seleção',
  modeInspect: 'Inspeção',
}

const message_en = {
  attributes: 'Attributes',
  computedStyles: 'Computed Styles',
  noSelection: 'Click an element to inspect',
  modeSelect: 'Select',
  modeInspect: 'Inspect',
}

type MessageType = typeof message_en;

const messages: { [key: string]: MessageType } = {
  'en': message_en,
  'pt': message_pt
}
/// **collab_i18n_end**

@customElement('preview-editor-l3-102020')
class PreviewEditorL3 extends StateLitElement {

  private msg: MessageType = messages['en'];
  private overlayEl!: HTMLDivElement;
  private breadcrumbEl!: HTMLDivElement;
  private propertiesPanelEl!: HTMLDivElement;
  private selectedElementRef: HTMLElement | null = null;
  private breadcrumbElements: Map<string, HTMLElement> = new Map();

  constructor() {
    super();
    initState('previewL3', {
      selectedElement: null,
      selectedTagName: '',
      selectedAttributes: {},
      selectedStyles: {},
      selectedRect: null,
      breadcrumb: [],
      editMode: 'select',          // 'select' | 'text' | 'inspect'
      hoveredElement: null,
      panelVisible: true,
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
      this.updatePropertiesPanel();
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
    this.setLanguage();
    this.createOverlay();
    this.createBreadcrumb();
    this.createPropertiesPanel();
    this.injectBaseStyles();

    window.addEventListener('scroll', this.onScrollResize);
    window.addEventListener('resize', this.onScrollResize);
  }

  // --- Idioma ---

  private setLanguage() {
    const lang = getState('preview.language') || 'en';
    this.msg = messages[lang] || messages['en'];
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

      .l3-breadcrumb {
        position: fixed;
        bottom: 0; left: 0;
        width: 100%;
        background: rgba(30, 30, 30, 0.95);
        color: #ccc;
        padding: 5px 10px;
        font-size: 12px;
        font-family: monospace;
        z-index: 99999;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 2px;
        overflow-x: auto;
        white-space: nowrap;
        backdrop-filter: blur(8px);
      }

      .l3-breadcrumb .l3-crumb {
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        transition: background 0.15s;
      }

      .l3-breadcrumb .l3-crumb:hover {
        background: rgba(66, 135, 245, 0.2);
        color: #fff;
      }

      .l3-breadcrumb .l3-crumb.active {
        color: #4287f5;
        font-weight: bold;
      }

      .l3-breadcrumb .l3-separator {
        color: #555;
        font-size: 10px;
      }

      .l3-properties-panel {
        position: fixed;
        top: 0; right: 0;
        width: 280px; height: 100%;
        background: rgba(30, 30, 30, 0.97);
        color: #ccc;
        z-index: 99998;
        pointer-events: auto;
        overflow-y: auto;
        font-family: monospace;
        font-size: 12px;
        border-left: 1px solid rgba(255,255,255,0.08);
        backdrop-filter: blur(8px);
        transform: translateX(100%);
        transition: transform 0.2s ease;
      }

      .l3-properties-panel.open {
        transform: translateX(0);
      }

      .l3-panel-section {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }

      .l3-panel-section-title {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #666;
        margin-bottom: 6px;
      }

      .l3-panel-tag {
        font-size: 16px;
        font-weight: bold;
        color: #4287f5;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }

      .l3-panel-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        gap: 8px;
      }

      .l3-panel-key {
        color: #9a9a9a;
        flex-shrink: 0;
      }

      .l3-panel-value {
        color: #e0e0e0;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 160px;
      }

      .l3-panel-empty {
        padding: 40px 12px;
        text-align: center;
        color: #555;
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

  private createBreadcrumb() {
    this.breadcrumbEl = document.createElement('div');
    this.breadcrumbEl.classList.add('l3-control', 'l3-breadcrumb');
    this.breadcrumbEl.addEventListener('click', this.onBreadcrumbClick);
    this.appendChild(this.breadcrumbEl);
  }

  private createPropertiesPanel() {
    this.propertiesPanelEl = document.createElement('div');
    this.propertiesPanelEl.classList.add('l3-control', 'l3-properties-panel');
    this.propertiesPanelEl.innerHTML = `<div class="l3-panel-empty">${this.msg.noSelection}</div>`;
    this.appendChild(this.propertiesPanelEl);
  }

  // --- Eventos principais ---

  private onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (this.isL3Control(target)) return;

    // Se está editando texto, não interfere (permite clicar dentro do span de edição)
    const currentMode = getState('previewL3.editMode');
    if (currentMode === 'text') return;

    e.preventDefault();
    e.stopPropagation();

    // Resolve o elemento selecionável: se está dentro de um web component, seleciona o web component
    const selectableEl = this.resolveSelectableElement(target);

    this.selectedElementRef = selectableEl;
    const selector = this.buildSelector(selectableEl);

    setState('previewL3.selectedElement', selector);
    setState('previewL3.selectedTagName', selectableEl.tagName.toLowerCase());
    setState('previewL3.selectedAttributes', this.getAttributes(selectableEl));
    setState('previewL3.selectedStyles', this.getRelevantStyles(selectableEl));
    setState('previewL3.selectedRect', selectableEl.getBoundingClientRect());
    setState('previewL3.breadcrumb', this.buildBreadcrumb(selectableEl));

    this.updateBreadcrumb();
    this.showPropertiesPanel();
    this.notifyHost('element-select', selectableEl);

    // Se clicou num text node, entra direto em modo edição
    const textResult = this.findClickedTextNode(e, target);
    if (textResult) {
      setState('previewL3.editMode', 'text');
      this.enableTextEdit(selectableEl, textResult.textNode, textResult.offset);
    }
  }

  /**
   * Resolve qual elemento deve ser selecionado.
   * Se o target está dentro de um custom element (web component) que é filho
   * do componente da página, seleciona o web component em vez do elemento interno.
   */
  private resolveSelectableElement(target: HTMLElement): HTMLElement {
    let current: HTMLElement | null = target;

    // Sobe no DOM procurando um custom element (tag com hífen)
    // Para quando encontrar o componente da página ou o próprio preview-editor
    while (current && current !== this) {
      const parent: HTMLElement | null = current.parentElement;
      if (!parent || parent === this) break;

      const parentTag = parent.tagName.toLowerCase();

      // Se o parent é um custom element (tem hífen) e NÃO é o componente da página
      // nem o preview-editor, então o parent é um web component interno
      // e devemos selecionar ele
      if (parentTag.includes('-') && parentTag !== 'preview-editor-l3-102020') {
        // Verifica se é um web component que está dentro do page component
        const pageTag = this.findPageComponent();
        if (pageTag && parentTag !== pageTag) {
          // O parent é um web component interno → seleciona ele
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

    // Não interfere durante edição de texto
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

  // --- Breadcrumb click ---

  private onBreadcrumbClick = (e: MouseEvent) => {
    e.stopPropagation();
    const crumb = (e.target as HTMLElement).closest('.l3-crumb') as HTMLElement;
    if (!crumb) return;

    const crumbId = crumb.dataset.crumbId;
    if (!crumbId) return;

    const el = this.breadcrumbElements.get(crumbId);
    if (!el || !el.isConnected) return;

    this.selectedElementRef = el;
    const selector = this.buildSelector(el);

    setState('previewL3.selectedElement', selector);
    setState('previewL3.selectedTagName', el.tagName.toLowerCase());
    setState('previewL3.selectedAttributes', this.getAttributes(el));
    setState('previewL3.selectedStyles', this.getRelevantStyles(el));
    setState('previewL3.selectedRect', el.getBoundingClientRect());
    setState('previewL3.breadcrumb', this.buildBreadcrumb(el));

    this.updateBreadcrumb();
    this.updatePropertiesPanel();
  }

  // --- Text node helpers ---

  /**
   * Encontra o text node mais próximo do ponto de clique e o offset do cursor.
   */
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

    // Fallback: primeiro text node direto do elemento com conteúdo
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
   */
  private enableTextEdit(selectableEl: HTMLElement, textNode: Text, caretOffset: number = 0) {
    const oldText = (textNode.textContent || '').trim();
    if (!oldText) return;

    const editSpan = document.createElement('span');
    editSpan.classList.add('l3-control', 'l3-edit-span');
    editSpan.contentEditable = 'true';
    editSpan.textContent = textNode.textContent;

    textNode.parentNode?.replaceChild(editSpan, textNode);
    editSpan.focus();

    // Posiciona o cursor no ponto do clique
    const spanTextNode = editSpan.firstChild;
    if (spanTextNode && spanTextNode.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      const clampedOffset = Math.min(caretOffset, (spanTextNode.textContent || '').length);
      range.setStart(spanTextNode, clampedOffset);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const onBlur = () => {
      const newText = (editSpan.textContent || '').trim();

      // Restaura text node
      const newTextNode = document.createTextNode(editSpan.textContent || '');
      editSpan.parentNode?.replaceChild(newTextNode, editSpan);

      setState('previewL3.editMode', 'select');

      if (newText !== oldText) {
        this.applyTextEditToSource(oldText, newText, selectableEl);
      }

      editSpan.removeEventListener('blur', onBlur);
      editSpan.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editSpan.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        editSpan.textContent = textNode.textContent;
        editSpan.blur();
      }
    };

    editSpan.addEventListener('blur', onBlur);
    editSpan.addEventListener('keydown', onKeydown);
  }

  private applyTextEditToSource(oldText: string, newText: string, el: HTMLElement) {
    const pageComponent = this.findPageComponent();
    if (!pageComponent) return;

    const tsModel = this.getPageTsModel(pageComponent);
    if (!tsModel) return;

    const source = tsModel.model.getValue();

    const expressionIndex = this.getExpressionIndex(el, pageComponent);

    const templateMap = buildTemplateMap(source);

    let origin;

    if (expressionIndex >= 0 && expressionIndex < templateMap.length) {
      origin = findTextOriginByIndex(oldText, source, expressionIndex);
    } else {
      origin = findTextOrigin(oldText, source);
    }

    if (origin.type === 'dynamic') return;

    const lang = getState('preview.language') || 'en';
    const result = applyTextEdit(origin, newText, source, lang);

    if (!result.success || !result.newSource) return;

    tsModel.model.pushEditOperations(
      [],
      [{
        range: tsModel.model.getFullModelRange(),
        text: result.newSource,
      }],
      () => null,
    );
  }

  /**
   * Calcula o índice da expressão ${...} no template.
   * Conta apenas text nodes precedidos por Lit comment marker <!--?lit$...-->
   */
  private getExpressionIndex(targetEl: HTMLElement, pageTag: string): number {
    const pageEl = this.querySelector(pageTag);
    if (!pageEl) return -1;

    const litTextNodes: { textNode: Text; parentEl: HTMLElement }[] = [];

    const walker = document.createTreeWalker(
      pageEl,
      NodeFilter.SHOW_ALL,
      null,
    );

    let node: Node | null = walker.firstChild();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim()) {
        const prev = node.previousSibling;
        if (prev && prev.nodeType === Node.COMMENT_NODE) {
          const comment = (prev as Comment).data;
          if (comment.startsWith('?lit$')) {
            litTextNodes.push({
              textNode: node as Text,
              parentEl: node.parentElement as HTMLElement,
            });
          }
        }
      }
      node = walker.nextNode();
    }

    for (let i = 0; i < litTextNodes.length; i++) {
      const { parentEl } = litTextNodes[i];
      if (parentEl === targetEl || targetEl.contains(parentEl)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Encontra o primeiro custom element filho que é o componente da página.
   */
  private findPageComponent(): string | null {
    for (const child of Array.from(this.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag.includes('-') && !child.classList.contains('l3-control') && tag !== 'preview-editor-l3-102020') {
        return tag;
      }
    }
    return null;
  }

  /**
   * Busca o model .ts do componente da página via mls.editor.models.
   */
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

  // --- Breadcrumb ---

  private updateBreadcrumb() {
    const breadcrumb = getState('previewL3.breadcrumb') || [];
    if (breadcrumb.length === 0) {
      this.breadcrumbEl.innerHTML = '';
      this.breadcrumbElements.clear();
      return;
    }

    let current: HTMLElement | null = this.selectedElementRef;
    const elements: HTMLElement[] = [];

    while (current && current !== this) {
      elements.unshift(current);
      current = current.parentElement;
    }

    this.breadcrumbElements.clear();

    this.breadcrumbEl.innerHTML = elements.map((el, i) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.classList.length > 0 ? `.${Array.from(el.classList).filter(c => !c.startsWith('l3-')).slice(0, 1).join('.')}` : '';
      const label = `${tag}${id}${cls}`;
      const crumbId = `l3-crumb-${i}`;
      const isLast = i === elements.length - 1;
      const separator = i < elements.length - 1 ? '<span class="l3-separator"> › </span>' : '';

      this.breadcrumbElements.set(crumbId, el);

      return `<span class="l3-crumb ${isLast ? 'active' : ''}" data-crumb-id="${crumbId}">${label}</span>${separator}`;
    }).join('');
  }

  // --- Painel de propriedades ---

  private showPropertiesPanel() {
    this.propertiesPanelEl.classList.add('open');
    this.updatePropertiesPanel();
  }

  private hidePropertiesPanel() {
    this.propertiesPanelEl.classList.remove('open');
    this.propertiesPanelEl.innerHTML = `<div class="l3-panel-empty">${this.msg.noSelection}</div>`;
  }

  private updatePropertiesPanel() {
    const selector = getState('previewL3.selectedElement');
    if (!selector || !this.selectedElementRef) {
      this.hidePropertiesPanel();
      return;
    }

    const tagName = getState('previewL3.selectedTagName') || '';
    const attributes = getState('previewL3.selectedAttributes') || {};
    const styles = getState('previewL3.selectedStyles') || {};

    let html = '';

    html += `<div class="l3-panel-tag">&lt;${tagName}&gt;</div>`;

    const attrEntries = Object.entries(attributes);
    if (attrEntries.length > 0) {
      html += `<div class="l3-panel-section">`;
      html += `<div class="l3-panel-section-title">${this.msg.attributes}</div>`;
      for (const [key, value] of attrEntries) {
        html += `<div class="l3-panel-row">
          <span class="l3-panel-key">${key}</span>
          <span class="l3-panel-value" title="${value}">${value}</span>
        </div>`;
      }
      html += `</div>`;
    }

    const styleEntries = Object.entries(styles);
    if (styleEntries.length > 0) {
      html += `<div class="l3-panel-section">`;
      html += `<div class="l3-panel-section-title">${this.msg.computedStyles}</div>`;
      for (const [key, value] of styleEntries) {
        html += `<div class="l3-panel-row">
          <span class="l3-panel-key">${key}</span>
          <span class="l3-panel-value" title="${value}">${value}</span>
        </div>`;
      }
      html += `</div>`;
    }

    if (this.selectedElementRef) {
      const cs = getComputedStyle(this.selectedElementRef);
      html += `<div class="l3-panel-section">`;
      html += `<div class="l3-panel-section-title">Box Model</div>`;
      html += `<div class="l3-panel-row"><span class="l3-panel-key">margin</span><span class="l3-panel-value">${cs.margin}</span></div>`;
      html += `<div class="l3-panel-row"><span class="l3-panel-key">padding</span><span class="l3-panel-value">${cs.padding}</span></div>`;
      html += `<div class="l3-panel-row"><span class="l3-panel-key">border</span><span class="l3-panel-value">${cs.border}</span></div>`;
      html += `<div class="l3-panel-row"><span class="l3-panel-key">size</span><span class="l3-panel-value">${cs.width} × ${cs.height}</span></div>`;
      html += `</div>`;
    }

    this.propertiesPanelEl.innerHTML = html;
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

  private buildBreadcrumb(el: HTMLElement): string[] {
    const path: string[] = [];
    let current: HTMLElement | null = el;
    while (current && current !== this) {
      const tag = current.tagName.toLowerCase();
      const id = current.id ? `#${current.id}` : '';
      path.unshift(`${tag}${id}`);
      current = current.parentElement;
    }
    return path;
  }

  private getAttributes(el: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-l3-')) continue;
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  private getRelevantStyles(el: HTMLElement): Record<string, string> {
    const cs = getComputedStyle(el);
    const props = [
      'display', 'position', 'width', 'height',
      'color', 'background-color', 'font-size', 'font-family',
      'flex-direction', 'justify-content', 'align-items',
      'gap', 'overflow', 'opacity', 'z-index',
    ];
    const styles: Record<string, string> = {};
    for (const p of props) {
      const val = cs.getPropertyValue(p);
      if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px') {
        styles[p] = val;
      }
    }
    return styles;
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