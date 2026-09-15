// render.test.mjs — Tests for Mermaid block extraction and renderer availability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMermaidBlocks, isMermaidAvailable } from '../src/render.mjs';

test('extractMermaidBlocks extracts mermaid code blocks', () => {
  const content = `# Title

Some text.

\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`

More text.

\`\`\`mermaid
sequenceDiagram
    A->>B: Hello
\`\`\`
`;
  const blocks = extractMermaidBlocks(content);
  assert.equal(blocks.length, 2);
  assert.ok(blocks[0].code.includes('flowchart'));
  assert.ok(blocks[1].code.includes('sequenceDiagram'));
});

test('extractMermaidBlocks ignores non-mermaid code blocks', () => {
  const content = `\`\`\`python
def hello():
    pass
\`\`\`

\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`
`;
  const blocks = extractMermaidBlocks(content);
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].code.includes('flowchart'));
});

test('extractMermaidBlocks returns empty for no mermaid blocks', () => {
  const content = '# No diagrams here\n\nJust text.';
  const blocks = extractMermaidBlocks(content);
  assert.equal(blocks.length, 0);
});

test('extractMermaidBlocks handles empty content', () => {
  const blocks = extractMermaidBlocks('');
  assert.equal(blocks.length, 0);
});

test('isMermaidAvailable returns boolean', () => {
  const result = isMermaidAvailable();
  assert.equal(typeof result, 'boolean');
});
