// cli.test.mjs — Integration tests for the CLI entry point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli.mjs');

function makeFixtureRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-cli-'));
  mkdirSync(join(tmp, 'docs'));
  mkdirSync(join(tmp, '.devin'));

  // Create manifest.
  writeFileSync(join(tmp, '.devin', 'docs.json'), JSON.stringify({
    schema_version: 1,
    repo_id: 'test',
    doc_root: 'docs',
    profile: 'application',
  }));

  // Create a valid managed doc.
  writeFileSync(join(tmp, 'docs', 'valid.md'), `---
id: PPD-TEST-ARCH-VALID
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Valid document
type: explanation
visibility: internal
---

# Valid document

See [valid self](#valid-document).
`);

  // Create a doc with broken link.
  writeFileSync(join(tmp, 'docs', 'broken.md'), `---
id: PPD-TEST-ARCH-BROKEN
owner: daniel
schema_version: 1
status: draft
title: Broken document
type: explanation
visibility: internal
---

# Broken document

See [missing](nonexistent.md).
`);

  // Init git repo.
  execSync('git init -q && git add -A && git commit -q -m "Add fixture"', { cwd: tmp });

  return tmp;
}

function runCli(repoPath, ...args) {
  try {
    const output = execSync(`node ${cliPath} ${args.join(' ')} --repo ${repoPath}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return { output, exitCode: 0 };
  } catch (err) {
    return { output: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
  }
}

test('CLI check passes on valid repo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-cli-'));
  mkdirSync(join(tmp, 'docs'));
  mkdirSync(join(tmp, '.devin'));
  writeFileSync(join(tmp, '.devin', 'docs.json'), JSON.stringify({
    schema_version: 1, repo_id: 'test', doc_root: 'docs', profile: 'application',
  }));
  writeFileSync(join(tmp, 'docs', 'valid.md'), `---
id: PPD-TEST-ARCH-VALID
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Valid
type: explanation
visibility: internal
---

# Valid

[self](#valid).
`);
  execSync('git init -q && git add -A && git commit -q -m "init"', { cwd: tmp });

  const result = runCli(tmp, 'check');
  assert.equal(result.exitCode, 0, result.output + (result.stderr || ''));
  assert.ok(result.output.includes('PASS'));
});

test('CLI check fails on broken link', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-cli-'));
  mkdirSync(join(tmp, 'docs'));
  mkdirSync(join(tmp, '.devin'));
  writeFileSync(join(tmp, '.devin', 'docs.json'), JSON.stringify({
    schema_version: 1, repo_id: 'test', doc_root: 'docs', profile: 'application',
  }));
  writeFileSync(join(tmp, 'docs', 'broken.md'), `---
id: PPD-TEST-ARCH-BROKEN
owner: daniel
schema_version: 1
status: draft
title: Broken
type: explanation
visibility: internal
---

# Broken

[missing](nonexistent.md).
`);
  execSync('git init -q && git add -A && git commit -q -m "init"', { cwd: tmp });

  const result = runCli(tmp, 'check');
  assert.equal(result.exitCode, 1, result.output);
  assert.ok(result.output.includes('FAIL'));
  assert.ok(result.output.includes('not found'));
});

test('CLI inventory lists managed documents', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-cli-'));
  mkdirSync(join(tmp, 'docs'));
  mkdirSync(join(tmp, '.devin'));
  writeFileSync(join(tmp, '.devin', 'docs.json'), JSON.stringify({
    schema_version: 1, repo_id: 'test', doc_root: 'docs', profile: 'application',
  }));
  writeFileSync(join(tmp, 'docs', 'a.md'), `---
id: PPD-TEST-ARCH-A
owner: daniel
schema_version: 1
status: draft
title: A
type: explanation
visibility: internal
---

# A
`);
  execSync('git init -q && git add -A && git commit -q -m "init"', { cwd: tmp });

  const result = runCli(tmp, 'inventory');
  assert.equal(result.exitCode, 0);
  assert.ok(result.output.includes('docs/a.md'));
});

test('CLI catalog generates valid catalog', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-cli-'));
  mkdirSync(join(tmp, 'docs'));
  mkdirSync(join(tmp, '.devin'));
  writeFileSync(join(tmp, '.devin', 'docs.json'), JSON.stringify({
    schema_version: 1, repo_id: 'test', doc_root: 'docs', profile: 'application',
  }));
  writeFileSync(join(tmp, 'docs', 'a.md'), `---
id: PPD-TEST-ARCH-A
owner: daniel
schema_version: 1
status: draft
title: A
type: explanation
visibility: internal
---

# A
`);
  execSync('git init -q && git add -A && git commit -q -m "init"', { cwd: tmp });

  const result = runCli(tmp, 'catalog');
  assert.equal(result.exitCode, 0);
  assert.ok(result.output.includes('PPD-TEST-ARCH-A'));
});

test('CLI usage shows help', () => {
  const result = runCli('.', '--help');
  assert.equal(result.exitCode, 0);
  assert.ok(result.output.includes('ppd-docs'));
  assert.ok(result.output.includes('check'));
});
