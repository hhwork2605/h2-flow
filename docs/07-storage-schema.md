# 07 — Storage Schema

Có 2 backend storage chính (client-side):
1. **IndexedDB** (Dexie) — cho dữ liệu lớn (ảnh, blob, album)
2. **chrome.storage.local** — cho settings, auth, runtime flags
3. **localStorage** (chỉ dùng trong popup window cho ephemeral state)

---

## 1. IndexedDB Schema

### Database

```ts
// src/storage/db.ts
import Dexie, { Table } from 'dexie';

export class AppDB extends Dexie {
  albums!: Table<Album, string>;
  album_images!: Table<AlbumImage, string>;
  image_blobs!: Table<ImageBlob, string>;
  pending_uploads!: Table<PendingUpload, string>;
  uploaded_cache!: Table<UploadedCacheEntry, string>;
  thumbnail_cache!: Table<ThumbnailEntry, string>;

  constructor() {
    super('autoflow_pro');
    this.version(1).stores({
      pending_uploads: 'key, created_at',
      uploaded_cache: 'key, cached_at',
    });
    this.version(2).stores({
      albums: 'id, name, updated_at',
      album_images: 'id, album_id, created_at',
    });
    this.version(3).stores({
      image_blobs: 'key, cached_at, tier',
    });
    this.version(4).stores({
      thumbnail_cache: 'key, cached_at',
    }).upgrade(async (tx) => {
      // Migration: paste image feature
    });
  }
}

export const db = new AppDB();
```

### Stores

#### `albums`
| Column | Type | Notes |
|---|---|---|
| id | string (UUID) | PK |
| name | string | indexed |
| cover_image_id | string? | FK album_images |
| image_count | number | |
| created_at | string ISO | |
| updated_at | string ISO | indexed |

#### `album_images`
| Column | Type | Notes |
|---|---|---|
| id | string | PK (file_name UUID or synthetic) |
| album_id | string? | indexed (FK albums.id) |
| file_name | string? | Flow UUID |
| prompt | string | |
| ref_image_ids | string[] | |
| thumbnail_url | string | base64 50KB max |
| medium_url | string? | blob URL (TTL) |
| original_url | string? | provider CDN (short TTL) |
| provider | string | |
| model | string | |
| ratio | string | |
| width, height | number | |
| type | 'image' \| 'video' | |
| created_at | string ISO | indexed |
| expires_at | string ISO? | TTL marker |

#### `image_blobs`
| Column | Type | Notes |
|---|---|---|
| key | string | PK = `${image_id}__${tier}` |
| blob | Blob | |
| size | number | |
| mime | string | |
| tier | 'thumbnail' \| 'medium' \| 'original' | indexed |
| cached_at | number (ms) | indexed |

**Cleanup policy**:
- `tier=thumbnail`: keep ~30 ngày (rẻ)
- `tier=medium`: keep 7 ngày (default từ settings.blobMaxAgeDays)
- `tier=original`: keep 3 ngày (cost cao)
- Cron-like check khi sidebar boot: `WHERE cached_at < now - TTL → delete`

#### `pending_uploads`
| Column | Type | Notes |
|---|---|---|
| key | string | PK (sha256 of file content) |
| file_data | Blob | |
| filename | string | |
| target_provider | string | 'flow', 'chatgpt' |
| status | 'queued' \| 'uploading' \| 'failed' | |
| retry_count | number | |
| created_at | number (ms) | |
| last_error?: string | | |

#### `uploaded_cache`
Map đã upload thành công → file_name từ provider, để skip re-upload.

| Column | Type | Notes |
|---|---|---|
| key | string | PK = sha256(file) |
| file_name | string | Flow UUID returned |
| provider | string | |
| cached_at | number (ms) | TTL 24h |

#### `thumbnail_cache`
Cache HTTP thumbnail URL → blob để hiển thị offline.

| Column | Type | Notes |
|---|---|---|
| key | string | PK = url hash |
| url | string | |
| blob | Blob | |
| cached_at | number (ms) | indexed, TTL 7 days |

### Migration strategy

```ts
// v3 → v4: thêm thumbnail_cache, không phá data cũ
this.version(4).upgrade(async (tx) => {
  // No-op data migration, just schema addition
});

// v4 → v5 (future): nếu cần rename field
this.version(5).stores({...}).upgrade(async (tx) => {
  await tx.table('album_images').toCollection().modify((img) => {
    if (img.thumb_url) {
      img.thumbnail_url = img.thumb_url;
      delete img.thumb_url;
    }
  });
});
```

**Quy tắc**:
- KHÔNG bao giờ giảm DB_VERSION
- KHÔNG xoá store cũ trong cùng version (chỉ đổi tên qua copy + delete ở version mới)
- Migration phải idempotent (chạy lại không phá data)

---

## 2. chrome.storage.local Schema

Tất cả key MUST prefix `af_` (autoflow).

