// references.mjs — Validate source_refs in document frontmatter.
// A source_ref points to a real source file with an optional symbol and revision.
// This module validates that the file exists and optionally that the symbol is present.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Validate a single source_ref object.
 * @param {object} ref - { path, repo_id, revision, symbol? }
 * @param {object} opts - { repoRoot, repoId, knownRepos }
 * @returns {object} - { valid, ref, errors }
 */
export function validateSourceRef(ref, opts) {
  const errors = [];
  const { repoRoot, repoId, knownRepos } = opts;

  if (!ref || typeof ref !== 'object') {
    return { valid: false, ref, errors: ['source_ref must be an object'] };
  }

  if (!ref.path) {
    errors.push('source_ref.path is required');
  }

  if (!ref.repo_id) {
    errors.push('source_ref.repo_id is required');
  }

  if (errors.length > 0) {
    return { valid: false, ref, errors };
  }

  // Resolve the file path. If repo_id matches the current repo, resolve relative to repoRoot.
  // If repo_id is different, we can only validate the structure, not the file existence
  // (cross-repo refs require the submodule to be checked out).
  let filePath;
  let fileExists = false;
  let crossRepo = ref.repo_id !== repoId;

  if (crossRepo) {
    // Cross-repo reference: check if the submodule is checked out.
    // Submodule path convention: PeakPerformanceData/<repo_dir> or PeakPerformanceDataMarketing/<repo_dir>
    const repoInfo = knownRepos?.repositories?.find((r) => r.id === ref.repo_id);
    if (!repoInfo) {
      errors.push(`source_ref.repo_id '${ref.repo_id}' not found in repository catalog`);
    } else if (repoInfo.occurrences && repoInfo.occurrences.length > 0) {
      // Try the first occurrence path
      const occurrence = repoInfo.occurrences[0];
      filePath = resolve(repoRoot, occurrence.path, ref.path);
      fileExists = existsSync(filePath);
      if (!fileExists) {
        errors.push(`source_ref file not found (cross-repo, submodule may not be checked out): ${ref.path} in ${ref.repo_id}`);
      }
    }
  } else {
    // Same-repo reference: resolve relative to repoRoot.
    filePath = resolve(repoRoot, ref.path);
    fileExists = existsSync(filePath);
    if (!fileExists) {
      errors.push(`source_ref file not found: ${ref.path}`);
    }
  }

  // Validate symbol if present and file exists.
  if (ref.symbol && fileExists && filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      if (!content.includes(ref.symbol)) {
        errors.push(`source_ref symbol '${ref.symbol}' not found in ${ref.path}`);
      }
    } catch {
      errors.push(`source_ref file could not be read: ${ref.path}`);
    }
  }

  // Revision is optional but recommended.
  if (!ref.revision) {
    // Warning, not error.
  }

  return { valid: errors.length === 0, ref, errors };
}

/**
 * Validate all source_refs in a document.
 * @param {object} doc - Document with frontmatter.source_refs
 * @param {object} opts - { repoRoot, repoId, knownRepos }
 * @returns {object} - { valid, results }
 */
export function validateSourceRefs(doc, opts) {
  const refs = doc.frontmatter?.source_refs || [];
  const results = refs.map((ref) => validateSourceRef(ref, opts));
  const valid = results.every((r) => r.valid);
  return { valid, results };
}

/**
 * Generate a static API/migration inventory from source files.
 * This is a read-only scan that produces a JSON inventory.
 * @param {object} opts - { repoRoot, patterns }
 * @returns {object} - Inventory object.
 */
export function generateInventory({ repoRoot, patterns = {} }) {
  const inventory = {
    routes: [],
    migrations: [],
    schemas: [],
    generated_at: new Date().toISOString(),
  };

  // This is a stub — full implementation would scan route files and migrations.
  // For now, it returns an empty inventory structure.

  return inventory;
}
