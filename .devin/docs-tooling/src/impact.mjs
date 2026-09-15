// impact.mjs — Doc-impact analysis.
// Maps changed source paths to documentation obligations.
// Advisory initially; does not fail builds unless explicitly configured.
import { getChangedFiles, getMergeBase } from './git.mjs';

/**
 * Default source-to-doc mapping rules.
 * Each rule: { pattern (regex), obligation (string), risk (low|medium|high) }
 */
export const DEFAULT_MAPPINGS = [
  // App identity/auth
  {
    pattern: /^src\/lib\/auth\/|^src\/middleware\//,
    obligation: 'Identity/access matrix, auth sequence, security cases',
    risk: 'high',
  },
  // App billing
  {
    pattern: /^src\/lib\/stripe\/|^src\/app\/api\/stripe\//,
    obligation: 'Billing/entitlement contract and failure/retry test plan',
    risk: 'high',
  },
  // App tennis
  {
    pattern: /^src\/lib\/tennis\/scorekeeper\/|^src\/app\/.*scorekeeper/,
    obligation: 'Match/sync states, data contract, offline QA',
    risk: 'medium',
  },
  // App AI
  {
    pattern: /^src\/lib\/ai\/|^src\/app\/api\/ai\//,
    obligation: 'Agent/tool contracts, persona/tenant scope and evaluation limits',
    risk: 'high',
  },
  // App wearables
  {
    pattern: /^src\/lib\/wearables\/|^src\/app\/api\/wearables\//,
    obligation: 'Wearable sync architecture, provider data model, BFF routes',
    risk: 'medium',
  },
  // Extraction
  {
    pattern: /^src\/api\/|^src\/openwearables\/|^src\/scheduler\//,
    obligation: 'Provider/API/data-flow/retention and operational docs',
    risk: 'medium',
  },
  // Backend
  {
    pattern: /^api\/routes\/|^api\/.*graph/,
    obligation: 'API inventory, graph contract and warehouse lineage',
    risk: 'medium',
  },
  // Vision
  {
    pattern: /^pipeline\/|^api\/|^db\//,
    obligation: 'Stage/state/model/data contracts',
    risk: 'medium',
  },
  // SwingVision
  {
    pattern: /^workers\/|^lib\/types\.ts/,
    obligation: 'State transitions, storage ownership, device/recovery guides',
    risk: 'medium',
  },
];

/**
 * Match a changed file path against mapping rules.
 * Returns all matching rules (not first-match-wins).
 * @param {string} filePath
 * @param {Array} mappings
 * @returns {Array}
 */
export function matchPath(filePath, mappings = DEFAULT_MAPPINGS) {
  return mappings.filter((m) => m.pattern.test(filePath));
}

/**
 * Analyze a diff for documentation impact.
 * @param {object} opts - { repoRoot, base, head, mappings }
 * @returns {object} - { complete, changedFiles, impacts, unmapped, advisory }
 */
export function analyzeImpact({ repoRoot, base, head, mappings = DEFAULT_MAPPINGS }) {
  const { files, complete } = getChangedFiles(repoRoot, base, head);

  if (!complete) {
    return {
      complete: false,
      changedFiles: [],
      impacts: [],
      unmapped: [],
      advisory: ['Insufficient git history to compute changes.'],
    };
  }

  const impacts = [];
  const unmapped = [];
  const seenObligations = new Set();

  for (const filePath of files) {
    const matches = matchPath(filePath, mappings);
    if (matches.length === 0) {
      unmapped.push(filePath);
    } else {
      for (const m of matches) {
        const key = `${m.obligation}::${filePath}`;
        if (!seenObligations.has(key)) {
          seenObligations.add(key);
          impacts.push({
            file: filePath,
            obligation: m.obligation,
            risk: m.risk,
          });
        }
      }
    }
  }

  // Check for gitlink changes (submodule pin updates).
  const gitlinkChanges = files.filter((f) =>
    f.startsWith('PeakPerformanceData/') ||
    f.startsWith('PeakPerformanceDataMarketing/')
  );

  const advisory = [];
  if (unmapped.length > 0) {
    advisory.push(`${unmapped.length} unmapped file(s) need triage.`);
  }
  if (gitlinkChanges.length > 0) {
    advisory.push('Gitlink changes detected: dependency-version changes require compatibility/integration review.');
  }

  return {
    complete: true,
    changedFiles: files,
    impacts,
    unmapped,
    gitlinkChanges,
    advisory,
  };
}

/**
 * Format an impact report for display.
 * @param {object} result - Result from analyzeImpact
 * @returns {string}
 */
export function formatImpactReport(result) {
  const lines = [];
  lines.push(`Impact analysis: ${result.complete ? 'complete' : 'incomplete'}`);
  lines.push(`Changed files: ${result.changedFiles.length}`);
  lines.push(`Documentation impacts: ${result.impacts.length}`);
  lines.push(`Unmapped files: ${result.unmapped.length}`);

  if (result.impacts.length > 0) {
    lines.push('');
    lines.push('Impacts:');
    for (const imp of result.impacts) {
      lines.push(`  [${imp.risk}] ${imp.file} -> ${imp.obligation}`);
    }
  }

  if (result.unmapped.length > 0 && result.unmapped.length <= 20) {
    lines.push('');
    lines.push('Unmapped (advisory triage):');
    for (const f of result.unmapped) {
      lines.push(`  ${f}`);
    }
  }

  if (result.advisory && result.advisory.length > 0) {
    lines.push('');
    lines.push('Advisory:');
    for (const a of result.advisory) {
      lines.push(`  ${a}`);
    }
  }

  return lines.join('\n');
}
