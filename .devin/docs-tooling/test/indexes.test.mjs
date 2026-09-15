// indexes.test.mjs — Tests for the indexes module: catalog generation, comparison, stability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCatalog, computeInputDigest, compareCatalogs, serializeCatalog, GENERATOR_VERSION } from '../src/indexes.mjs';

const sampleDocs = [
  {
    path: 'docs/b.md',
    tracked: true,
    frontmatter: { id: 'PPD-APP-ARCH-B', title: 'B', type: 'explanation', status: 'draft', owner: 'daniel', visibility: 'internal' },
    hasFrontmatter: true,
    contentDigest: 'abc123',
    valid: true,
    errors: [],
  },
  {
    path: 'docs/a.md',
    tracked: true,
    frontmatter: { id: 'PPD-APP-ARCH-A', title: 'A', type: 'explanation', status: 'accepted', owner: 'daniel', visibility: 'internal' },
    hasFrontmatter: true,
    contentDigest: 'def456',
    valid: true,
    errors: [],
  },
];

test('generateCatalog produces valid catalog with sorted documents', () => {
  const digest = computeInputDigest(sampleDocs);
  const catalog = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.repo_id, 'app');
  assert.equal(catalog.documents.length, 2);
  assert.equal(catalog.documents[0].id, 'PPD-APP-ARCH-A', 'should be sorted by ID');
  assert.equal(catalog.documents[1].id, 'PPD-APP-ARCH-B');
  assert.equal(catalog.generator_version, GENERATOR_VERSION);
});

test('generateCatalog excludes documents without frontmatter', () => {
  const docs = [
    ...sampleDocs,
    { path: 'docs/no-fm.md', frontmatter: {}, hasFrontmatter: false, contentDigest: 'x' },
  ];
  const digest = computeInputDigest(docs);
  const catalog = generateCatalog({ repoId: 'app', documents: docs, inputDigest: digest });
  assert.equal(catalog.documents.length, 2);
});

test('computeInputDigest is deterministic for same inputs', () => {
  const d1 = computeInputDigest(sampleDocs);
  const d2 = computeInputDigest(sampleDocs);
  assert.equal(d1, d2);
});

test('computeInputDigest changes with different inputs', () => {
  const d1 = computeInputDigest(sampleDocs);
  const d2 = computeInputDigest([{ ...sampleDocs[0], contentDigest: 'changed' }]);
  assert.notEqual(d1, d2);
});

test('compareCatalogs returns match for identical catalogs', () => {
  const digest = computeInputDigest(sampleDocs);
  const catalog = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  const result = compareCatalogs(catalog, catalog);
  assert.ok(result.match, JSON.stringify(result.differences));
});

test('compareCatalogs detects content digest mismatch', () => {
  const digest = computeInputDigest(sampleDocs);
  const gen = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  const committed = JSON.parse(JSON.stringify(gen));
  committed.documents[0].content_digest = 'changed';
  committed.input_digest = 'different';
  const result = compareCatalogs(gen, committed);
  assert.ok(!result.match);
  assert.ok(result.differences.some((d) => d.type === 'content-digest-mismatch'));
});

test('compareCatalogs detects missing document in committed', () => {
  const digest = computeInputDigest(sampleDocs);
  const gen = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  const committed = JSON.parse(JSON.stringify(gen));
  committed.documents = committed.documents.slice(0, 1);
  const result = compareCatalogs(gen, committed);
  assert.ok(!result.match);
  assert.ok(result.differences.some((d) => d.type === 'missing-in-committed'));
});

test('compareCatalogs detects missing document in generated', () => {
  const digest = computeInputDigest(sampleDocs);
  const gen = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  const committed = JSON.parse(JSON.stringify(gen));
  committed.documents.push({ id: 'PPD-APP-ARCH-C', title: 'C', path: 'docs/c.md', type: 'explanation', status: 'draft', content_digest: 'xyz' });
  const result = compareCatalogs(gen, committed);
  assert.ok(!result.match);
  assert.ok(result.differences.some((d) => d.type === 'missing-in-generated'));
});

test('serializeCatalog produces stable output', () => {
  const digest = computeInputDigest(sampleDocs);
  const catalog = generateCatalog({ repoId: 'app', documents: sampleDocs, inputDigest: digest });
  const s1 = serializeCatalog(catalog);
  const s2 = serializeCatalog(catalog);
  assert.equal(s1, s2);
});