| Key | Type | Mô tả | TTL |
|---|---|---|---|
| `af_auth` | `AuthSession` | Token + user info | Tới logout |
| `af_settings` | `AppSettings` | User settings | Forever (sync to server qua PUT /settings) |
| `af_active_sidebar_tab` | `string` | Restore tab khi reopen panel | Forever |
| `af_running_workflow` | `RunningFlag \| null` | Cross-context lock | Auto-clear 5 min stale |
| `af_entitlements_cache` | `Entitlements` | FeatureGate cache | 30s |
| `af_models_cache` | `{ data, version, fetched_at }` | ModelRegistry | 5 min |
| `af_providers_cache` | `{ data, version, fetched_at }` | ProviderConfigManager | 5 min |
| `af_dom_selectors_cache` | `{ data, version, fetched_at }` | DOM selectors | 5 min |
| `af_system_config_cache` | `{ data, version }` | SystemConfig | 5 min |
| `af_execution_config_cache` | `{ data, version }` | ExecutionConfig | 5 min |
| `af_i18n_cache_<locale>` | `{ translations, version }` | i18next | 5 min |
| `af_announcement_dismissed` | `string[]` | IDs đã đóng | Forever |
| `af_changelog_version_seen` | `string` | Version cuối user xem changelog | Forever |
| `af_project_indicator` | `{ project_id, project_name }` | Current Flow project | Forever |
| `af_target_flow_tab_id` | `number?` | Tab Flow đang work | Reset khi tab đóng |
| `af_notification_unread_count` | `number` | Bell badge | Realtime sync via SSE |
| `af_referral_code` | `string?` | Cached từ /referral/code | Forever |
| `af_no_mercure_until` | `number?` (ms) | Skip Mercure attempt | Cleared on plan upgrade |
| `af_recent_event_ids` | `string[]` (max 50) | Ring buffer dedup SSE | In-memory + persist |
| `af_default_locale` | `'vi'\|'en'\|'th'\|'ja'` | Pre-i18n bootstrap | Forever |
| `af_theme` | `'light'\|'dark'\|'auto'` | Pre-React boot | Forever |
| `af_clone_detected` | `boolean` | Trạng thái anti-clone | Cleared on /health success |
| `af_offline` | `boolean` | Network status | Updated by background script |
| `af_screen_capture_pending` | `{ tab_id, started_at }` | Capture in progress | Cleared on complete |
| `af_logs` | `string[]` | Last 200 log entries | Ring buffer |

### Settings Sync (2-tier)

```ts
// Tier 1 LIVE — luôn override khi settings popup save
const SYNC_MAP_LIVE: Record<string, { key: keyof AppSettings; type: 'checkbox' | 'value' }> = {
  '#genTabAutoDownload':        { key: 'autoDownload', type: 'checkbox' },
  '#genChatgptDeleteAfterGen':  { key: 'chatgptDeleteAfterGen', type: 'checkbox' },
};

// Tier 2 RESPECTFUL — chỉ override nếu user CHƯA touch element
const SYNC_MAP_RESPECTFUL: Record<string, { key: keyof AppSettings; type: 'value' }> = {
  '#genType':                   { key: 'defaultGenType', type: 'value' },
  '#imageModel':                { key: 'defaultImageModel', type: 'value' },
  '#videoModel':                { key: 'defaultVideoModel', type: 'value' },
  '#flowVideoDuration':         { key: 'defaultVideoDuration', type: 'value' },
  '#grokDuration':              { key: 'grokDefaultDuration', type: 'value' },
  '#grokResolution':            { key: 'grokDefaultResolution', type: 'value' },
  '#grokImageQuality':          { key: 'grokDefaultImageQuality', type: 'value' },
  '#genTabDownloadResolution':  { key: 'downloadResolution', type: 'value' },
  '#genTabVideoDownloadResolution': { key: 'videoDownloadResolution', type: 'value' },
};
```

**Logic**:
```ts
function _syncDomFromSettings(settings: AppSettings) {
  // Tier 1: Override unconditionally
  for (const [sel, { key, type }] of Object.entries(SYNC_MAP_LIVE)) {
    const el = document.querySelector(sel);
    if (!el || settings[key] === undefined) continue;
    if (type === 'checkbox') (el as HTMLInputElement).checked = !!settings[key];
    else (el as HTMLInputElement).value = String(settings[key]);
  }

  // Tier 2: Respect user.set
  for (const [sel, { key }] of Object.entries(SYNC_MAP_RESPECTFUL)) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    if (el.dataset.userSet === 'true') continue;  // Skip — user touched
    (el as HTMLInputElement).value = String(settings[key]);
  }

  // Re-bind userSet tracking (DOM elements có thể được render dynamic)
  _bindUserSetTracking();
}

function _bindUserSetTracking() {
  for (const sel of Object.keys(SYNC_MAP_RESPECTFUL)) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el || el.dataset._userSetBound === 'true') continue;
    el.dataset._userSetBound = 'true';
    el.addEventListener('change', () => { el.dataset.userSet = 'true'; });
  }
}
```

### Listening cho changes

```ts
// React: hook listen chrome.storage
useEffect(() => {
  const handler = (changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.af_settings) {
      setSettings(changes.af_settings.newValue);
      _syncDomFromSettings(changes.af_settings.newValue);
    }
    if (changes.af_auth) {
      if (!changes.af_auth.newValue) {
        // Logged out from another context
        useAuthStore.getState().clearSession();
      }
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}, []);
```

