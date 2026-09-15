// source-symbols.mjs — Source symbol reference validation.
// Validates that source references in documentation point to real declarations.
// Uses static parsing, not imports. Does not search for names anywhere in files.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * Extract source references from a Markdown document body.
 * Looks for patterns like:
 *   - `src/path/to/file.ts` (file references)
 *   - `src/path/to/file.ts:42` (file + line)
 *   - `functionName` in `src/path/to/file.ts` (symbol + file)
 * @param {string} body
 * @returns {Array}
 */
export function extractSourceRefs(body) {
  const refs = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match backtick-quoted source paths
    const pathPattern = /`((?:src|api|lib|app|packages)\/[^\s`]+):?(\d*)`/g;
    let match;
    while ((match = pathPattern.exec(line)) !== null) {
      refs.push({
        path: match[1],
        line: match[2] ? parseInt(match[2], 10) : null,
        sourceLine: i + 1,
      });
    }
  }

  return refs;
}

/**
 * Check if a source reference file exists.
 * @param {string} repoRoot
 * @param {string} refPath
 * @returns {boolean}
 */
export function sourceFileExists(repoRoot, refPath) {
  const fullPath = resolve(repoRoot, refPath);
  return existsSync(fullPath);
}

/**
 * Validate source references in a document.
 * @param {string} repoRoot
 * @param {Array} refs - From extractSourceRefs
 * @returns {{ valid: boolean, missing: Array, checked: number }}
 */
export function validateSourceRefs(repoRoot, refs) {
  const missing = [];
  let checked = 0;

  for (const ref of refs) {
    if (!sourceFileExists(repoRoot, ref.path)) {
      missing.push(ref);
    }
    checked++;
  }

  return {
    valid: missing.length === 0,
    missing,
    checked,
  };
}

/**
 * Check if a symbol is declared in a source file.
 * Uses simple pattern matching for function/class/const/variable declarations.
 * Does NOT search for the name anywhere in the file.
 * @param {string} filePath
 * @param {string} symbolName
 * @returns {{ found: boolean, supported: boolean }}
 */
export function checkSymbolDeclaration(filePath, symbolName) {
  if (!existsSync(filePath)) {
    return { found: false, supported: false };
  }

  const source = readFileSync(filePath, 'utf8');

  // Match declaration patterns:
  // export function name, export const name, export class name, function name, const name, class name
  const patterns = [
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`export\\s+const\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`export\\s+class\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`export\\s+default\\s+function\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`(?:^|\\n)function\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`(?:^|\\n)const\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`(?:^|\\n)class\\s+${escapeRegex(symbolName)}\\b`),
    // Python patterns
    new RegExp(`def\\s+${escapeRegex(symbolName)}\\b`),
    new RegExp(`class\\s+${escapeRegex(symbolName)}\\b`),
  ];

  for (const pattern of patterns) {
    if (pattern.test(source)) {
      return { found: true, supported: true };
    }
  }

  return { found: false, supported: true };
}

/**
 * Escape a string for use in a regex.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate all source references in a set of documents.
 * @param {string} repoRoot
 * @param {Array} docs - [{ path, body }]
 * @returns {object}
 */
export function validateAllSourceRefs(repoRoot, docs) {
  const results = [];
  let totalValid = true;

  for (const doc of docs) {
    const refs = extractSourceRefs(doc.body);
    const validation = validateSourceRefs(repoRoot, refs);
    if (!validation.valid) {
      totalValid = false;
    }
    results.push({
      docPath: doc.path,
      refCount: refs.length,
      missing: validation.missing,
      valid: validation.valid,
    });
  }

  return { valid: totalValid, results };
}
