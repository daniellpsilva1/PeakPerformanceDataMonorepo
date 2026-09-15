// evidence.mjs — Evidence state classification.
// Distinguishes: declared, prerequisites-validated, executed, enforced.
// A test file is not a passing run. A forwarded token is not a verified identity.

/**
 * Evidence states in order of increasing strength.
 */
export const EVIDENCE_STATES = [
  'declared',
  'prerequisites-validated',
  'executed',
  'enforced',
];

/**
 * Validate that a state is one of the known evidence states.
 * @param {string} state
 * @returns {boolean}
 */
export function isValidState(state) {
  return EVIDENCE_STATES.includes(state);
}

/**
 * Classify an evidence record from a declaration object.
 * Expected fields: declared (bool), prerequisitesValidated (bool), executed (bool), enforced (bool).
 * Returns the strongest state that is true, or 'unknown' if none.
 * @param {object} rec
 * @returns {string}
 */
export function classifyEvidence(rec) {
  if (!rec || typeof rec !== 'object') return 'unknown';
  if (rec.enforced) return 'enforced';
  if (rec.executed) return 'executed';
  if (rec.prerequisitesValidated) return 'prerequisites-validated';
  if (rec.declared) return 'declared';
  return 'unknown';
}

/**
 * Compare two evidence states. Returns -1, 0, or 1.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareStates(a, b) {
  const ia = EVIDENCE_STATES.indexOf(a);
  const ib = EVIDENCE_STATES.indexOf(b);
  if (ia === -1 && ib === -1) return 0;
  if (ia === -1) return -1;
  if (ib === -1) return 1;
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}

/**
 * Build an evidence summary from a list of check records.
 * Each record: { name, declared, prerequisitesValidated, executed, enforced, source, notes }
 * @param {Array} records
 * @returns {object}
 */
export function buildEvidenceSummary(records) {
  if (!Array.isArray(records)) {
    return { total: 0, byState: {}, records: [], unknown: 0 };
  }
  const byState = {};
  let unknown = 0;
  for (const rec of records) {
    const state = classifyEvidence(rec);
    if (state === 'unknown') {
      unknown++;
    } else {
      byState[state] = (byState[state] || 0) + 1;
    }
  }
  return {
    total: records.length,
    byState,
    unknown,
    records: records.map((r) => ({
      name: r.name,
      state: classifyEvidence(r),
      source: r.source || null,
      notes: r.notes || null,
    })),
  };
}

/**
 * Validate that an evidence claim is honest.
 * Rules:
 * - A declared test is not evidence of execution.
 * - A forwarded token is not evidence of verified identity.
 * - A date refresh is not factual revalidation.
 * @param {object} claim - { state, basis, source }
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateEvidenceClaim(claim) {
  const warnings = [];
  if (!claim || typeof claim !== 'object') {
    return { valid: false, warnings: ['No claim provided'] };
  }
  const state = claim.state;
  if (!isValidState(state)) {
    return { valid: false, warnings: [`Unknown state: ${state}`] };
  }
  // A declared test cannot claim execution.
  if (state === 'executed' || state === 'enforced') {
    if (!claim.basis || claim.basis === 'declared') {
      warnings.push('Claimed state requires execution evidence, not just declaration.');
    }
  }
  // A forwarded token is not verified identity.
  if (claim.basis === 'forwarded-token') {
    warnings.push('A forwarded token is not evidence of verified identity.');
  }
  // A date refresh is not revalidation.
  if (claim.basis === 'date-refresh') {
    warnings.push('A date refresh is not factual revalidation.');
  }
  return { valid: warnings.length === 0, warnings };
}
