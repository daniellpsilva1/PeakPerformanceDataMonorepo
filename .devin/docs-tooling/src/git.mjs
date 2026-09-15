// git.mjs — Bounded Git operations for documentation tooling.
// All operations are read-only. No fetch, checkout, reset, or submodule mutation.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Get the HEAD revision of a repository.
 * @param {string} repoRoot
 * @returns {string|null}
 */
export function getHeadRevision(repoRoot) {
  try {
    const out = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get the merge-base of two revisions, or null if history is insufficient.
 * @param {string} repoRoot
 * @param {string} base
 * @param {string} head
 * @returns {string|null}
 */
export function getMergeBase(repoRoot, base, head) {
  try {
    const out = execFileSync('git', ['-C', repoRoot, 'merge-base', base, head], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get the list of changed files between two revisions.
 * Returns { files: string[], complete: boolean }.
 * If history is insufficient, complete is false and files is empty.
 * @param {string} repoRoot
 * @param {string} base
 * @param {string} head
 * @returns {{ files: string[], complete: boolean }}
 */
export function getChangedFiles(repoRoot, base, head) {
  if (!base || !head) {
    return { files: [], complete: false };
  }
  const mergeBase = getMergeBase(repoRoot, base, head);
  if (!mergeBase) {
    return { files: [], complete: false };
  }
  try {
    const out = execFileSync(
      'git',
      ['-C', repoRoot, 'diff', '--name-only', '-z', `${mergeBase}..${head}`],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const files = out.split('\0').filter(Boolean);
    return { files, complete: true };
  } catch {
    return { files: [], complete: false };
  }
}

/**
 * Get the gitlink revision for a submodule path, or null if not a gitlink.
 * @param {string} repoRoot
 * @param {string} subPath
 * @returns {string|null}
 */
export function getGitlinkRevision(repoRoot, subPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-tree', 'HEAD', subPath],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    // Format: <mode> <type> <object> <path>
    const parts = out.trim().split(/\s+/);
    if (parts.length >= 3 && parts[1] === 'commit') {
      return parts[2];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a path is tracked by git.
 * @param {string} repoRoot
 * @param {string} filePath
 * @returns {boolean}
 */
export function isTracked(repoRoot, filePath) {
  try {
    execFileSync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', filePath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
