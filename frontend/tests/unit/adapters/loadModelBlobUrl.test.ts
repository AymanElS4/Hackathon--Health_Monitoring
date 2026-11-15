import { describe, expect, it, vi } from 'vitest';
import { VOSK_MANIFEST_URL, VOSK_MANIFEST_URLS, loadModelBlobUrl } from '../../../src/adapters/vosk/loadModelBlobUrl';
import { splitBuffer } from '../../../scripts/splitModelLogic';

const MANIFEST = 'http://x/models/vosk/parts/manifest.json';
const sha = (d: ArrayBuffer) => crypto.subtle.digest('SHA-256', d);
const hex = async (d: Uint8Array) =>
  Array.from(new Uint8Array(await sha(d.slice().buffer)), (b) => b.toString(16).padStart(2, '0')).join('');

async function setup(drop?: string, corrupt = false) {
  const data = Uint8Array.from({ length: 25 }, (_, i) => i);
  const { manifest, parts } = splitBuffer('m.tar.gz', data, await hex(data), 10);
  const files = new Map<string, Uint8Array>(parts.map((p) => [p.name, p.bytes]));
  if (corrupt) files.get(parts[1]!.name)![0] = 99;
  if (drop) files.delete(drop);
  const fetchFn = vi.fn(async (url: string) => {
    if (url === MANIFEST) return new Response(JSON.stringify(manifest));
    const f = files.get(url.split('/').pop()!);
    return f ? new Response(f.slice().buffer) : new Response('', { status: 404 });
  });
  const createObjectURL = vi.fn(() => 'blob:ok');
  return { fetchFn, createObjectURL, manifest, data, run: () => loadModelBlobUrl(MANIFEST, { fetchFn, digest: sha, createObjectURL }) };
}

describe('loadModelBlobUrl', () => {
  it('joins parts in order into a gzip blob URL', async () => {
    const s = await setup();
    await expect(s.run()).resolves.toBe('blob:ok');
    const blob = (s.createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('application/gzip');
    const bytes = await new Promise<ArrayBuffer>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as ArrayBuffer);
      r.readAsArrayBuffer(blob);
    });
    expect(new Uint8Array(bytes)).toEqual(s.data);
    expect(s.fetchFn).toHaveBeenCalledWith('http://x/models/vosk/parts/m.tar.gz.part02');
  });

  it('rejects when a part is missing', async () => {
    const s = await setup('m.tar.gz.part01');
    await expect(s.run()).rejects.toThrow();
    expect(s.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects on hash mismatch', async () => {
    const s = await setup(undefined, true);
    await expect(s.run()).rejects.toThrow(/hash/);
    expect(s.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('VOSK_MANIFEST_URLS', () => {
  it('maps each check-in language to its own manifest; es stays the compatibility default', () => {
    expect(VOSK_MANIFEST_URLS).toEqual({
      es: '/models/vosk/parts/manifest.json',
      en: '/models/vosk/en/manifest.json',
    });
    expect(VOSK_MANIFEST_URL).toBe(VOSK_MANIFEST_URLS.es);
  });

  it('fetches the English parts from the English manifest directory', async () => {
    const data = Uint8Array.from({ length: 25 }, (_, i) => i);
    const { manifest, parts } = splitBuffer('m.tar.gz', data, await hex(data), 10);
    const bodies = new Map<string, Uint8Array>(parts.map((p) => [p.name, p.bytes]));
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/models/vosk/en/manifest.json') return new Response(JSON.stringify(manifest));
      const f = bodies.get(url.split('/').pop()!);
      return f ? new Response(f.slice().buffer) : new Response('', { status: 404 });
    });
    const createObjectURL = vi.fn(() => 'blob:en');
    await expect(
      loadModelBlobUrl(VOSK_MANIFEST_URLS.en, { fetchFn, digest: sha, createObjectURL }),
    ).resolves.toBe('blob:en');
    expect(fetchFn).toHaveBeenCalledWith('/models/vosk/en/m.tar.gz.part00');
    expect(fetchFn).toHaveBeenCalledWith('/models/vosk/en/m.tar.gz.part02');
  });
});
