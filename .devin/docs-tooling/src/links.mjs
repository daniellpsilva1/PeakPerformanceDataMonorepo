// links.mjs — Parse and validate internal Markdown links.
// Validates same-document anchors, same-repo file links, and cross-repo
// metadata references. External URLs are classified but not fetched.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join, normalize, relative } from 'node:path';

/**
 * Extract all Markdown links from a document body.
 * Supports: [text](url), [text][ref], [ref]: url, <url>, ![alt](url)
 * @param {string} body - Markdown body text.
 * @returns {array} - [{ type, target, text, line }]
 */
export function extractLinks(body) {
  const links = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Inline links: [text](url)
    const inlineRe = /(?<!\!)\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = inlineRe.exec(line)) !== null) {
      links.push({ type: 'inline', text: match[1], target: match[2], line: i + 1 });
    }

    // Image links: ![alt](url)
    const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRe.exec(line)) !== null) {
      links.push({ type: 'image', text: match[1], target: match[2], line: i + 1 });
    }

    // Reference links: [text][ref]
    const refRe = /\[([^\]]*)\]\[([^\]]*)\]/g;
    while ((match = refRe.exec(line)) !== null) {
      links.push({ type: 'reference', text: match[1], target: match[2], line: i + 1, isRef: true });
    }

    // Reference definitions: [ref]: url
    const defRe = /^\[([^\]]+)\]:\s+(.+)$/g;
    while ((match = defRe.exec(line)) !== null) {
      links.push({ type: 'definition', text: match[1], target: match[2].trim(), line: i + 1, isDef: true });
    }

    // Autolinks: <url>
    const autoRe = /<(https?:\/\/[^>]+)>/g;
    while ((match = autoRe.exec(line)) !== null) {
      links.push({ type: 'autolink', text: '', target: match[1], line: i + 1 });
    }
  }

  return links;
}

/**
 * Classify a link target as internal or external.
 * @param {string} target - Link URL.
 * @returns {string} - 'external', 'anchor', 'file', 'reference'
 */
export function classifyLink(target) {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return 'external';
  }
  if (target.startsWith('mailto:') || target.startsWith('tel:')) {
    return 'external';
  }
  if (target.startsWith('#')) {
    return 'anchor';
  }
  return 'file';
}

/**
 * Generate a GitHub-compatible heading slug from a heading text.
 * Handles Unicode, duplicates, and punctuation.
 * @param {string} text - Heading text.
 * @returns {string} - Slug.
 */
export function headingSlug(text) {
  // GitHub: lowercase, remove punctuation except hyphens, spaces to hyphens.
  let slug = text
    .toLowerCase()
    .trim()
    // Remove markdown formatting
    .replace(/[*_`~]/g, '')
    // Remove punctuation except hyphens and word chars
    .replace(/[^\w\s-]/g, '')
    // Spaces to hyphens
    .replace(/\s+/g, '-');
  return slug;
}

/**
 * Extract all heading slugs from a Markdown body.
 * @param {string} body - Markdown body.
 * @returns {array} - Array of heading slugs.
 */
export function extractHeadingSlugs(body) {
  const slugs = [];
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRe.exec(body)) !== null) {
    slugs.push(headingSlug(match[2]));
  }
  return slugs;
}

/**
 * Validate links in a document against local files and anchors.
 * @param {object} opts - { docPath, body, repoRoot, knownFiles }
 * @returns {object} - { valid: boolean, broken: [{target, type, reason, line}] }
 */
export function validateLinks({ docPath, body, repoRoot, knownFiles }) {
  const broken = [];
  const links = extractLinks(body);
  const docDir = dirname(docPath);
  const headingSlugs = extractHeadingSlugs(body);

  // Resolve reference definitions first.
  const refDefs = new Map();
  for (const link of links) {
    if (link.isDef) {
      refDefs.set(link.text, link.target);
    }
  }

  for (const link of links) {
    if (link.isDef) continue; // Don't validate definitions themselves.

    let target = link.target;
    if (link.isRef) {
      target = refDefs.get(target);
      if (!target) {
        broken.push({ target: link.target, type: 'reference', reason: 'Unresolved reference', line: link.line });
        continue;
      }
    }

    const type = classifyLink(target);
    if (type === 'external') continue; // External links are not fetched.

    if (type === 'anchor') {
      const slug = target.slice(1);
      if (!headingSlugs.includes(slug)) {
        broken.push({ target, type: 'anchor', reason: 'Heading not found in document', line: link.line });
      }
      continue;
    }

    // File link: resolve relative to document directory.
    const [pathPart, anchorPart] = target.split('#');
    const decodedPath = decodeURIComponent(pathPart);
    const resolvedPath = normalize(join(docDir, decodedPath));

    // Check for path traversal outside repo root.
    const absResolved = resolve(repoRoot, resolvedPath);
    const relToRoot = relative(repoRoot, absResolved);
    if (relToRoot.startsWith('..')) {
      broken.push({ target, type: 'file', reason: 'Path traversal outside repo root', line: link.line });
      continue;
    }

    // Check if file exists.
    if (!knownFiles.has(resolvedPath) && !existsSync(absResolved)) {
      broken.push({ target, type: 'file', reason: 'File not found', line: link.line });
      continue;
    }

    // If there's an anchor, check the target file's headings.
    if (anchorPart) {
      const targetFile = absResolved;
      if (existsSync(targetFile)) {
        const targetBody = readFileSync(targetFile, 'utf8');
        const targetSlugs = extractHeadingSlugs(targetBody);
        if (!targetSlugs.includes(anchorPart)) {
          broken.push({ target, type: 'file', reason: 'Anchor not found in target file', line: link.line });
        }
      }
    }
  }

  return { valid: broken.length === 0, broken };
}
