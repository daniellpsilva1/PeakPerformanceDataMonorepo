// links.test.mjs — Tests for the links module: extraction, classification, validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLinks, classifyLink, headingSlug, extractHeadingSlugs, validateLinks } from '../src/links.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixtureRoot = resolve(import.meta.dirname, 'fixtures/links');

test('extractLinks finds inline links', () => {
  const body = 'See [example](https://example.com) and [other](file.md).';
  const links = extractLinks(body);
  assert.equal(links.length, 2);
  assert.equal(links[0].text, 'example');
  assert.equal(links[0].target, 'https://example.com');
  assert.equal(links[1].text, 'other');
  assert.equal(links[1].target, 'file.md');
});

test('extractLinks finds image links', () => {
  const body = '![alt text](image.png)';
  const links = extractLinks(body);
  assert.equal(links.length, 1);
  assert.equal(links[0].type, 'image');
  assert.equal(links[0].target, 'image.png');
});

test('extractLinks finds reference definitions', () => {
  const body = '[ref]: https://example.com\nSee [link][ref].';
  const links = extractLinks(body);
  assert.ok(links.some((l) => l.isDef && l.text === 'ref'));
  assert.ok(links.some((l) => l.isRef && l.target === 'ref'));
});

test('classifyLink identifies external URLs', () => {
  assert.equal(classifyLink('https://example.com'), 'external');
  assert.equal(classifyLink('http://example.com'), 'external');
  assert.equal(classifyLink('mailto:foo@bar.com'), 'external');
});

test('classifyLink identifies anchors', () => {
  assert.equal(classifyLink('#section'), 'anchor');
});

test('classifyLink identifies file links', () => {
  assert.equal(classifyLink('file.md'), 'file');
  assert.equal(classifyLink('sub/file.md'), 'file');
  assert.equal(classifyLink('file.md#anchor'), 'file');
});

test('headingSlug handles basic text', () => {
  assert.equal(headingSlug('Section One'), 'section-one');
  assert.equal(headingSlug('API Reference'), 'api-reference');
});

test('headingSlug handles punctuation', () => {
  assert.equal(headingSlug('ADR-0001 — Test'), 'adr-0001-test');
});

test('extractHeadingSlugs finds all headings', () => {
  const body = '# Title\n## Section A\n### Sub\nText\n## Section B';
  const slugs = extractHeadingSlugs(body);
  assert.equal(slugs.length, 4);
  assert.ok(slugs.includes('title'));
  assert.ok(slugs.includes('section-a'));
  assert.ok(slugs.includes('section-b'));
});

test('validateLinks finds valid file link', () => {
  const body = '[valid](sub/nested.md)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(result.valid, JSON.stringify(result.broken));
});

test('validateLinks finds broken file link', () => {
  const body = '[broken](nonexistent.md)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(!result.valid);
  assert.ok(result.broken.some((b) => b.reason.includes('not found')));
});

test('validateLinks finds valid anchor', () => {
  const body = '# Heading\n[link](#heading)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(result.valid, JSON.stringify(result.broken));
});

test('validateLinks finds broken anchor', () => {
  const body = '# Heading\n[link](#no-such-heading)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(!result.valid);
  assert.ok(result.broken.some((b) => b.reason.includes('Heading not found')));
});

test('validateLinks ignores external links', () => {
  const body = '[external](https://example.com)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(result.valid);
});

test('validateLinks finds cross-file anchor', () => {
  const body = '[nested](sub/nested.md#nested-heading)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(result.valid, JSON.stringify(result.broken));
});

test('validateLinks finds broken cross-file anchor', () => {
  const body = '[nested](sub/nested.md#no-such-heading)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(!result.valid);
  assert.ok(result.broken.some((b) => b.reason.includes('Anchor not found')));
});

test('validateLinks handles encoded spaces in path', () => {
  const body = '[space](sub/space%20file.md)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(result.valid, JSON.stringify(result.broken));
});

test('validateLinks rejects path traversal', () => {
  const body = '[escape](../../../etc/passwd)';
  const result = validateLinks({ docPath: 'main.md', body, repoRoot: fixtureRoot, knownFiles: new Set() });
  assert.ok(!result.valid);
  assert.ok(result.broken.some((b) => b.reason.includes('traversal')));
});
