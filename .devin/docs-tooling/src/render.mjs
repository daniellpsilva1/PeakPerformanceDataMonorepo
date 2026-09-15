// render.mjs — Render Mermaid diagrams to images using a pinned CLI.
// This module does NOT use unstable internal Node APIs. It shells out to the
// @mermaid-js/mermaid-cli package if installed, or returns an explicit
// incomplete status if the renderer is unavailable.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';

/**
 * Check if the Mermaid CLI is available.
 * @returns {boolean}
 */
export function isMermaidAvailable() {
  try {
    execSync('npx --no-install mmdc --version', { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract Mermaid code blocks from a Markdown document.
 * @param {string} content - Markdown content.
 * @returns {array} - [{ lang, code, index }]
 */
export function extractMermaidBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).toLowerCase();
      const start = i;
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++; // skip closing ```
      }
      if (lang === 'mermaid') {
        blocks.push({ lang, code: codeLines.join('\n'), index: start });
      }
    } else {
      i++;
    }
  }
  return blocks;
}

/**
 * Render a single Mermaid diagram to an image file.
 * @param {object} opts - { code, outputPath, format, theme }
 * @returns {object} - { success, outputPath, error? }
 */
export function renderMermaid({ code, outputPath, format = 'svg', theme = 'dark' }) {
  if (!isMermaidAvailable()) {
    return { success: false, error: 'Mermaid CLI (mmdc) is not installed. Install @mermaid-js/mermaid-cli to render diagrams.' };
  }

  const tmpDir = resolve(outputPath, '..', '.mermaid-tmp');
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const inputPath = join(tmpDir, 'input.mmd');
  writeFileSync(inputPath, code, 'utf8');

  try {
    const cmd = `npx --no-install mmdc -i "${inputPath}" -o "${outputPath}" -t ${theme} -b transparent`;
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, outputPath };
  } catch (err) {
    return { success: false, error: `Mermaid rendering failed: ${err.message}` };
  }
}

/**
 * Render all Mermaid diagrams in a Markdown file.
 * @param {object} opts - { mdPath, outputDir, format, theme }
 * @returns {object} - { total, rendered, failed, results }
 */
export function renderMermaidFromFile({ mdPath, outputDir, format = 'svg', theme = 'dark' }) {
  const content = readFileSync(mdPath, 'utf8');
  const blocks = extractMermaidBlocks(content);
  const results = [];

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const baseName = basename(mdPath, extname(mdPath));
  for (let i = 0; i < blocks.length; i++) {
    const outputPath = join(outputDir, `${baseName}-${i + 1}.${format}`);
    const result = renderMermaid({ code: blocks[i].code, outputPath, format, theme });
    results.push({ index: blocks[i].index, ...result });
  }

  return {
    total: blocks.length,
    rendered: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
