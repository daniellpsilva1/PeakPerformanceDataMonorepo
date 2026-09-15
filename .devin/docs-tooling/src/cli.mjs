#!/usr/bin/env node
// cli.mjs — Documentation validation CLI.
// Commands: check, catalog, inventory, impact, render, references, sync
// All commands are read-only and offline except explicit --write modes.
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadManifest, loadRepositories } from './config.mjs';
import { discoverDocs } from './discovery.mjs';
import { parseDocument, collectDocuments, findDuplicateIds } from './documents.mjs';
import { validateLinks } from './links.mjs';
import { generateCatalog, computeInputDigest, compareCatalogs, serializeCatalog } from './indexes.mjs';
import { buildReport, formatReport, getHeadRevision } from './report.mjs';
import { analyzeImpact, formatImpactReport } from './impact.mjs';
import { dryRunSync, executeSync, formatSyncReport } from './sync.mjs';
import { discoverRoutes as discoverNextRoutes, formatRouteInventory } from './adapters/next-routes.mjs';
import { extractSourceRefs, validateSourceRefs } from './adapters/source-symbols.mjs';

const TOOL_VERSION = '0.1.0';

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = value;
    }
  }
  return { command, opts };
}

function resolveRepoRoot(opts) {
  return resolve(opts.repo || '.');
}

