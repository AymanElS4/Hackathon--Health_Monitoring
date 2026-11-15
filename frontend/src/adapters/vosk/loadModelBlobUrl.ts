/** Root-relative manifest of each check-in language's split Vosk model (same origin). */
export const VOSK_MANIFEST_URLS = {
  es: '/models/vosk/parts/manifest.json',
  en: '/models/vosk/en/manifest.json',
} as const;

/** Spanish manifest, kept for callers that predate the per-language map. */
export const VOSK_MANIFEST_URL = VOSK_MANIFEST_URLS.es;

export interface ModelManifest {
  file: string;
  size: number;
  sha256: string;
  parts: { name: string; size: number }[];
}

export interface LoadModelDeps {
  fetchFn?: (url: string) => Promise<Response>;
  digest?: (data: ArrayBuffer) => Promise<ArrayBuffer>;
  createObjectURL?: (blob: Blob) => string;
}

const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf), (b) => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join('');

/**
 * Downloads the split Vosk model (manifest + parts, same origin), verifies sizes and SHA-256 and
 * returns a blob: URL for vosk-browser (005 FR-015). Any problem throws: the caller treats it as
 * "model unavailable".
 */
export async function loadModelBlobUrl(manifestUrl: string, deps: LoadModelDeps = {}): Promise<string> {
  const fetchFn = deps.fetchFn ?? ((u: string) => fetch(u));
  const digest = deps.digest ?? ((d: ArrayBuffer) => crypto.subtle.digest('SHA-256', d));
  const createObjectURL = deps.createObjectURL ?? ((b: Blob) => URL.createObjectURL(b));

  const get = async (url: string): Promise<Response> => {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`model fetch failed: ${url} (${res.status})`);
    return res;
  };

  const manifest = (await (await get(manifestUrl)).json()) as ModelManifest;
  if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error('invalid model manifest');
  }
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
  const buffers = await Promise.all(
    manifest.parts.map(async (p) => {
      const buf = await (await get(base + p.name)).arrayBuffer();
      if (buf.byteLength !== p.size) throw new Error(`model part size mismatch: ${p.name}`);
      return buf;
    }),
  );
  const joined = new Uint8Array(manifest.size);
  let offset = 0;
  for (const b of buffers) {
    if (offset + b.byteLength > joined.length) throw new Error('model parts exceed manifest size');
    joined.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  if (offset !== manifest.size) throw new Error('model size mismatch');
  if (toHex(await digest(joined.buffer)) !== manifest.sha256) throw new Error('model hash mismatch');
  return createObjectURL(new Blob([joined], { type: 'application/gzip' }));
}
