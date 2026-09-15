// next-routes.mjs — Next.js route discovery adapter.
// Discovers route files in src/app/api and app/api without importing them.
// Extracts exported HTTP methods and path segments statically.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * HTTP methods exported by Next.js route handlers.
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Check if a file path is a Next.js route file.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isRouteFile(filePath) {
  return /\/(route|page)\.(ts|tsx|js|jsx)$/.test(filePath);
}

/**
 * Check if a file path is a server action file.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isServerActionFile(filePath) {
  return /\/(actions|server)\.(ts|tsx|js|jsx)$/.test(filePath);
}

/**
 * Extract exported HTTP methods from a route file source.
 * Uses static parsing (regex), not imports.
 * @param {string} source
 * @returns {string[]}
 */
export function extractHttpMethods(source) {
  const methods = [];
  for (const method of HTTP_METHODS) {
    // Match: export async function GET, export function GET
    const pattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    if (pattern.test(source)) {
      methods.push(method);
    }
  }
  return methods;
}

/**
 * Derive a route path from a file path.
 * @param {string} filePath - Relative to app/api root
 * @param {string} apiRoot - Root of the api directory
 * @returns {{ path: string, dynamic: boolean, catchAll: boolean }}
 */
export function deriveRoutePath(filePath, apiRoot) {
  const rel = relative(apiRoot, filePath).split(sep).join('/');
  // Remove route.ts/tsx/js/jsx suffix
  const cleaned = rel.replace(/\/(route|page)\.(ts|tsx|js|jsx)$/, '');
  const segments = cleaned.split('/').filter(Boolean);

  let dynamic = false;
  let catchAll = false;
  const pathSegments = [];

  for (const seg of segments) {
    if (seg.startsWith('[...')) {
      catchAll = true;
      dynamic = true;
      pathSegments.push('{param}');
    } else if (seg.startsWith('[')) {
      dynamic = true;
      pathSegments.push('{param}');
    } else {
      pathSegments.push(seg);
    }
  }

  const path = '/' + pathSegments.join('/');
  return { path: path === '/' ? '' : path, dynamic, catchAll };
}

/**
 * Discover all routes in a Next.js app directory.
 * @param {string} repoRoot
 * @param {Array} searchDirs - ['src/app/api', 'app/api']
 * @returns {object}
 */
export function discoverRoutes(repoRoot, searchDirs = ['src/app/api', 'app/api']) {
  const routes = [];
  const unresolved = [];

  for (const dir of searchDirs) {
    const apiRoot = join(repoRoot, dir);
    if (!existsSync(apiRoot)) continue;

    const files = walkDir(apiRoot);
    for (const file of files) {
      if (!isRouteFile(file)) continue;

      const source = readFileSync(file, 'utf8');
      const methods = extractHttpMethods(source);
      const routeInfo = deriveRoutePath(file, apiRoot);
      const relFile = relative(repoRoot, file);

      routes.push({
        file: relFile,
        methods,
        path: routeInfo.path,
        dynamic: routeInfo.dynamic,
        catchAll: routeInfo.catchAll,
        type: file.endsWith('route.ts') || file.endsWith('route.tsx') ? 'route' : 'page',
      });

      // Check for unsupported patterns
      if (source.includes('export {') || source.includes('reexports')) {
        unresolved.push({
          file: relFile,
          reason: 'Potential reexport or dynamic registration',
        });
      }
    }
  }

  return { routes, unresolved };
}

/**
 * Walk a directory recursively, returning all files.
 * @param {string} dir
 * @returns {string[]}
 */
function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Format route inventory for display.
 * @param {object} result
 * @returns {string}
 */
export function formatRouteInventory(result) {
  const lines = ['Next.js route inventory:'];
  for (const r of result.routes) {
    const methods = r.methods.length > 0 ? r.methods.join(',') : 'none';
    lines.push(`  ${methods} ${r.path} (${r.type}) [${r.file}]${r.dynamic ? ' [dynamic]' : ''}${r.catchAll ? ' [catch-all]' : ''}`);
  }
  if (result.unresolved.length > 0) {
    lines.push('');
    lines.push('Unresolved:');
    for (const u of result.unresolved) {
      lines.push(`  ${u.file}: ${u.reason}`);
    }
  }
  return lines.join('\n');
}
