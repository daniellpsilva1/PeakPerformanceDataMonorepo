// discovery.mjs — Discover managed Markdown files in a repository.
// Uses Git-tracked file metadata via bounded git commands. Never traverses
// .git, env files, credentials, node_modules, caches, builds, or raw data.
import { execSync } from 'node:child_process';
import { resolve, relative, join } from 'node:path';

// Global exclusions that always apply, regardless of manifest.
const GLOBAL_EXCLUDES = [
  '.git/',
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '.cache/',
  '.turbo/',
  'coverage/',
  '.env',
  '.env.local',
  '.env.production',
  'vendor/',
  '__pycache__/',
  '.venv/',
  'venv/',
  '*.pyc',
  'uploads/',
  'r2/',
];

// Default include patterns for managed documentation.
const DEFAULT_INCLUDES = ['**/*.md', '**/*.mdx'];

// Paths that are always excluded from managed discovery even if under doc root.
const DOC_EXCLUDES = ['generated/', 'node_modules/'];

/**
 * Discover managed Markdown files in a repository.
 * @param {object} opts - { repoRoot, manifest, includeUntracked }
 * @returns {object} - { managed: string[], historical: string[], excluded: string[] }
 */
export function discoverDocs({ repoRoot, manifest, includeUntracked = false }) {
  const root = resolve(repoRoot);

  // Get git-tracked files. Use NUL delimiter for safe path parsing.
  let gitFiles = [];
  try {
    const output = execSync('git ls-files -z', { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    gitFiles = output.split('\0').filter(Boolean);
  } catch {
    // Not a git repo or git unavailable — fall back to empty.
    gitFiles = [];
  }

  // Optionally include untracked files (local preview mode only).
  let untrackedFiles = [];
  if (includeUntracked) {
    try {
      const output = execSync('git ls-files --others --exclude-standard -z', {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      });
      untrackedFiles = output.split('\0').filter(Boolean);
    } catch {
      untrackedFiles = [];
    }
  }

  const allFiles = [...gitFiles, ...untrackedFiles];

  // Build exclusion set from manifest + globals.
  const manifestExcludes = manifest?.excluded || [];
  const allExcludes = [...GLOBAL_EXCLUDES, ...manifestExcludes];

  // Filter out globally excluded paths.
  const filtered = allFiles.filter((f) => !isExcluded(f, allExcludes));

  // Classify into managed, historical, and other.
  const docRoot = manifest?.doc_root || 'docs';
  const historicalPaths = manifest?.historical || [];
  const managedIncludes = manifest?.managed?.include || DEFAULT_INCLUDES;

  const managed = [];
  const historical = [];

  for (const file of filtered) {
    // Check if file is under the doc root.
    if (!file.startsWith(docRoot + '/') && file !== docRoot) {
      // Also check root-level AGENTS.md and README.md as managed.
      if (file === 'AGENTS.md' || file === 'README.md') {
        managed.push({ path: file, tracked: gitFiles.includes(file) });
      }
      continue;
    }

    // Check if file is under a doc exclude path.
    const relToDocRoot = file.startsWith(docRoot + '/') ? file.slice(docRoot.length + 1) : '';
    if (DOC_EXCLUDES.some((ex) => relToDocRoot.startsWith(ex))) {
      continue;
    }

    // Check if file matches historical paths.
    if (historicalPaths.some((hp) => file.startsWith(hp))) {
      historical.push({ path: file, tracked: gitFiles.includes(file) });
      continue;
    }

    // Check if file matches include patterns.
    if (matchesAnyPattern(file, managedIncludes)) {
      managed.push({ path: file, tracked: gitFiles.includes(file) });
    }
  }

  return { managed, historical };
}

/**
 * Check if a path matches any glob pattern.
 */
function matchesAnyPattern(path, patterns) {
  return patterns.some((pattern) => {
    // Simple glob matching: ** matches any sequence, * matches non-slash.
    const regex = globToRegex(pattern);
    return regex.test(path);
  });
}

/**
 * Convert a glob pattern to a RegExp.
 */
function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') {
          i++;
        }
      } else {
        re += '[^/]*';
      }
    } else if ('.+?^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

/**
 * Check if a path is excluded by any exclusion pattern.
 */
function isExcluded(path, excludes) {
  return excludes.some((pattern) => {
    if (pattern.endsWith('/')) {
      // Directory exclusion: match path prefix or exact.
      const dir = pattern.slice(0, -1);
      return path === dir || path.startsWith(dir + '/');
    }
    // File pattern: use glob matching.
    return globToRegex(pattern).test(path);
  });
}
