// config.test.mjs — Tests for config module: schema validation and manifest/repo loading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, validateRepositories, validateDocument } from '../src/config.mjs';

test('validateManifest accepts a valid manifest', () => {
  const manifest = {
    schema_version: 1,
    repo_id: 'app',
    doc_root: 'docs',
    profile: 'application',
  };
  const result = validateManifest(manifest);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateManifest rejects missing required fields', () => {
  const manifest = { schema_version: 1 };
  const result = validateManifest(manifest);
  assert.ok(!result.valid);
  assert.ok(result.errors.length > 0);
});

test('validateRepositories accepts the portfolio catalog shape', () => {
  const repos = {
    schema_version: 1,
    repositories: [
      { id: 'app', namespace: 'PPD-APP', name: 'app', owner: 'daniel', profile: 'application', doc_root: 'docs', lifecycle: 'active' },
    ],
    occurrences: [
      { id: 'app-direct', repo_id: 'app', parent_occurrence_id: 'portfolio', path: 'app', role: 'project' },
    ],
  };
  const result = validateRepositories(repos);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateRepositories rejects invalid lifecycle', () => {
  const repos = {
    schema_version: 1,
    repositories: [
      { id: 'x', namespace: 'X', name: 'x', owner: 'd', profile: 'service', doc_root: 'docs', lifecycle: 'bogus' },
    ],
    occurrences: [],
  };
  const result = validateRepositories(repos);
  assert.ok(!result.valid);
});

test('validateDocument accepts valid frontmatter', () => {
  const doc = {
    id: 'PPD-APP-ARCH-IDENTITY',
    owner: 'daniel',
    schema_version: 1,
    status: 'draft',
    title: 'Identity',
    type: 'explanation',
    visibility: 'internal',
  };
  const result = validateDocument(doc);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateDocument rejects invalid ID pattern', () => {
  const doc = {
    id: 'bad-id',
    owner: 'daniel',
    schema_version: 1,
    status: 'draft',
    title: 'X',
    type: 'explanation',
    visibility: 'internal',
  };
  const result = validateDocument(doc);
  assert.ok(!result.valid);
});

test('validateDocument rejects invalid status', () => {
  const doc = {
    id: 'PPD-APP-ARCH-X',
    owner: 'daniel',
    schema_version: 1,
    status: 'bogus',
    title: 'X',
    type: 'explanation',
    visibility: 'internal',
  };
  const result = validateDocument(doc);
  assert.ok(!result.valid);
});

test('validateDocument rejects unknown fields', () => {
  const doc = {
    id: 'PPD-APP-ARCH-X',
    owner: 'daniel',
    schema_version: 1,
    status: 'draft',
    title: 'X',
    type: 'explanation',
    visibility: 'internal',
    bogus_field: true,
  };
  const result = validateDocument(doc);
  assert.ok(!result.valid);
});
