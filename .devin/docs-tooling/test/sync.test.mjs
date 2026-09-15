// sync.test.mjs — Tests for shared bundle sync.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  DEFAULT_SYNC_TARGETS,
  DEFAULT_SYNC_FILES,
  checkLocalEdits,
  dryRunSync,
  formatSyncReport,
} from '../src/sync.mjs';

const REPO_ROOT = resolve(process.cwd(), '..', '..');

test('DEFAULT_SYNC_TARGETS has 14 entries', () => {
  assert.equal(DEFAULT_SYNC_TARGETS.length, 14);
});

test('DEFAULT_SYNC_FILES includes governance docs', () => {
  assert.ok(DEFAULT_SYNC_FILES.includes('docs/governance/documentation-standard.md'));
  assert.ok(DEFAULT_SYNC_FILES.includes('docs/governance/sdlc.md'));
});

test('checkLocalEdits returns exists=false for missing target', () => {
  const result = checkLocalEdits(
    REPO_ROOT,
    resolve(REPO_ROOT, 'nonexistent'),
    'docs/governance/sdlc.md'
  );
  assert.ok(!result.exists);
  assert.ok(!result.modified);
});

test('checkLocalEdits returns exists=false for missing source', () => {
  const result = checkLocalEdits(
    REPO_ROOT,
    REPO_ROOT,
    'nonexistent-file.md'
  );
  assert.ok(!result.exists);
});

test('dryRunSync returns reports for all targets', () => {
  const report = dryRunSync(REPO_ROOT);
  assert.ok(report.dryRun);
  assert.ok(report.reports.length > 0);
  // Each report should have a repoId
  for (const r of report.reports) {
    assert.ok(r.repoId);
    assert.ok(r.status);
  }
});

test('dryRunSync marks missing repos as missing', () => {
  const report = dryRunSync(REPO_ROOT, [
    { repoId: 'nonexistent', path: 'nonexistent/path' },
  ]);
  assert.equal(report.reports[0].status, 'missing');
});

test('dryRunSync reports new or up-to-date files for available repos', () => {
  const report = dryRunSync(REPO_ROOT, [
    { repoId: 'app', path: 'PeakPerformanceData/peak_performance_data' },
  ]);
  const appReport = report.reports[0];
  assert.equal(appReport.status, 'available');
  // Files may be 'new' (first sync) or 'up-to-date' (already synced)
  const syncedFiles = appReport.files.filter((f) => f.status === 'new' || f.status === 'up-to-date');
  assert.ok(syncedFiles.length > 0);
});

test('formatSyncReport produces readable output for dry run', () => {
  const report = dryRunSync(REPO_ROOT, [
    { repoId: 'app', path: 'PeakPerformanceData/peak_performance_data' },
  ]);
  const formatted = formatSyncReport(report);
  assert.ok(formatted.includes('dry-run'));
  assert.ok(formatted.includes('app'));
});

test('formatSyncReport handles execute report', () => {
  const report = {
    executed: true,
    blocked: false,
    results: [
      {
        repoId: 'test',
        status: 'done',
        files: [{ file: 'test.md', status: 'synced' }],
      },
    ],
  };
  const formatted = formatSyncReport(report);
  assert.ok(formatted.includes('Sync report'));
  assert.ok(formatted.includes('test'));
  assert.ok(formatted.includes('synced'));
});
