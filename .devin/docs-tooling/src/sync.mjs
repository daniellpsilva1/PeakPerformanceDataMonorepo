// sync.mjs — Shared bundle sync to child repos.
// Updates only declared generated paths. Detects local edits and stops.
// Generates dry-run reports first. Does not overwrite local edits.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { computeFileDigest } from './policy.mjs';
import { getHeadRevision } from './git.mjs';

/**
 * Default sync targets: child repos that receive the docs-policy bundle.
 * Each entry: { repoId, path, files }
 */
export const DEFAULT_SYNC_TARGETS = [
  { repoId: 'app', path: 'PeakPerformanceData/peak_performance_data' },
  { repoId: 'backend', path: 'PeakPerformanceData/ppd_backend' },
  { repoId: 'extraction', path: 'PeakPerformanceData/ppd_extraction_backend' },
  { repoId: 'legacy-extraction', path: 'PeakPerformanceData/ppd_legacy_extraction_backend' },
  { repoId: 'vision', path: 'PeakPerformanceData/ppd_vision' },
  { repoId: 'agent', path: 'PeakPerformanceData/ppp_ai_agent' },
  { repoId: 'swingvision', path: 'PeakPerformanceData/swingvision-pipeline' },
  { repoId: 'courtviz', path: 'PeakPerformanceDataMarketing/courtviz' },
  { repoId: 'bodyviz', path: 'PeakPerformanceDataMarketing/bodyviz' },
  { repoId: 'academies', path: 'PeakPerformanceDataMarketing/academies' },
  { repoId: 'ai-videos', path: 'PeakPerformanceDataMarketing/ai-videos' },
  { repoId: 'manim', path: 'PeakPerformanceDataMarketing/manim' },
  { repoId: 'remotion', path: 'PeakPerformanceDataMarketing/remotion' },
  { repoId: 'research', path: 'PeakPerformanceData/ppd_research_papers' },
];

/**
 * Default files to sync to each child repo's .devin/docs-policy/.
 */
export const DEFAULT_SYNC_FILES = [
  'docs/governance/documentation-standard.md',
  'docs/governance/sdlc.md',
  'docs/governance/evidence-and-traceability.md',
  'docs/governance/maintenance.md',
];

/**
 * Check if a target file has local edits (differs from source).
 * @param {string} sourceRoot
 * @param {string} targetRoot
 * @param {string} relPath
 * @returns {{ exists: boolean, modified: boolean }}
 */
export function checkLocalEdits(sourceRoot, targetRoot, relPath) {
  const sourcePath = resolve(sourceRoot, relPath);
  const targetPath = resolve(targetRoot, '.devin/docs-policy', relPath);

  if (!existsSync(sourcePath)) {
    return { exists: false, modified: false };
  }
  if (!existsSync(targetPath)) {
    return { exists: false, modified: false };
  }

  const sourceDigest = computeFileDigest(sourcePath);
  const targetDigest = computeFileDigest(targetPath);
  return {
    exists: true,
    modified: sourceDigest !== targetDigest,
  };
}

/**
 * Dry-run sync: report what would be synced without writing.
 * @param {string} sourceRoot
 * @param {Array} targets - [{ repoId, path }]
 * @param {Array} files - [string]
 * @returns {object}
 */
export function dryRunSync(sourceRoot, targets = DEFAULT_SYNC_TARGETS, files = DEFAULT_SYNC_FILES) {
  const reports = [];
  for (const target of targets) {
    const targetRoot = resolve(sourceRoot, target.path);
    if (!existsSync(targetRoot)) {
      reports.push({
        repoId: target.repoId,
        path: target.path,
        status: 'missing',
        files: [],
      });
      continue;
    }
    const fileReports = [];
    for (const file of files) {
      const sourcePath = resolve(sourceRoot, file);
      if (!existsSync(sourcePath)) {
        fileReports.push({ file, status: 'source-missing' });
        continue;
      }
      const editCheck = checkLocalEdits(sourceRoot, targetRoot, file);
      if (editCheck.modified) {
        fileReports.push({ file, status: 'local-edits' });
      } else if (!editCheck.exists) {
        fileReports.push({ file, status: 'new' });
      } else {
        fileReports.push({ file, status: 'up-to-date' });
      }
    }
    reports.push({
      repoId: target.repoId,
      path: target.path,
      status: 'available',
      files: fileReports,
    });
  }
  return { dryRun: true, reports };
}

/**
 * Execute sync: write files to child repos.
 * Stops on local edits; does not overwrite.
 * @param {string} sourceRoot
 * @param {Array} targets
 * @param {Array} files
 * @returns {object}
 */
export function executeSync(sourceRoot, targets = DEFAULT_SYNC_TARGETS, files = DEFAULT_SYNC_FILES) {
  const results = [];
  let blocked = false;

  for (const target of targets) {
    const targetRoot = resolve(sourceRoot, target.path);
    if (!existsSync(targetRoot)) {
      results.push({ repoId: target.repoId, status: 'missing' });
      continue;
    }

    const fileResults = [];
    for (const file of files) {
      const sourcePath = resolve(sourceRoot, file);
      if (!existsSync(sourcePath)) {
        fileResults.push({ file, status: 'source-missing' });
        continue;
      }

      const editCheck = checkLocalEdits(sourceRoot, targetRoot, file);
      if (editCheck.modified) {
        fileResults.push({ file, status: 'blocked-local-edits' });
        blocked = true;
        continue;
      }

      const targetDir = resolve(targetRoot, '.devin/docs-policy', file, '..');
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      const targetPath = resolve(targetRoot, '.devin/docs-policy', file);
      copyFileSync(sourcePath, targetPath);
      fileResults.push({ file, status: 'synced' });
    }

    results.push({ repoId: target.repoId, status: 'done', files: fileResults });
  }

  return { executed: true, blocked, results };
}

/**
 * Format a sync report for display.
 * @param {object} report
 * @returns {string}
 */
export function formatSyncReport(report) {
  const lines = [];
  if (report.dryRun) {
    lines.push('Sync dry-run report:');
  } else {
    lines.push(`Sync report (blocked: ${report.blocked}):`);
  }

  const reports = report.reports || report.results || [];
  for (const r of reports) {
    lines.push(`  ${r.repoId} (${r.status || r.path}):`);
    if (r.files) {
      for (const f of r.files) {
        lines.push(`    ${f.status}: ${f.file}`);
      }
    }
  }

  return lines.join('\n');
}
