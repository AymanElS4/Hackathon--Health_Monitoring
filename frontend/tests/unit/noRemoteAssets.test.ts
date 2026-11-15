/**
 * FR-019 / ui-build §3 #1: every asset is self-hosted. No file that ships with
 * the app (index.html, src/**, public SVGs) may reference a remote CDN or font host.
 *
 * Uses Vite's glob import with `?raw` instead of `node:fs` because the frontend
 * has no Node typings and `tsc --noEmit` includes this test file.
 */
import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';

const SOURCE_FILES = import.meta.glob('../../src/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PUBLIC_SVGS = import.meta.glob('../../public/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const REMOTE_PATTERNS: RegExp[] = [
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /googleusercontent\.com/i,
  /unpkg\.com/i,
  /jsdelivr\.net/i,
  /\/\/cdn\./i,
  /https:\/\/cdn/i,
];

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function findRemoteReferences(text: string): string[] {
  return REMOTE_PATTERNS.filter((pattern) => pattern.test(text)).map((p) => p.source);
}

describe('no remote assets', () => {
  it('index.html has no remote font or CDN reference', () => {
    expect(findRemoteReferences(indexHtml)).toEqual([]);
  });

  it('collects at least one source file to scan', () => {
    expect(Object.keys(SOURCE_FILES).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(SOURCE_FILES))('%s has no remote font or CDN reference', (_path, text) => {
    expect(findRemoteReferences(text)).toEqual([]);
  });

  it('finds the two public SVG assets to scan', () => {
    const names = Object.keys(PUBLIC_SVGS).join('\n');
    expect(names).toContain('logo.svg');
    expect(names).toContain('crew-placeholder.svg');
  });

  it.each(Object.entries(PUBLIC_SVGS))('%s contains no http reference except the SVG namespace', (_path, text) => {
    const withoutNamespace = text.split(SVG_NAMESPACE).join('');
    expect(withoutNamespace).not.toMatch(/https?:\/\//i);
    expect(withoutNamespace).not.toMatch(/\bhttp\b/i);
  });
});
