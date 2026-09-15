// git.test.mjs — Tests for git operations.
// Uses the actual root repo for read-only git queries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  getHeadRevision,
  getMergeBase,
  getChangedFiles,
  getGitlinkRevision,
  isTracked,
} from '../src/git.mjs';

const REPO_ROOT = resolve(process.cwd(), '..', '..');

test('getHeadRevision returns a SHA for the root repo', () => {
  const head = getHeadRevision(REPO_ROOT);
  assert.ok(head);
  assert.match(head, /^[0-9a-f]{40}$/);
});

test('getHeadRevision returns null for nonexistent repo', () => {
  const head = getHeadRevision('/nonexistent/path');
  assert.equal(head, null);
});

test('getMergeBase returns a SHA for HEAD vs HEAD', () => {
  const head = getHeadRevision(REPO_ROOT);
  const mb = getMergeBase(REPO_ROOT, head, head);
  assert.ok(mb);
  assert.equal(mb, head);
});

test('getMergeBase returns null for invalid revisions', () => {
  const mb = getMergeBase(REPO_ROOT, 'invalid', 'also-invalid');
  assert.equal(mb, null);
});

test('getChangedFiles returns complete with empty list for same revision', () => {
  const head = getHeadRevision(REPO_ROOT);
  const result = getChangedFiles(REPO_ROOT, head, head);
  assert.ok(result.complete);
  assert.equal(result.files.length, 0);
});

test('getChangedFiles returns incomplete for invalid revisions', () => {
  const result = getChangedFiles(REPO_ROOT, 'invalid', 'also-invalid');
  assert.ok(!result.complete);
  assert.equal(result.files.length, 0);
});

test('getChangedFiles returns incomplete for missing revisions', () => {
  const result = getChangedFiles(REPO_ROOT, null, null);
  assert.ok(!result.complete);
});

test('getGitlinkRevision returns a revision for a submodule path', () => {
  const rev = getGitlinkRevision(REPO_ROOT, 'PeakPerformanceData/peak_performance_data');
  assert.ok(rev);
  assert.match(rev, /^[0-9a-f]{7,40}$/);
});

test('getGitlinkRevision returns null for a non-submodule path', () => {
  const rev = getGitlinkRevision(REPO_ROOT, 'docs');
  assert.equal(rev, null);
});

test('isTracked returns true for a known tracked file', () => {
  assert.ok(isTracked(REPO_ROOT, '.gitmodules'));
});

test('isTracked returns false for a nonexistent file', () => {
  assert.ok(!isTracked(REPO_ROOT, 'nonexistent-file-12345.md'));
});
