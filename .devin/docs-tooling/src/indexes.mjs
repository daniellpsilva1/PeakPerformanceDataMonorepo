// indexes.mjs — Generate and validate document catalogs.
// A catalog is a deterministic JSON record of all managed documents in a repo.
// The catalog is generated from source inputs and must be byte-stable for the
// same inputs. It does NOT embed the current HEAD commit to avoid self-reference drift.
import { createHash } from 'node:crypto';
import { validateCatalog } from './config.mjs';

const GENERATOR_VERSION = '0.1.0';

/**
 * Generate a catalog from discovered and parsed documents.
 * @param {object} opts - { repoId, documents, inputDigest }
 * @returns {object} - Catalog object matching catalog.schema.json.
 */
export function generateCatalog({ repoId, documents, inputDigest }) {
  const catalogDocs = documents
    .filter((d) => d.hasFrontmatter && d.frontmatter.id)
    .map((d) => ({
      id: d.frontmatter.id,
      title: d.frontmatter.title || '',
      path: d.path,
      type: d.frontmatter.type || '',
      status: d.frontmatter.status || '',
      owner: d.frontmatter.owner || '',
      visibility: d.frontmatter.visibility || '',
      summary: d.frontmatter.summary || '',
      domain_tags: d.frontmatter.domain_tags || [],
      source_refs: d.frontmatter.source_refs || [],
      related: d.frontmatter.related || [],
      content_digest: d.contentDigest,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const catalog = {
    schema_version: 1,
    repo_id: repoId,
    documents: catalogDocs,
    generator_version: GENERATOR_VERSION,
    input_digest: inputDigest,
  };

  return catalog;
}

/**
 * Compute a deterministic input digest from discovered file paths and content digests.
 * @param {array} documents - Documents from collectDocuments.
 * @returns {string} - SHA-256 hex digest (first 16 chars).
 */
export function computeInputDigest(documents) {
  const sorted = [...documents].sort((a, b) => a.path.localeCompare(b.path));
  const input = sorted.map((d) => `${d.path}:${d.contentDigest || ''}`).join('\n');
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Compare a generated catalog with a committed catalog.
 * @param {object} generated - Generated catalog.
 * @param {object} committed - Committed catalog from disk.
 * @returns {object} - { match: boolean, differences: [{type, detail}] }
 */
export function compareCatalogs(generated, committed) {
  const differences = [];

  // Validate both catalogs.
  const genResult = validateCatalog(generated);
  if (!genResult.valid) {
    differences.push({ type: 'generated-invalid', detail: genResult.errors });
  }

  const comResult = validateCatalog(committed);
  if (!comResult.valid) {
    differences.push({ type: 'committed-invalid', detail: comResult.errors });
  }

  // Compare input digest.
  if (generated.input_digest !== committed.input_digest) {
    differences.push({
      type: 'input-digest-mismatch',
      detail: `generated=${generated.input_digest} committed=${committed.input_digest}`,
    });
  }

  // Compare document counts.
  if (generated.documents.length !== committed.documents.length) {
    differences.push({
      type: 'count-mismatch',
      detail: `generated=${generated.documents.length} committed=${committed.documents.length}`,
    });
  }

  // Compare individual documents by ID.
  const genMap = new Map(generated.documents.map((d) => [d.id, d]));
  const comMap = new Map(committed.documents.map((d) => [d.id, d]));

  for (const [id, genDoc] of genMap) {
    const comDoc = comMap.get(id);
    if (!comDoc) {
      differences.push({ type: 'missing-in-committed', detail: id });
    } else {
      if (genDoc.path !== comDoc.path) {
        differences.push({ type: 'path-mismatch', detail: `${id}: ${genDoc.path} vs ${comDoc.path}` });
      }
      if (genDoc.status !== comDoc.status) {
        differences.push({ type: 'status-mismatch', detail: `${id}: ${genDoc.status} vs ${comDoc.status}` });
      }
      if (genDoc.content_digest !== comDoc.content_digest) {
        differences.push({ type: 'content-digest-mismatch', detail: `${id}: ${genDoc.content_digest} vs ${comDoc.content_digest}` });
      }
    }
  }

  for (const [id] of comMap) {
    if (!genMap.has(id)) {
      differences.push({ type: 'missing-in-generated', detail: id });
    }
  }

  return { match: differences.length === 0, differences };
}

/**
 * Serialize a catalog to deterministic JSON (sorted keys, stable formatting).
 * @param {object} catalog - Catalog object.
 * @returns {string} - Deterministic JSON string.
 */
export function serializeCatalog(catalog) {
  return JSON.stringify(catalog, null, 2) + '\n';
}

export { GENERATOR_VERSION };
