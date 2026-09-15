// evidence.test.mjs — Tests for evidence state classification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_STATES,
  isValidState,
  classifyEvidence,
  compareStates,
  buildEvidenceSummary,
  validateEvidenceClaim,
} from '../src/evidence.mjs';

test('EVIDENCE_STATES has four states in order', () => {
  assert.deepEqual(EVIDENCE_STATES, [
    'declared',
    'prerequisites-validated',
    'executed',
    'enforced',
  ]);
});

test('isValidState accepts known states', () => {
  assert.ok(isValidState('declared'));
  assert.ok(isValidState('prerequisites-validated'));
  assert.ok(isValidState('executed'));
  assert.ok(isValidState('enforced'));
});

test('isValidState rejects unknown states', () => {
  assert.ok(!isValidState('unknown'));
  assert.ok(!isValidState('verified'));
  assert.ok(!isValidState(''));
  assert.ok(!isValidState(null));
});

test('classifyEvidence returns enforced when all flags set', () => {
  const rec = { declared: true, prerequisitesValidated: true, executed: true, enforced: true };
  assert.equal(classifyEvidence(rec), 'enforced');
});

test('classifyEvidence returns executed when not enforced', () => {
  const rec = { declared: true, prerequisitesValidated: true, executed: true, enforced: false };
  assert.equal(classifyEvidence(rec), 'executed');
});

test('classifyEvidence returns prerequisites-validated when not executed', () => {
  const rec = { declared: true, prerequisitesValidated: true, executed: false };
  assert.equal(classifyEvidence(rec), 'prerequisites-validated');
});

test('classifyEvidence returns declared when only declared', () => {
  const rec = { declared: true };
  assert.equal(classifyEvidence(rec), 'declared');
});

test('classifyEvidence returns unknown for empty record', () => {
  assert.equal(classifyEvidence({}), 'unknown');
  assert.equal(classifyEvidence(null), 'unknown');
  assert.equal(classifyEvidence(undefined), 'unknown');
});

test('compareStates orders correctly', () => {
  assert.equal(compareStates('declared', 'executed'), -1);
  assert.equal(compareStates('executed', 'declared'), 1);
  assert.equal(compareStates('enforced', 'enforced'), 0);
  assert.equal(compareStates('unknown', 'declared'), -1);
  assert.equal(compareStates('declared', 'unknown'), 1);
});

test('buildEvidenceSummary counts states correctly', () => {
  const records = [
    { name: 'check1', declared: true },
    { name: 'check2', declared: true, prerequisitesValidated: true, executed: true },
    { name: 'check3', declared: true, enforced: true },
    { name: 'check4' },
  ];
  const summary = buildEvidenceSummary(records);
  assert.equal(summary.total, 4);
  assert.equal(summary.byState['declared'], 1);
  assert.equal(summary.byState['executed'], 1);
  assert.equal(summary.byState['enforced'], 1);
  assert.equal(summary.unknown, 1);
});

test('buildEvidenceSummary handles empty input', () => {
  const summary = buildEvidenceSummary([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.unknown, 0);
});

test('validateEvidenceClaim accepts honest declared claim', () => {
  const claim = { state: 'declared', basis: 'source-inspection' };
  const result = validateEvidenceClaim(claim);
  assert.ok(result.valid);
  assert.equal(result.warnings.length, 0);
});

test('validateEvidenceClaim warns when declared test claims execution', () => {
  const claim = { state: 'executed', basis: 'declared' };
  const result = validateEvidenceClaim(claim);
  assert.ok(!result.valid);
  assert.ok(result.warnings.length > 0);
});

test('validateEvidenceClaim warns on forwarded-token basis', () => {
  const claim = { state: 'executed', basis: 'forwarded-token' };
  const result = validateEvidenceClaim(claim);
  assert.ok(result.warnings.length > 0);
});

test('validateEvidenceClaim warns on date-refresh basis', () => {
  const claim = { state: 'accepted', basis: 'date-refresh' };
  const result = validateEvidenceClaim(claim);
  assert.ok(!result.valid);
});

test('validateEvidenceClaim rejects invalid state', () => {
  const claim = { state: 'verified', basis: 'test' };
  const result = validateEvidenceClaim(claim);
  assert.ok(!result.valid);
});
