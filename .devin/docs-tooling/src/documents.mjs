// documents.mjs — Parse Markdown files, extract frontmatter, and validate metadata.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { validateDocument } from './config.mjs';
import { createHash } from 'node:crypto';

/**
 * Parse a Markdown file and extract its frontmatter metadata + body.
 * @param {string} filePath - Absolute or repo-relative path to the Markdown file.
 * @param {string} repoRoot - Repository root for resolving relative paths.
 * @returns {object} - { path, frontmatter, body, hasFrontmatter, errors }
 */
export function parseDocument(filePath, repoRoot) {
  const absPath = resolve(repoRoot, filePath);
  let raw;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch {
    return { path: filePath, frontmatter: null, body: null, hasFrontmatter: false, errors: [`Cannot read file: ${filePath}`] };
  }

  const parsed = matter(raw, { engines: { yaml: { parse: safeYamlParse, stringify: () => '' } } });
  const hasFrontmatter = parsed.data && Object.keys(parsed.data).length > 0;

  const contentDigest = createHash('sha256').update(raw).digest('hex').slice(0, 16);

  return {
    path: filePath,
    frontmatter: parsed.data || {},
    body: parsed.content || '',
    hasFrontmatter,
    contentDigest,
    errors: [],
  };
}

/**
 * Validate a parsed document's frontmatter against the document schema.
 * @param {object} doc - Parsed document from parseDocument.
 * @returns {object} - { valid, errors }
 */
export function validateDocMetadata(doc) {
  if (!doc.hasFrontmatter) {
    return { valid: false, errors: ['No frontmatter found'] };
  }
  const result = validateDocument(doc.frontmatter);
  return result;
}

/**
 * Check for supersession consistency: a superseded document must have a superseded_by field.
 * @param {object} doc - Parsed document.
 * @returns {object} - { valid, errors }
 */
export function checkSupersession(doc) {
  const errors = [];
  if (doc.frontmatter?.status === 'superseded' && !doc.frontmatter?.superseded_by) {
    errors.push('Superseded document must have superseded_by field');
  }
  if (doc.frontmatter?.status === 'accepted' && !doc.frontmatter?.approval_ref && !doc.frontmatter?.last_reviewed) {
    errors.push('Accepted document should have approval_ref or last_reviewed');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Collect all managed documents in a repository, parse and validate them.
 * @param {object} opts - { repoRoot, manifest, discovered }
 * @returns {object} - { documents: [{path, frontmatter, valid, errors}], summary }
 */
export function collectDocuments({ repoRoot, manifest, discovered }) {
  const documents = [];
  const managed = discovered?.managed || [];

  for (const entry of managed) {
    const doc = parseDocument(entry.path, repoRoot);
    const metaResult = validateDocMetadata(doc);
    const supersessionResult = checkSupersession(doc);

    documents.push({
      path: entry.path,
      tracked: entry.tracked,
      frontmatter: doc.frontmatter,
      hasFrontmatter: doc.hasFrontmatter,
      contentDigest: doc.contentDigest,
      valid: metaResult.valid,
      errors: [...doc.errors, ...metaResult.errors, ...supersessionResult.errors],
    });
  }

  const summary = {
    total: documents.length,
    withFrontmatter: documents.filter((d) => d.hasFrontmatter).length,
    valid: documents.filter((d) => d.valid).length,
    invalid: documents.filter((d) => !d.valid).length,
  };

  return { documents, summary };
}

/**
 * Detect duplicate document IDs within the same repository.
 * @param {array} documents - Documents from collectDocuments.
 * @returns {array} - [{ id, paths }] for each duplicate ID.
 */
export function findDuplicateIds(documents) {
  const idMap = new Map();
  for (const doc of documents) {
    const id = doc.frontmatter?.id;
    if (!id) continue;
    if (!idMap.has(id)) {
      idMap.set(id, []);
    }
    idMap.get(id).push(doc.path);
  }
  const duplicates = [];
  for (const [id, paths] of idMap) {
    if (paths.length > 1) {
      duplicates.push({ id, paths });
    }
  }
  return duplicates;
}

// Use the yaml library for safe parsing instead of gray-matter's default.
import YAML from 'yaml';

function safeYamlParse(str) {
  // Use YAML.parse with safe options — no custom tags, no unsafe constructors.
  return YAML.parse(str, { schema: 'core', strict: true });
}
