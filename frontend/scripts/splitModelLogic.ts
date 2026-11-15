/** Pure split/manifest logic for the Vosk model (005 FR-015); no file system or crypto access. */
const KIB = 1024;
export const MIB = KIB * KIB;
const MAX_PUBLISHED_MIB = 25;
const DEFAULT_PART_MIB = 20;
const PART_INDEX_WIDTH = 2;
/** Cloudflare Pages rejects any file of 25 MiB or more. */
export const MAX_PUBLISHED_FILE_BYTES = MAX_PUBLISHED_MIB * MIB;
export const DEFAULT_PART_BYTES = DEFAULT_PART_MIB * MIB;

export interface ManifestPart {
  name: string;
  size: number;
}
export interface ModelManifest {
  file: string;
  size: number;
  sha256: string;
  parts: ManifestPart[];
}

export function partName(file: string, index: number): string {
  return `${file}.part${String(index).padStart(PART_INDEX_WIDTH, '0')}`;
}

/** Splits `data` (whose hex SHA-256 is `sha256`) into consecutive chunks of at most `partBytes` and builds the manifest. */
export function splitBuffer(
  file: string,
  data: Uint8Array,
  sha256: string,
  partBytes: number = DEFAULT_PART_BYTES,
): { manifest: ModelManifest; parts: { name: string; bytes: Uint8Array }[] } {
  if (!Number.isInteger(partBytes) || partBytes <= 0) throw new Error('partBytes must be a positive integer');
  const parts: { name: string; bytes: Uint8Array }[] = [];
  for (let offset = 0, i = 0; offset < data.length; offset += partBytes, i++) {
    parts.push({ name: partName(file, i), bytes: data.subarray(offset, offset + partBytes) });
  }
  const manifest: ModelManifest = {
    file,
    size: data.length,
    sha256,
    parts: parts.map((p) => ({ name: p.name, size: p.bytes.length })),
  };
  return { manifest, parts };
}
