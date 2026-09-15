// discovery.test.mjs — Tests for the discovery module.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { discoverDocs } from '../src/discovery.mjs';

const sourceFixture = resolve(import.meta.dirname, 'fixtures/discovery');
let fixtureRoot;

before(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'ppd-discovery-'));
  cpSync(sourceFixture, fixtureRoot, { recursive: true });
  writeFileSync(join(fixtureRoot, '.env'), 'SECRET=1\n');
  mkdirSync(join(fixtureRoot, 'node_modules'), { recursive: true });
  writeFileSync(join(fixtureRoot, 'node_modules', 'pkg.md'), '# pkg\n');
  execSync('git init -q', { cwd: fixtureRoot });
  execSync('git add -- AGENTS.md README.md docs', { cwd: fixtureRoot });
  execSync('git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "Add fixture"', { cwd: fixtureRoot });
});

after(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

test('discoverDocs finds tracked Markdown under docs/', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
    historical: ['docs/old-design.md'],
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest });
  const managedPaths = result.managed.map((m) => m.path);
  assert.ok(managedPaths.includes('docs/valid.md'), `managed: ${JSON.stringify(managedPaths)}`);
  assert.ok(managedPaths.includes('docs/sub/nested.md'), `managed: ${JSON.stringify(managedPaths)}`);
  assert.ok(!managedPaths.includes('docs/old-design.md'), 'historical should not be in managed');
});

test('discoverDocs classifies historical paths', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
    historical: ['docs/old-design.md'],
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest });
  const historicalPaths = result.historical.map((h) => h.path);
  assert.ok(historicalPaths.includes('docs/old-design.md'));
});

test('discoverDocs excludes generated directory under doc root', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest });
  const managedPaths = result.managed.map((m) => m.path);
  assert.ok(!managedPaths.includes('docs/generated/auto.md'), 'generated/ should be excluded');
});

test('discoverDocs includes root README.md and AGENTS.md', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest });
  const managedPaths = result.managed.map((m) => m.path);
  assert.ok(managedPaths.includes('README.md'), 'README.md should be managed');
  assert.ok(managedPaths.includes('AGENTS.md'), 'AGENTS.md should be managed');
});

test('discoverDocs excludes .env and node_modules', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest, includeUntracked: true });
  const allPaths = [...result.managed.map((m) => m.path), ...result.historical.map((h) => h.path)];
  assert.ok(!allPaths.includes('.env'), '.env should be excluded');
  assert.ok(!allPaths.includes('node_modules/pkg.md'), 'node_modules/ should be excluded');
});

test('discoverDocs marks tracked state correctly', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
  };
  const result = discoverDocs({ repoRoot: fixtureRoot, manifest });
  const valid = result.managed.find((m) => m.path === 'docs/valid.md');
  assert.ok(valid, 'docs/valid.md should be found');
  assert.ok(valid.tracked, 'docs/valid.md should be tracked');
});
