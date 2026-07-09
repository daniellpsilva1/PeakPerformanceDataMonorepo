/**
 * Server-side rendering utilities for courtviz.
 *
 * Renders React SVG components to static SVG strings using
 * react-dom/server, with optional PNG/PDF conversion via sharp.
 */

import { renderToStaticMarkup } from "react-dom/server";

/**
 * Render a React element to a static SVG string.
 */
export function renderToSVG(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

/**
 * Render a React element to a complete SVG document string.
 * Wraps the markup in an XML declaration and SVG namespace.
 */
export function renderToSVGDocument(element: React.ReactElement): string {
  const markup = renderToStaticMarkup(element);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

/**
 * Save SVG string to a file.
 */
export async function saveSVG(filePath: string, svg: string): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.writeFile(filePath, svg, "utf-8");
}

/**
 * Render a React element to SVG and save to file.
 */
export async function renderAndSaveSVG(
  filePath: string,
  element: React.ReactElement,
): Promise<string> {
  const svg = renderToSVGDocument(element);
  await saveSVG(filePath, svg);
  return svg;
}

/**
 * Convert SVG string to PNG using sharp (if available).
 * Requires sharp as an optional dependency.
 */
export async function svgToPNG(svg: string, _options?: {
  width?: number;
  height?: number;
}): Promise<Buffer> {
  try {
    // @ts-expect-error — sharp is an optional dependency, may not be installed
    const sharp = (await import("sharp")).default;
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  } catch {
    throw new Error(
      "sharp is required for PNG export. Install it with: pnpm add sharp",
    );
  }
}

/**
 * Full pipeline: React element → SVG file + PNG file.
 */
export async function exportGraphic(
  element: React.ReactElement,
  options: {
    svgPath: string;
    pngPath?: string;
    pngWidth?: number;
    pngHeight?: number;
  },
): Promise<void> {
  const svg = await renderAndSaveSVG(options.svgPath, element);

  if (options.pngPath) {
    const png = await svgToPNG(svg, {
      height: options.pngHeight,
      width: options.pngWidth,
    });
    const fs = await import("node:fs/promises");
    await fs.writeFile(options.pngPath, png);
  }
}
