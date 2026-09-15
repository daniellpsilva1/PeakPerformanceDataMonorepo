// config.mjs — Load and validate local documentation manifests and repository catalogs.
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const schemaDir = new URL('../schemas/', import.meta.url).pathname;

function loadSchema(name) {
  const raw = readFileSync(join(schemaDir, name), 'utf8');
  return JSON.parse(raw);
}

const manifestValidator = ajv.compile(loadSchema('manifest.schema.json'));
const repositoriesValidator = ajv.compile(loadSchema('repositories.schema.json'));
const documentValidator = ajv.compile(loadSchema('document.schema.json'));
const catalogValidator = ajv.compile(loadSchema('catalog.schema.json'));

export function validateManifest(data) {
  const valid = manifestValidator(data);
  return { valid, errors: valid ? [] : manifestValidator.errors };
}

export function validateRepositories(data) {
  const valid = repositoriesValidator(data);
  return { valid, errors: valid ? [] : repositoriesValidator.errors };
}

export function validateDocument(data) {
  const valid = documentValidator(data);
  return { valid, errors: valid ? [] : documentValidator.errors };
}

export function validateCatalog(data) {
  const valid = catalogValidator(data);
  return { valid, errors: valid ? [] : catalogValidator.errors };
}

export function loadManifest(repoRoot) {
  const manifestPath = resolve(repoRoot, '.devin/docs.json');
  const raw = readFileSync(manifestPath, 'utf8');
  const data = JSON.parse(raw);
  const result = validateManifest(data);
  if (!result.valid) {
    throw new Error(`Invalid manifest at ${manifestPath}: ${JSON.stringify(result.errors)}`);
  }
  return data;
}

export function loadRepositories(repoRoot) {
  const reposPath = resolve(repoRoot, 'docs/repositories.json');
  const raw = readFileSync(reposPath, 'utf8');
  const data = JSON.parse(raw);
  const result = validateRepositories(data);
  if (!result.valid) {
    throw new Error(`Invalid repositories.json at ${reposPath}: ${JSON.stringify(result.errors)}`);
  }
  return data;
}

export { loadSchema };
