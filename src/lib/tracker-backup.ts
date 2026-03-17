const TRACKER_STATE_KEYS = [
  'tracker_state',
  'p2p_tracker_state',
  'p2p_tracker',
  'taheito_tracker_state',
  'taheito_state',
] as const;

const TRACKER_STATE_PREFIXES = ['taheito', 'p2p_tracker'] as const;

const TRACKER_CLEAR_EXACT_KEYS = [
  'tracker_state',
  'tracker_settings',
  'tracker_logs',
  'p2p_tracker_state',
  'p2p_tracker',
  'taheito_tracker_state',
  'taheito_state',
  'p2p_tracker_vault_meta',
] as const;

const IMPORT_STATE_CANDIDATE_KEYS = [
  'state',
  'trackerState',
  'tracker_state',
  'data',
  'payload',
  'appState',
  'backup',
  'snapshot',
  'content',
] as const;

export const CLOUD_URL_KEYS = ['gas_url', 'tracker_cloud_url', 'taheito_cloud_url'] as const;
export const AUTO_BACKUP_KEYS = ['gasAutoSave', 'trackerAutoBackup', 'taheitoAutoBackup'] as const;

export type TrackerState = Record<string, unknown>;

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeTrackerState(value: unknown): value is TrackerState {
  if (!isObject(value)) return false;
  if (Array.isArray(value.trades) || Array.isArray(value.batches) || Array.isArray(value.customers)) return true;
  return false;
}

function extractFromSnapshots(value: Record<string, unknown>): TrackerState | null {
  if (Array.isArray(value.snapshots)) {
    for (const snap of value.snapshots) {
      if (isObject(snap) && looksLikeTrackerState(snap.state)) {
        return snap.state;
      }
    }
  }
  if (Array.isArray(value.versions)) {
    for (const version of value.versions) {
      if (isObject(version) && looksLikeTrackerState(version.state)) return version.state;
      if (isObject(version) && isObject(version.content) && looksLikeTrackerState(version.content.state)) return version.content.state;
    }
  }
  return null;
}

export function normalizeImportedTrackerState(raw: unknown): TrackerState {
  if (looksLikeTrackerState(raw)) return raw;
  if (!isObject(raw)) throw new Error('Invalid backup format');

  const fromSnapshots = extractFromSnapshots(raw);
  if (fromSnapshots) return fromSnapshots;

  for (const key of IMPORT_STATE_CANDIDATE_KEYS) {
    const candidate = raw[key];
    if (looksLikeTrackerState(candidate)) return candidate;
    if (isObject(candidate)) {
      for (const nestedKey of IMPORT_STATE_CANDIDATE_KEYS) {
        const nested = candidate[nestedKey];
        if (looksLikeTrackerState(nested)) return nested;
      }
    }
  }

  throw new Error('Invalid backup format');
}

export function findTrackerStorageKey(storage: Storage): string {
  const existing = storageKeys(storage).find((k) => TRACKER_STATE_PREFIXES.some((prefix) => k.startsWith(prefix)) || TRACKER_STATE_KEYS.includes(k as any));
  return existing || TRACKER_STATE_KEYS[0];
}

export function getCurrentTrackerState(storage: Storage): TrackerState {
  try {
    const key = findTrackerStorageKey(storage);
    const value = storage.getItem(key);
    if (!value) return {};
    return normalizeImportedTrackerState(JSON.parse(value));
  } catch {
    return {};
  }
}

export function loadCloudUrlFromStorage(storage: Storage): string {
  for (const key of CLOUD_URL_KEYS) {
    const value = storage.getItem(key);
    if (value?.trim()) return value.trim();
  }
  return '';
}

export function saveCloudUrlToStorage(storage: Storage, url: string): void {
  for (const key of CLOUD_URL_KEYS) storage.setItem(key, url);
}

export function loadAutoBackupFromStorage(storage: Storage): boolean {
  for (const key of AUTO_BACKUP_KEYS) {
    const value = storage.getItem(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return false;
}

export function saveAutoBackupToStorage(storage: Storage, value: boolean): void {
  for (const key of AUTO_BACKUP_KEYS) storage.setItem(key, String(value));
}

export function listTrackerKeysToClear(storage: Storage): string[] {
  const keys = new Set<string>([
    ...TRACKER_CLEAR_EXACT_KEYS,
    ...CLOUD_URL_KEYS,
    ...AUTO_BACKUP_KEYS,
  ]);

  for (const key of storageKeys(storage)) {
    if (TRACKER_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.add(key);
    if (key.startsWith('tracker_')) keys.add(key);
  }

  return Array.from(keys);
}

export function clearTrackerStorage(storage: Storage): void {
  for (const key of listTrackerKeysToClear(storage)) {
    storage.removeItem(key);
  }
}
