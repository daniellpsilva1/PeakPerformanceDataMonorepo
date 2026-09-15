// policy.mjs — Policy distribution bundle management.
// Manages the .devin/docs-policy/ distribution bundle for child repos.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Default files included in the policy distribution bundle.
 * These are the shared files copied to each child repo's .devin/docs-policy/.
 */
export const DEFAULT_POLICY_FILES = [
  'docs/governance/documentation-standard.md',
  'docs/governance/sdlc.md',
  'docs/governance/evidence-and-traceability.md',
  'docs/governance/maintenance.md',
];

/**
 * Compute SHA-256 digest of a file.
 * @param {string} filePath
 * @returns {string}
 */
export function computeFileDigest(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Build a distribution manifest for the policy bundle.
 * @param {string} repoRoot
 * @param {Array} files - List of source file paths relative to repoRoot
 * @returns {object}
 */
export function buildDistributionManifest(repoRoot, files = DEFAULT_POLICY_FILES) {
  const entries = [];
  for (const file of files) {
    const fullPath = resolve(repoRoot, file);
    if (!existsSync(fullPath)) {
      entries.push({ path: file, missing: true });
      continue;
    }
    entries.push({
      path: file,
      sha256: computeFileDigest(fullPath),
      size: readFileSync(fullPath).length,
    });
  }
  return {
    schema_version: 1,
    bundle_type: 'docs-policy',
    files: entries,
  };
}

/**
 * Write a distribution manifest to disk.
 * @param {string} repoRoot
 * @param {object} manifest
 * @param {string} outputPath
 */
export function writeDistributionManifest(repoRoot, manifest, outputPath) {
  const fullOutput = resolve(repoRoot, outputPath);
  const dir = resolve(fullOutput, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fullOutput, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * Validate a distribution manifest against actual files.
 * @param {string} repoRoot
 * @param {object} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDistribution(repoRoot, manifest) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.files)) {
    return { valid: false, errors: ['Invalid manifest format'] };
  }
  for (const entry of manifest.files) {
    if (entry.missing) {
      errors.push(`Missing file: ${entry.path}`);
      continue;
    }
    const fullPath = resolve(repoRoot, entry.path);
    if (!existsSync(fullPath)) {
      errors.push(`File not found: ${entry.path}`);
      continue;
    }
    const actualDigest = computeFileDigest(fullPath);
    if (actualDigest !== entry.sha256) {
      errors.push(`Digest mismatch: ${entry.path}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
