// impact.test.mjs — Tests for doc-impact analysis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  DEFAULT_MAPPINGS,
  matchPath,
  analyzeImpact,
  formatImpactReport,
} from '../src/impact.mjs';

const REPO_ROOT = resolve(process.cwd(), '..', '..');

test('DEFAULT_MAPPINGS includes identity/auth pattern', () => {
  const authMapping = DEFAULT_MAPPINGS.find((m) =>
    m.obligation.includes('Identity/access')
  );
  assert.ok(authMapping);
  assert.equal(authMapping.risk, 'high');
});

test('matchPath returns all matching rules for a billing file', () => {
  const matches = matchPath('src/lib/stripe/config.ts');
  assert.ok(matches.length >= 1);
  assert.ok(matches[0].obligation.includes('Billing'));
});

test('matchPath returns empty for an unmapped file', () => {
  const matches = matchPath('README.md');
  assert.equal(matches.length, 0);
});

test('matchPath matches extraction source files', () => {
  const matches = matchPath('src/openwearables/sync_service.py');
  assert.ok(matches.length >= 1);
  assert.ok(matches[0].obligation.includes('Provider'));
});

test('matchPath matches backend route files', () => {
  const matches = matchPath('api/routes/graphs.py');
  assert.ok(matches.length >= 1);
  assert.ok(matches[0].obligation.includes('API'));
});

test('analyzeImpact returns incomplete for missing revisions', () => {
  const result = analyzeImpact({
    repoRoot: REPO_ROOT,
    base: null,
    head: null,
  });
  assert.ok(!result.complete);
  assert.equal(result.changedFiles.length, 0);
});

test('analyzeImpact returns complete for same base and head', () => {
  const result = analyzeImpact({
    repoRoot: REPO_ROOT,
    base: 'HEAD',
    head: 'HEAD',
  });
  assert.ok(result.complete);
  assert.equal(result.changedFiles.length, 0);
  assert.equal(result.impacts.length, 0);
});

test('formatImpactReport produces readable output', () => {
  const result = {
    complete: true,
    changedFiles: ['src/lib/stripe/config.ts'],
    impacts: [
      { file: 'src/lib/stripe/config.ts', obligation: 'Billing docs', risk: 'high' },
    ],
    unmapped: [],
    advisory: [],
  };
  const report = formatImpactReport(result);
  assert.ok(report.includes('Impact analysis: complete'));
  assert.ok(report.includes('Billing docs'));
  assert.ok(report.includes('[high]'));
});

test('formatImpactReport handles incomplete result', () => {
  const result = {
    complete: false,
    changedFiles: [],
    impacts: [],
    unmapped: [],
    advisory: ['Insufficient history'],
  };
  const report = formatImpactReport(result);
  assert.ok(report.includes('incomplete'));
  assert.ok(report.includes('Insufficient history'));
});
