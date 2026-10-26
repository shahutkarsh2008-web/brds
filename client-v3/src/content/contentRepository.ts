import { ContentManifestSchema, PaperSchema, QuestionSchema, TaxonomySchema } from './model';
import type { ContentManifest, Paper, Taxonomy } from './model';
import { assetCacheKey, contentCache, type CachedAsset } from './contentCache';

function contentAssetUrl(contentVersion: string, path: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(contentVersion) || path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#') || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('The content manifest contains an unsafe asset path.');
  }
  return `/content/${encodeURIComponent(contentVersion)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function sha256(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const input = new Uint8Array(view.byteLength);
  input.set(view);
  const digest = await crypto.subtle.digest('SHA-256', input.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function asBytes(value: string | ArrayBuffer) {
  return typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
}

export async function fetchVerifiedAsset(contentVersion: string, path: string, expectedHash: string): Promise<Uint8Array> {
  const key = assetCacheKey(contentVersion, path);
  const url = contentAssetUrl(contentVersion, path);
  const cached = await contentCache.assets.get(key);
  if (cached && cached.sha256 === expectedHash && await sha256(asBytes(cached.payload)) === expectedHash) return asBytes(cached.payload);
  if (cached) await contentCache.assets.delete(key);
  let response: Response | null = null;
  try { response = await fetch(url); } catch { /* report unavailable immutable content below */ }
  if (response?.ok) {
    const payload = await response.arrayBuffer();
    const actualHash = await sha256(payload);
    if (actualHash !== expectedHash) {
      // If service worker or browser HTTP cache returned stale bytes for an immutable path,
      // bust the cache with an explicit hash query.
      try {
        const freshResponse = await fetch(`${url}?h=${encodeURIComponent(expectedHash)}`, { cache: 'reload' });
        if (freshResponse.ok) {
          const freshPayload = await freshResponse.arrayBuffer();
          const freshHash = await sha256(freshPayload);
          if (freshHash === expectedHash) {
            const asset: CachedAsset = { key, contentVersion, path, sha256: freshHash, payload: freshPayload, updatedAt: Date.now() };
            await contentCache.assets.put(asset);
            return new Uint8Array(freshPayload);
          }
        }
      } catch { /* proceed to throw mismatch error */ }
      throw new Error(`Content hash mismatch for ${path}.`);
    }
    const asset: CachedAsset = { key, contentVersion, path, sha256: actualHash, payload, updatedAt: Date.now() };
    await contentCache.assets.put(asset);
    return new Uint8Array(payload);
  }
  throw new Error(response ? `Content request failed (${response.status}) and no verified cache is available.` : 'Offline content is not cached yet.');
}

async function fetchVerifiedJson<T>(contentVersion: string, path: string, expectedHash: string): Promise<T> {
  const bytes = await fetchVerifiedAsset(contentVersion, path, expectedHash);
  try { return JSON.parse(new TextDecoder().decode(bytes)) as T; }
  catch { throw new Error(`Content JSON is invalid for ${path}.`); }
}

export async function loadContentManifest(contentVersion: string): Promise<ContentManifest> {
  if (!/^[a-zA-Z0-9._-]+$/.test(contentVersion)) throw new Error('The requested content version is invalid.');
  const path = `/content/${encodeURIComponent(contentVersion)}/manifest.json`;
  let response: Response;
  try {
    response = await fetch(path, { cache: 'no-cache' });
  } catch {
    const cached = await readCachedManifest(contentVersion);
    if (cached) return cached;
    throw new Error('The content manifest is unavailable online and no validated offline copy is cached.');
  }
  if (!response.ok) {
    if (response.status !== 404 && response.status >= 500) {
      const cached = await readCachedManifest(contentVersion);
      if (cached) return cached;
    }
    throw new Error(`Content manifest request failed (${response.status}).`);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('The content manifest response is not valid JSON.'); }
  const parsed = ContentManifestSchema.safeParse(payload);
  if (!parsed.success || parsed.data.contentVersion !== contentVersion) throw new Error('The content manifest is invalid or does not match the requested version.');
  await contentCache.manifests.put({ contentVersion, payload: JSON.stringify(parsed.data), updatedAt: Date.now() });
  // NID, UCEED and historical attempts may all need their downloaded original versions offline.
  return parsed.data;
}

async function readCachedManifest(contentVersion: string): Promise<ContentManifest | null> {
  const cached = await contentCache.manifests.get(contentVersion);
  if (!cached) return null;
  try {
    const parsed = ContentManifestSchema.safeParse(JSON.parse(cached.payload));
    if (parsed.success && parsed.data.contentVersion === contentVersion) return parsed.data;
  } catch { /* Remove malformed cache and surface an unavailable state. */ }
  await contentCache.manifests.delete(contentVersion);
  return null;
}

export async function loadTaxonomy(contentVersion: string, manifest: ContentManifest): Promise<Taxonomy> {
  const raw = await fetchVerifiedJson<unknown>(contentVersion, manifest.taxonomy.path, manifest.taxonomy.sha256);
  const parsed = TaxonomySchema.safeParse(raw);
  if (!parsed.success || parsed.data.contentVersion !== contentVersion) throw new Error('The taxonomy does not match its manifest version.');
  return parsed.data;
}

export async function loadQuestionShard(contentVersion: string, shard: ContentManifest['questionShards'][number]) {
  const raw = await fetchVerifiedJson<unknown>(contentVersion, shard.path, shard.sha256);
  const parsed = QuestionSchema.array().safeParse(raw);
  if (!parsed.success || parsed.data.length !== shard.count || parsed.data.some(question => question.contentVersion !== contentVersion)) {
    throw new Error('The question shard does not match its schema, count, or content version.');
  }
  return parsed.data;
}

export async function loadPaper(contentVersion: string, paperRef: ContentManifest['papers'][number]): Promise<Paper> {
  const raw = await fetchVerifiedJson<unknown>(contentVersion, paperRef.path, paperRef.sha256);
  const parsed = PaperSchema.safeParse(raw);
  if (!parsed.success || parsed.data.examKey !== paperRef.examKey) throw new Error('The paper does not match its manifest entry.');
  return parsed.data;
}

export async function loadGuide(contentVersion: string, guide: ContentManifest['guides'][number]): Promise<Uint8Array> {
  return fetchVerifiedAsset(contentVersion, guide.path, guide.sha256);
}

export async function loadMedia(contentVersion: string, media: ContentManifest['media'][number]): Promise<Uint8Array> {
  return fetchVerifiedAsset(contentVersion, media.path, media.sha256);
}

/** Fully cache a paper's questions and referenced media before promising that it can start offline. */
export async function preloadPaperForOffline(contentVersion: string, manifest: ContentManifest, paper: Paper) {
  const shard = manifest.questionShards.find(item => item.examKey === paper.examKey);
  if (!shard) throw new Error('This paper has no question bundle in the current content version.');
  const questions = await loadQuestionShard(contentVersion, shard);
  const requiredIds = new Set([...paper.questionIds, ...(paper.partBQuestionIds ?? [])]);
  const selected = questions.filter(question => requiredIds.has(question.id));
  if (selected.length !== requiredIds.size) throw new Error('This paper is missing questions from its published bundle.');
  const references = new Set(selected.flatMap(question => question.media.map(item => {
    const url = new URL(item.src, window.location.origin);
    const prefix = `/content/${encodeURIComponent(contentVersion)}/`;
    if (!url.pathname.startsWith(prefix)) throw new Error('This paper contains media outside its versioned content bundle.');
    return decodeURIComponent(url.pathname.slice(prefix.length));
  })));
  const media = manifest.media.filter(item => references.has(item.path));
  if (media.length !== references.size) throw new Error('This paper references media that is missing from its content manifest.');
  await Promise.all(media.map(item => loadMedia(contentVersion, item)));
  return { questions: selected.length, media: media.length };
}
