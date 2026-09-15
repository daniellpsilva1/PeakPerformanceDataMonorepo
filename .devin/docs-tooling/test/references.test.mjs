// references.test.mjs — Tests for source_ref validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSourceRef, validateSourceRefs } from '../src/references.mjs';

function makeTmpRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'ppd-refs-'));
  mkdirSync(join(tmp, 'src'));
  writeFileSync(join(tmp, 'src', 'main.py'), 'def hello():\n    pass\n');
  writeFileSync(join(tmp, 'src', 'routes.py'), 'router = APIRouter()\n');
  return tmp;
}

test('validateSourceRef accepts valid same-repo file', () => {
  const tmp = makeTmpRepo();
  const result = validateSourceRef(
    { path: 'src/main.py', repo_id: 'test', revision: 'abc123', symbol: 'hello' },
    { repoRoot: tmp, repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateSourceRef rejects missing file', () => {
  const tmp = makeTmpRepo();
  const result = validateSourceRef(
    { path: 'src/missing.py', repo_id: 'test', revision: 'abc123' },
    { repoRoot: tmp, repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('not found')));
});

test('validateSourceRef rejects missing symbol', () => {
  const tmp = makeTmpRepo();
  const result = validateSourceRef(
    { path: 'src/main.py', repo_id: 'test', revision: 'abc123', symbol: 'nonexistent' },
    { repoRoot: tmp, repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('symbol')));
});

test('validateSourceRef rejects missing path', () => {
  const result = validateSourceRef(
    { repo_id: 'test', revision: 'abc123' },
    { repoRoot: '.', repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('path is required')));
});

test('validateSourceRef rejects missing repo_id', () => {
  const result = validateSourceRef(
    { path: 'src/main.py', revision: 'abc123' },
    { repoRoot: '.', repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('repo_id is required')));
});

test('validateSourceRef rejects non-object', () => {
  const result = validateSourceRef('not an object', { repoRoot: '.', repoId: 'test', knownRepos: { repositories: [] } });
  assert.ok(!result.valid);
});

test('validateSourceRef handles cross-repo reference with unknown repo', () => {
  const result = validateSourceRef(
    { path: 'src/main.py', repo_id: 'unknown-repo', revision: 'abc123' },
    { repoRoot: '.', repoId: 'test', knownRepos: { repositories: [] } },
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('not found in repository catalog')));
});

test('validateSourceRefs validates all refs in a document', () => {
  const tmp = makeTmpRepo();
  const doc = {
    frontmatter: {
      source_refs: [
        { path: 'src/main.py', repo_id: 'test', revision: 'abc123', symbol: 'hello' },
        { path: 'src/missing.py', repo_id: 'test', revision: 'abc123' },
      ],
    },
  };
  const result = validateSourceRefs(doc, { repoRoot: tmp, repoId: 'test', knownRepos: { repositories: [] } });
  assert.ok(!result.valid);
  assert.equal(result.results.length, 2);
  assert.ok(result.results[0].valid);
  assert.ok(!result.results[1].valid);
});

test('validateSourceRefs returns valid for empty refs', () => {
  const doc = { frontmatter: {} };
  const result = validateSourceRefs(doc, { repoRoot: '.', repoId: 'test', knownRepos: { repositories: [] } });
  assert.ok(result.valid);
  assert.equal(result.results.length, 0);
});
