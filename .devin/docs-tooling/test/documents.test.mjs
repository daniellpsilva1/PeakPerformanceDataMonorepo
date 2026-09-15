// documents.test.mjs — Tests for the documents module: parsing, validation, duplicates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, validateDocMetadata, checkSupersession, findDuplicateIds } from '../src/documents.mjs';
import { resolve } from 'node:path';

const fixtureRoot = resolve(import.meta.dirname, 'fixtures/documents');

test('parseDocument extracts valid frontmatter', () => {
  const doc = parseDocument('valid.md', fixtureRoot);
  assert.ok(doc.hasFrontmatter);
  assert.equal(doc.frontmatter.id, 'PPD-APP-ARCH-IDENTITY');
  assert.equal(doc.frontmatter.status, 'draft');
  assert.ok(doc.contentDigest.length > 0);
});

test('parseDocument handles no frontmatter', () => {
  const doc = parseDocument('no-frontmatter.md', fixtureRoot);
  assert.ok(!doc.hasFrontmatter);
  assert.equal(doc.frontmatter.id, undefined);
});

test('parseDocument handles missing file', () => {
  const doc = parseDocument('nonexistent.md', fixtureRoot);
  assert.ok(doc.errors.length > 0);
  assert.ok(doc.errors[0].includes('Cannot read'));
});

test('validateDocMetadata accepts valid frontmatter', () => {
  const doc = parseDocument('valid.md', fixtureRoot);
  const result = validateDocMetadata(doc);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateDocMetadata rejects missing frontmatter', () => {
  const doc = parseDocument('no-frontmatter.md', fixtureRoot);
  const result = validateDocMetadata(doc);
  assert.ok(!result.valid);
});

test('validateDocMetadata rejects invalid ID', () => {
  const doc = parseDocument('bad-id.md', fixtureRoot);
  const result = validateDocMetadata(doc);
  assert.ok(!result.valid);
});

test('checkSupersession flags superseded without successor', () => {
  const doc = parseDocument('superseded-no-successor.md', fixtureRoot);
  const result = checkSupersession(doc);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes('superseded_by')));
});

test('findDuplicateIds detects duplicate IDs', () => {
  const docs = [
    { path: 'valid.md', frontmatter: { id: 'PPD-APP-ARCH-IDENTITY' } },
    { path: 'duplicate.md', frontmatter: { id: 'PPD-APP-ARCH-IDENTITY' } },
    { path: 'other.md', frontmatter: { id: 'PPD-APP-ARCH-OTHER' } },
  ];
  const dups = findDuplicateIds(docs);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].id, 'PPD-APP-ARCH-IDENTITY');
  assert.equal(dups[0].paths.length, 2);
});

test('findDuplicateIds returns empty for unique IDs', () => {
  const docs = [
    { path: 'a.md', frontmatter: { id: 'A' } },
    { path: 'b.md', frontmatter: { id: 'B' } },
  ];
  const dups = findDuplicateIds(docs);
  assert.equal(dups.length, 0);
});
