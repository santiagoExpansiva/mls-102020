/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionPlan.ts" enhancement="_blank"/>

export const PLAN_IDS = [
  'org-requirements',
  'org-planner',
  'org-materialization',
  'req-discover-scope',
  'req-clarification-answer',
  'req-recommend-implementations',
  'req-implementation-decisions',
  'plan-solution-blueprint',
  'plan-blueprint-review',
  'plan-finalize-solution-plan',
  'plan-mdm',
  'plan-horizontals',
  'plan-plugins',
  'plan-persistence-index',
  'plan-table-definition',
  'plan-metrics-index',
  'plan-metric-table-definition',
  'plan-usecase-entities',
  'plan-usecase-definition',
  'plan-workflow-index',
  'plan-workflow-definition',
  'plan-agents',
  'plan-page-index',
  'plan-page-definition',
  'plan-validate-solution-coverage',
  'final-resume',
] as const;

export type NewSolutionPlanId = typeof PLAN_IDS[number];

export interface InitialNewSolutionPlan {
  userLanguage: string;
  requestKind: 'module' | 'solution' | 'module_solution';
  moduleName: string;
  userPrompt: string;
  titles: Partial<Record<NewSolutionPlanId, string>>;
  todoItems: {
    planId: NewSolutionPlanId;
    done: boolean;
    title: string;
    description: string;
  }[];
  openDetails: {
    title: string;
    description: string;
  }[];
}

export function normalizeModuleFolderName(value: unknown, fallback: string = 'module'): string {
  const source = `${typeof value === 'string' && value.trim() ? value : fallback}` || 'module';
  const ascii = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  const words = ascii.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'module';

  const camel = words.map((word, index) => {
    const lower = word.toLowerCase();
    if (index === 0) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');

  const withoutLeadingDigits = camel.replace(/^[0-9]+/, '');
  return (withoutLeadingDigits || 'module').slice(0, 60);
}

function hasFolder(folders: Set<string>, folder: string): boolean {
  return folders.has(folder);
}

export function reserveModuleNameFromFolders(
  requestedName: unknown,
  fallbackPrompt: string,
  existingFolders: Iterable<string>,
): string {
  const folders = new Set(existingFolders);
  const baseName = normalizeModuleFolderName(requestedName, fallbackPrompt);

  if (!hasFolder(folders, baseName)) return baseName;

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName}${index}`;
    if (!hasFolder(folders, candidate)) return candidate;
  }

  throw new Error(`[reserveModuleNameFromFolders] no available folder name for ${baseName}`);
}

export function normalizeInitialPlan(
  result: InitialNewSolutionPlan,
  existingFolders: Iterable<string> = [],
): InitialNewSolutionPlan {
  if (!result || typeof result !== 'object') throw new Error('[normalizeInitialPlan] invalid result');
  if (!result.userLanguage || typeof result.userLanguage !== 'string') throw new Error('[normalizeInitialPlan] missing userLanguage');
  if (!['module', 'solution', 'module_solution'].includes(result.requestKind)) throw new Error(`[normalizeInitialPlan] invalid requestKind: ${result.requestKind}`);
  if (!result.userPrompt || typeof result.userPrompt !== 'string') throw new Error('[normalizeInitialPlan] missing userPrompt');
  result.moduleName = reserveModuleNameFromFolders(result.moduleName, result.userPrompt, existingFolders);
  if (!result.titles || typeof result.titles !== 'object') result.titles = {};
  if (!Array.isArray(result.todoItems)) result.todoItems = [];
  if (!Array.isArray(result.openDetails)) result.openDetails = [];
  return result;
}