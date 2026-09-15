// report.mjs — Collect and format validation results into a structured report.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Build a complete check report for a repository.
 * @param {object} opts - { repoRoot, manifest, discovered, documents, linkResults, duplicates, catalogResult }
 * @returns {object} - Structured report with scope, complete, errors, warnings, skipped.
 */
export function buildReport({ repoRoot, manifest, discovered, documents, linkResults, duplicates, catalogResult }) {
  const errors = [];
  const warnings = [];
  const skipped = [];

  // Collect document metadata errors.
  for (const doc of documents.documents || []) {
    if (!doc.valid) {
      for (const err of doc.errors) {
        errors.push({ file: doc.path, type: 'metadata', message: err });
      }
    }
  }

  // Collect link errors.
  for (const linkResult of linkResults || []) {
    for (const broken of linkResult.broken || []) {
      errors.push({ file: linkResult.path, type: 'link', message: `${broken.reason}: ${broken.target} (line ${broken.line})` });
    }
  }

  // Collect duplicate ID errors.
  for (const dup of duplicates || []) {
    errors.push({ type: 'duplicate-id', message: `ID ${dup.id} appears in: ${dup.paths.join(', ')}` });
  }

  // Catalog comparison.
  if (catalogResult) {
    if (!catalogResult.match) {
      for (const diff of catalogResult.differences) {
        warnings.push({ type: `catalog-${diff.type}`, message: diff.detail });
      }
    }
  }

  // Determine completeness.
  const complete = skipped.length === 0;
  const result = errors.length === 0 ? 0 : 1;

  return {
    scope: manifest?.repo_id || 'unknown',
    complete,
    result,
    errors,
    warnings,
    skipped,
    tool_version: '0.1.0',
    summary: {
      total_docs: documents.summary?.total || 0,
      valid_docs: documents.summary?.valid || 0,
      invalid_docs: documents.summary?.invalid || 0,
      link_errors: (linkResults || []).reduce((n, lr) => n + (lr.broken?.length || 0), 0),
      duplicate_ids: (duplicates || []).length,
    },
  };
}

/**
 * Format a report for human-readable output.
 * @param {object} report - Report from buildReport.
 * @returns {string} - Formatted text.
 */
export function formatReport(report) {
  const lines = [];
  lines.push(`Documentation check: ${report.scope}`);
  lines.push(`Tool version: ${report.tool_version}`);
  lines.push(`Result: ${report.result === 0 ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(`Summary:`);
  lines.push(`  Total docs: ${report.summary.total_docs}`);
  lines.push(`  Valid: ${report.summary.valid_docs}`);
  lines.push(`  Invalid: ${report.summary.invalid_docs}`);
  lines.push(`  Link errors: ${report.summary.link_errors}`);
  lines.push(`  Duplicate IDs: ${report.summary.duplicate_ids}`);
  lines.push('');

  if (report.errors.length > 0) {
    lines.push('Errors:');
    for (const err of report.errors) {
      const loc = err.file ? ` [${err.file}]` : '';
      lines.push(`  ${err.type}${loc}: ${err.message}`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warn of report.warnings) {
      lines.push(`  ${warn.type}: ${warn.message}`);
    }
    lines.push('');
  }

  if (report.skipped.length > 0) {
    lines.push('Skipped:');
    for (const skip of report.skipped) {
      lines.push(`  ${skip.type}: ${skip.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the current git HEAD revision (for reporting, not for catalog embedding).
 * @param {string} repoRoot - Repository root.
 * @returns {string|null} - HEAD SHA or null if unavailable.
 */
export function getHeadRevision(repoRoot) {
  try {
    return execSync('git rev-parse HEAD', { cwd: resolve(repoRoot), encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