function loadManifestSafe(repoRoot) {
  const manifestPath = resolve(repoRoot, '.devin/docs.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  return loadManifest(repoRoot);
}

function runCheck(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const manifest = loadManifestSafe(repoRoot);
  const head = getHeadRevision(repoRoot);

  // Discover documents.
  const discovered = discoverDocs({ repoRoot, manifest: manifest || {}, includeUntracked: false });

  // Parse and validate documents.
  const documents = collectDocuments({ repoRoot, manifest, discovered });

  // Validate links in each document.
  const linkResults = [];
  const knownFiles = new Set(discovered.managed.map((m) => m.path));
  for (const doc of documents.documents) {
    const parsed = parseDocument(doc.path, repoRoot);
    const linkResult = validateLinks({ docPath: doc.path, body: parsed.body, repoRoot, knownFiles });
    linkResults.push({ path: doc.path, broken: linkResult.broken });
  }

  // Find duplicate IDs.
  const duplicates = findDuplicateIds(documents.documents);

  // Build report.
  const report = buildReport({ repoRoot, manifest, discovered, documents, linkResults, duplicates });
  report.head = head;

  const output = formatReport(report);
  console.log(output);

  process.exit(report.result);
}

function runCatalog(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const manifest = loadManifestSafe(repoRoot);

  // Discover documents.
  const discovered = discoverDocs({ repoRoot, manifest: manifest || {}, includeUntracked: false });

  // Parse documents.
  const documents = collectDocuments({ repoRoot, manifest, discovered });

  // Generate catalog.
  const inputDigest = computeInputDigest(documents.documents);
  const catalog = generateCatalog({
    repoId: manifest?.repo_id || 'unknown',
    documents: documents.documents,
    inputDigest,
  });

  const serialized = serializeCatalog(catalog);

  if (opts.check) {
    // Compare with committed catalog.
    const catalogPath = resolve(repoRoot, (manifest?.doc_root || 'docs'), 'catalog.json');
    if (!existsSync(catalogPath)) {
      console.error(`No committed catalog found at ${catalogPath}`);
      console.error('Run with --write to generate one.');
      process.exit(2);
    }
    const committed = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const result = compareCatalogs(catalog, committed);
    if (result.match) {
      console.log('Catalog matches committed version.');
      process.exit(0);
    } else {
      console.error('Catalog mismatch:');
      for (const diff of result.differences) {
        console.error(`  ${diff.type}: ${diff.detail}`);
      }
      process.exit(1);
    }
  } else if (opts.write) {
    const catalogPath = resolve(repoRoot, (manifest?.doc_root || 'docs'), 'catalog.json');
    writeFileSync(catalogPath, serialized, 'utf8');
    console.log(`Catalog written to ${catalogPath}`);
    process.exit(0);
  } else {
    console.log(serialized);
    process.exit(0);
  }
}

function runInventory(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const manifest = loadManifestSafe(repoRoot);
  const discovered = discoverDocs({ repoRoot, manifest: manifest || {}, includeUntracked: false });

  console.log('Managed documents:');
  for (const doc of discovered.managed) {
    console.log(`  ${doc.path} ${doc.tracked ? '' : '(untracked)'}`);
  }

  if (discovered.historical.length > 0) {
    console.log('\nHistorical documents:');
    for (const doc of discovered.historical) {
      console.log(`  ${doc.path} ${doc.tracked ? '' : '(untracked)'}`);
    }
  }

  process.exit(0);
}

function runImpact(opts) {
  const repoRoot = resolveRepoRoot(opts);
  if (!opts.base || !opts.head) {
    console.error('impact: requires --base <sha> and --head <sha>');
    process.exit(3);
  }
  const result = analyzeImpact({ repoRoot, base: opts.base, head: opts.head });
  console.log(formatImpactReport(result));
  if (!result.complete) {
    process.exit(2);
  }
  process.exit(0);
}

function runReferences(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const manifest = loadManifestSafe(repoRoot);
  const discovered = discoverDocs({ repoRoot, manifest: manifest || {}, includeUntracked: false });
  const documents = collectDocuments({ repoRoot, manifest, discovered });

  // Extract and validate source references from all managed docs.
  const allRefs = [];
  for (const doc of documents.documents) {
    const parsed = parseDocument(doc.path, repoRoot);
    const refs = extractSourceRefs(parsed.body);
    const validation = validateSourceRefs(repoRoot, refs);
    allRefs.push({
      doc: doc.path,
      refCount: refs.length,
      missing: validation.missing,
      valid: validation.valid,
    });
  }

  // Also discover Next.js routes if src/app/api or app/api exists.
  const nextRoutes = discoverNextRoutes(repoRoot);

  console.log('Source reference check:');
  let totalMissing = 0;
  for (const r of allRefs) {
    if (r.missing.length > 0) {
      totalMissing += r.missing.length;
      console.log(`  ${r.doc}: ${r.missing.length} missing ref(s)`);
      for (const m of r.missing) {
        console.log(`    missing: ${m.path}${m.line ? ':' + m.line : ''}`);
      }
    }
  }
  if (totalMissing === 0) {
    console.log('  All source references valid.');
  }

  if (nextRoutes.routes.length > 0) {
    console.log('');
    console.log(formatRouteInventory(nextRoutes));
  }

  process.exit(totalMissing > 0 ? 1 : 0);
}

function runSync(opts) {
  const repoRoot = resolveRepoRoot(opts);
  if (!opts.repo) {
    console.error('sync: requires --repo <path>');
    process.exit(3);
  }
  const targetPath = opts.repo;
  if (opts.dry_run) {
    const report = dryRunSync(repoRoot);
    console.log(formatSyncReport(report));
    process.exit(0);
  } else if (opts.write) {
    const report = executeSync(repoRoot);
    console.log(formatSyncReport(report));
    process.exit(report.blocked ? 1 : 0);
  } else {
    const report = dryRunSync(repoRoot);
    console.log(formatSyncReport(report));
    process.exit(0);
  }
}

function usage() {
  console.log(`ppd-docs v${TOOL_VERSION}

Usage: ppd-docs <command> --repo <path>

Commands:
  check          Validate managed docs, schemas, links, and metadata
  catalog        Generate or check document catalog
    --check      Compare generated catalog with committed version
    --write      Write generated catalog to disk
  inventory      List managed and historical documents
  impact         Report documentation impact for a diff (requires --base --head)
  render         Render diagrams (requires Mermaid CLI)
  references     Generate static API/migration inventories
  sync           Sync shared tooling bundle to child repos

Options:
  --repo <path>  Repository root (default: current directory)
  --portfolio    Enable cross-repository portfolio mode

Exit codes:
  0  Success
  1  Validation failure
  2  Incomplete scope or missing prerequisite
  3  Tool or configuration error
`);
}

const { command, opts } = parseArgs(process.argv);

switch (command) {
  case 'check':
    runCheck(opts);
    break;
  case 'catalog':
    runCatalog(opts);
    break;
  case 'inventory':
    runInventory(opts);
    break;
  case 'impact':
    runImpact(opts);
    break;
  case 'render':
    console.error('render: requires Mermaid CLI (not yet configured)');
    process.exit(2);
    break;
  case 'references':
    runReferences(opts);
    break;
  case 'sync':
    runSync(opts);
    break;
  case undefined:
  case '--help':
  case '-h':
    usage();
    process.exit(0);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(3);
}