---

## 3. localStorage (popup windows only)

| Key | Mô tả | Vì sao localStorage? |
|---|---|---|
| `af_popup_workflow_id` | Workflow đang edit trong popup | Popup window không persist qua reload chrome.storage được, ephemeral |
| `af_popup_canvas_pan_zoom` | Pan/zoom state của React Flow | Restore khi resize popup |

**Quy tắc**: KHÔNG dùng localStorage cho data quan trọng — chỉ ephemeral UI state.

---

## 4. BroadcastChannel — runtime state sync

| Channel name | Mục đích |
|---|---|
| `tobyflow-broadcast` | General event broadcast (workflow events, tracker updates) |
| `tobyflow-sse` | SSE leader-follower coordination |
| `tobyflow-execution` | Cross-context execution lock notifications |

Message format:
```ts
interface BroadcastMessage {
  type: string;
  payload: unknown;
  sender_id: string;        // tab/context UUID
  timestamp: number;
}
```

---

## 5. Quota & cleanup strategy

### Tổng dung lượng target
- IndexedDB: max 1 GB (default Chrome cho `unlimitedStorage` permission)
- chrome.storage.local: ~5 MB hard limit từ Chrome
- localStorage: 5–10 MB

### Cleanup cron
Trigger khi:
1. Sidebar boot
2. Mỗi 6h khi sidebar mở
3. Manual từ Settings → Storage → "Clean now"

```ts
async function cleanupCron() {
  const settings = await getSettings();
  const now = Date.now();

  // 1. Cleanup expired blobs
  const blobCutoff = now - settings.blobMaxAgeDays * 86400 * 1000;
  await db.image_blobs
    .where('cached_at')
    .below(blobCutoff)
    .delete();

  // 2. Cleanup uploaded_cache > 24h
  await db.uploaded_cache
    .where('cached_at')
    .below(now - 86400_000)
    .delete();

  // 3. Cleanup thumbnail_cache > 7 days
  await db.thumbnail_cache
    .where('cached_at')
    .below(now - 7 * 86400_000)
    .delete();

  // 4. Revoke leaked blob URLs
  BlobUrlManager.cleanupStale();

  // 5. Trim af_logs ring buffer
  const logs = await getStorage('af_logs') as string[] || [];
  if (logs.length > 200) {
    await setStorage('af_logs', logs.slice(-200));
  }
}
```

### Quota check trước khi write

```ts
async function checkStorageQuota(): Promise<{ usage: number; quota: number; pct: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0, pct: 0 };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const pct = quota > 0 ? (usage / quota) * 100 : 0;
  return { usage, quota, pct };
}

async function beforeWrite(estimatedSize: number) {
  const { pct } = await checkStorageQuota();
  if (pct > 90) {
    await cleanupCron();
    const after = await checkStorageQuota();
    if (after.pct > 95) {
      throw new Error('STORAGE_FULL');
    }
  }
}
```

---

## 6. BlobUrlManager (track URL.createObjectURL)

```ts
class BlobUrlManager {
  private static urls = new Map<string, { url: string; createdAt: number }>();

  static create(key: string, blob: Blob): string {
    this.revoke(key);  // Revoke previous URL với cùng key
    const url = URL.createObjectURL(blob);
    this.urls.set(key, { url, createdAt: Date.now() });
    return url;
  }

  static revoke(key: string) {
    const entry = this.urls.get(key);
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.urls.delete(key);
    }
  }

  static cleanupStale(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    for (const [key, { createdAt }] of this.urls) {
      if (now - createdAt > maxAgeMs) {
        this.revoke(key);
      }
    }
  }

  static revokeAll() {
    for (const { url } of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

// Trên page unload
window.addEventListener('beforeunload', () => BlobUrlManager.revokeAll());
```

---

## 7. Typed wrapper

```ts
// src/storage/chrome-storage.ts

export async function getStorage<T = unknown>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve((res[key] ?? null) as T | null));
  });
}

export async function setStorage<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
}

export async function removeStorage(...keys: string[]): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

export function onStorageChange<T = unknown>(
  key: string,
  callback: (newValue: T | null, oldValue: T | null) => void
): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return;
    if (!(key in changes)) return;
    callback(changes[key].newValue as T | null, changes[key].oldValue as T | null);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
```

---

## 8. Server settings sync

User settings được mirror lên backend qua:
- `GET /settings` → load khi login
- `PUT /settings` → save khi user thay đổi (debounce 1s)

```ts
async function syncSettingsToServer(settings: AppSettings) {
  // Debounced để tránh spam
  await apiClient.put('settings', { json: settings });
}

// Khi receive auth:restored event → fetch settings từ server và merge
eventBus.on('auth:restored', async () => {
  const serverSettings = await apiClient.get('settings').json<AppSettings>();
  const localSettings = await getStorage<AppSettings>('af_settings');
  // Server wins, nhưng giữ local-only keys
  const merged = { ...localSettings, ...serverSettings };
  await setStorage('af_settings', merged);
});
```
