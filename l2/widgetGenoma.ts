/// <mls fileReference="_102020_/l2/widgetGenoma.ts" enhancement="_102020_/l2/enhancementAura.ts"/>

import { html, TemplateResult, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { mutationGroups, renderIcon } from '/_102020_/l2/molecules/index.js';
import { MutationGroupEntry, SkillCategory } from '/_102020_/l2/molecules/index.js';
import { convertFileToTag, resolveTagToFile } from '/_102020_/l2/utils.js';
import '/_102027_/l2/collabSelectKnob.js';


// =============================================================================
// WIDGET GENOMA — Mutation Testing Service
// =============================================================================
// Two views in one service:
//   1. Group Selection Grid — pick a skill group
//   2. Knob View — rotate between widgets of the selected group

@customElement('widget-genoma-102020')
export class WidgetGenoma102020 extends StateLitElement {

    // =========================================================================
    // STATE
    // =========================================================================

    @state() private currentView: 'grid' | 'knob' = 'grid';
    @state() private selectedGroup: MutationGroupEntry | null = null;
    @state() private knobIndex: number = 0;
    @state() private filterCategory: SkillCategory | '' = '';

    // Map: group name → tag strings[]
    private groupWidgetTags: Map<string, string[]> = new Map();

    // Track which widget tags have already been imported
    private importedTags: Set<string> = new Set();

    // =========================================================================
    // CATEGORY METADATA
    // =========================================================================

    private categoryMeta: Record<SkillCategory, { label: string; color: string }> = {
        dataEntry: { label: 'Data Entry', color: 'sky' },
        dataDiscovery: { label: 'Data Discovery', color: 'amber' },
        dataDisplay: { label: 'Data Display', color: 'emerald' },
        actions: { label: 'Actions', color: 'rose' },
        navigation: { label: 'Navigation', color: 'violet' },
        feedback: { label: 'Feedback', color: 'orange' },
        identity: { label: 'Identity', color: 'teal' },
    };

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    connectedCallback() {
        super.connectedCallback();
        this.buildGroupWidgetTags();
    }

    // =========================================================================
    // BUILD GROUP → TAGS MAP
    // =========================================================================

    private buildGroupWidgetTags() {
        const files = Object.values(mls.stor.files) as mls.stor.IFileInfo[];

        const htmlFiles = files.filter(
            (file) => file.extension === '.html' && file.folder.startsWith('molecules') && file.shortName !== 'index'
        );

            // Group files by folder (without 'molecules/' prefix, lowercased)
        const folderMap = new Map<string, mls.stor.IFileInfo[]>();
        for (const file of htmlFiles) {
            const folderKey = file.folder.replace(/^molecules\//, '').toLowerCase();
            if (!folderMap.has(folderKey)) {
                folderMap.set(folderKey, []);
            }
            folderMap.get(folderKey)!.push(file);
        }

        // Match each mutation group to its files
        for (const group of mutationGroups) {
            const groupKey = group.name.toLowerCase();
            const matchedFiles = folderMap.get(groupKey) || [];
            const tags = matchedFiles.map((file) => convertFileToTag(file));
            this.groupWidgetTags.set(group.name, tags);
        }
    }

    // =========================================================================
    // NAVIGATION
    // =========================================================================

    private async handleGroupSelect(group: MutationGroupEntry) {
        const tags = this.groupWidgetTags.get(group.name) || [];
        this.selectedGroup = group;
        this.knobIndex = 0;
        this.currentView = 'knob';

        // Import and render first widget
        if (tags.length > 0) {
            await this.importAndRenderWidget(0);
        }
    }

    private handleBackToGrid() {
        this.currentView = 'grid';
        this.selectedGroup = null;
        this.knobIndex = 0;
        this.importedTags.clear();
    }

    // =========================================================================
    // WIDGET IMPORT + RENDER
    // =========================================================================

    private async importAndRenderWidget(index: number) {
        if (!this.selectedGroup) return;
        const tags = this.groupWidgetTags.get(this.selectedGroup.name) || [];
        const tag = tags[index];
        if (!tag) return;

        // Import molecule if not already registered
        if (!this.importedTags.has(tag)) {
            try {
                const info = resolveTagToFile(tag);
                if (!info) throw new Error('Invalid import');
                await import(`/_${info.project}_/l2/${info.folder ? info.folder + '/' : ''}${info.shortName}.js`);
                this.importedTags.add(tag);
            } catch (e) {
                console.error('Failed to import molecule:', tag, e);
            }
        }

        // Inject demo HTML into container
        this.updateDemoContainer();
    }

    private updateDemoContainer() {
        if (!this.selectedGroup) return;
        const tags = this.groupWidgetTags.get(this.selectedGroup.name) || [];
        const tag = tags[this.knobIndex];
        if (!tag) return;

        const demo = this.selectedGroup.demo;
        const demoHtml = demo.replace(/molecule-for-replace/g, tag);
        const container = this.querySelector('#mutation-demo-container');
        if (container) {
            container.innerHTML = demoHtml;
        }
    }

    // =========================================================================
    // KNOB HANDLERS
    // =========================================================================

    private async handleKnobChange(e: CustomEvent) {
        if (!this.selectedGroup) return;
        const tags = this.groupWidgetTags.get(this.selectedGroup.name) || [];
        const newIndex = e.detail.value;
        if (newIndex === null || newIndex < 0 || newIndex >= tags.length) return;
        this.knobIndex = newIndex;
        await this.importAndRenderWidget(this.knobIndex);
    }

    private async handlePillClick(index: number) {
        this.knobIndex = index;
        await this.importAndRenderWidget(index);
    }

    // =========================================================================
    // FILTER
    // =========================================================================

    private handleFilterChange(category: SkillCategory | '') {
        this.filterCategory = category;
    }

    private getFilteredGroups(): MutationGroupEntry[] {
        if (!this.filterCategory) return mutationGroups;
        return mutationGroups.filter(g => g.category === this.filterCategory);
    }

    private getActiveCategories(): SkillCategory[] {
        const cats = new Set(mutationGroups.map(g => g.category));
        return Array.from(cats) as SkillCategory[];
    }

    // =========================================================================
    // RENDER — MAIN
    // =========================================================================

    render() {
        return html`
            <div class="genoma-root">
                ${this.currentView === 'grid'
                ? this.renderGridView()
                : this.renderKnobView()
            }
            </div>
        `;
    }

    // =========================================================================
    // RENDER — GRID VIEW
    // =========================================================================

    private renderGridView(): TemplateResult {
        const groups = this.getFilteredGroups();
        const activeCategories = this.getActiveCategories();

        return html`
            <div class="genoma-grid-view">

                <div class="genoma-header">
                    <h1 class="genoma-title">Molecule Mutations</h1>
                    <p class="genoma-subtitle">Select a skill group to explore widget variations</p>
                </div>

                <div class="genoma-filters">
                    <button
                        class="genoma-filter-chip ${this.filterCategory === '' ? 'active' : ''}"
                        @click=${() => this.handleFilterChange('')}>
                        All
                    </button>
                    ${activeCategories.map(cat => html`
                        <button
                            class="genoma-filter-chip ${this.filterCategory === cat ? 'active' : ''}"
                            @click=${() => this.handleFilterChange(cat)}>
                            ${this.categoryMeta[cat].label}
                        </button>
                    `)}
                </div>

                <div class="genoma-card-grid">
                    ${groups.map(group => this.renderGroupCard(group))}
                </div>
            </div>
        `;
    }

    private renderGroupCard(group: MutationGroupEntry): TemplateResult {
        const meta = this.categoryMeta[group.category];
        const iconSvg = renderIcon(group.icon, 28);
        const tags = this.groupWidgetTags.get(group.name) || [];

        return html`
            <div class="genoma-card" @click=${() => this.handleGroupSelect(group)}>
                <div class="genoma-card-icon">
                    ${unsafeHTML(iconSvg)}
                </div>
                <div class="genoma-card-body">
                    <div class="genoma-card-label">${group.label}</div>
                    <div class="genoma-card-desc">${group.shortDescription}</div>
                </div>
                <div class="genoma-card-footer">
                    <span class="genoma-card-badge">${meta.label}</span>
                    ${tags.length > 0 ? html`
                        <span class="genoma-card-count">${tags.length}</span>
                    ` : nothing}
                </div>
            </div>
        `;
    }

    // =========================================================================
    // RENDER — KNOB VIEW
    // =========================================================================

    private renderKnobView(): TemplateResult {
        if (!this.selectedGroup) return html`${nothing}`;

        const tags = this.groupWidgetTags.get(this.selectedGroup.name) || [];
        const total = tags.length;
        const currentTag = tags[this.knobIndex];

        return html`
            <div class="genoma-knob-view">

                <div class="genoma-topbar">
                    <button class="genoma-back-btn" @click=${this.handleBackToGrid}>
                        ${unsafeHTML(renderIcon('<path d="M19 12H5M12 19l-7-7 7-7"/>', 18))}
                        Back
                    </button>
                    <div class="genoma-topbar-title">
                        <span class="genoma-topbar-group">${this.selectedGroup.label}</span>
                        ${currentTag ? html`
                            <span class="genoma-topbar-sep">→</span>
                            <span class="genoma-topbar-widget">${currentTag}</span>
                        ` : nothing}
                    </div>
                    <div class="genoma-topbar-counter">
                        ${total > 0 ? html`${this.knobIndex + 1} / ${total}` : nothing}
                    </div>
                </div>

                ${total === 0 ? html`
                    <div class="genoma-empty">
                        <p>No widgets found for this group.</p>
                        <button class="genoma-back-link" @click=${this.handleBackToGrid}>
                            ← Back to groups
                        </button>
                    </div>
                ` : html`
                    <div class="genoma-knob-layout">

                        <div class="genoma-knob-control">
                            <collab-select-knob-102027
                                .min=${0}
                                .max=${total - 1}
                                .value=${this.knobIndex}
                                .step=${1}
                                selected
                                @knob-change=${this.handleKnobChange}>
                            </collab-select-knob-102027>
                        </div>

                        ${currentTag ? html`
                            <div class="genoma-widget-info">
                                <div class="genoma-widget-tag">&lt;${currentTag}&gt;</div>
                            </div>
                        ` : nothing}

                        <div class="genoma-demo-area">
                            <div class="genoma-demo-label">Preview</div>
                            <div id="mutation-demo-container" class="genoma-demo-container">
                            </div>
                        </div>

                        <div class="genoma-widget-list">
                            ${tags.map((tag, i) => html`
                                <button
                                    class="genoma-widget-pill ${i === this.knobIndex ? 'active' : ''}"
                                    @click=${() => this.handlePillClick(i)}>
                                    ${tag}
                                </button>
                            `)}
                        </div>

                    </div>
                `}
            </div>
        `;
    }
}
