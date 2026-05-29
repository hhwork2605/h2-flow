# 05 — Media: Storage, Albums, Photos, Download

Bao gồm: ImageStore (3-tier blobs), ThumbnailCache, MediaRegistry, BlobUrlManager (refcounted), AlbumStore CRUD, Photos tab (browse Flow/Album/Search), DownloadExecutor (auto-download + folder template), StorageManager + Migration.

> Nguồn: `reference-ext/src/core/ImageStore.js`, `AlbumStore.js`, `ThumbnailCache.js`, `MediaRegistry.js`, `BlobUrlManager.js`, `ImageNameRegistry.js`, `DownloadExecutor.js`, `EditorExecutor.js`, `StorageManager.js`, `StorageMigration.js`, `src/photos/PhotosTab.js`, `src/albums/*`, `src/settings/StorageSettings.js`, `shared/DownloadHelper.js`, `shared/ImagePickerModal.js`.

---

## A. ImageStore (Dexie 3-tier)

Schema (v2 hiện tại; bản gốc reference v4 stores: `albums`, `album_images`, `image_blobs`, `workflow_paste_blobs`):

```ts
image_blobs: {
  id: string,              // primary key: `${imageId}__${tier}` (vd: `img_123__thumbnail`)
  imageId: string,
  tier: 'thumbnail' | 'medium' | 'original',
  blob: Blob,
  size: number,
  mime: string,
  width: number,
  height: number,
  kind: 'reference' | 'result' | 'album' | 'workflow_paste',
  created_at: number,
  expires_at?: number,
}
```

### A1. Put image (3 tiers) ✅ (P2.5)

- **Trigger:** Add refImage, save result, save to album, paste vào workflow.
- **Steps:**
  1. Đọc dimension từ blob (Image bitmap).
  2. Compress thumbnail: max 200px, WebP quality 0.85 (~20-50KB target).
  3. Compress medium: max 1200px, WebP quality 0.85 (~100KB).
  4. Giữ original (không re-encode).
  5. Bulk-put 3 entries qua Dexie transaction.
  6. Cập nhật MediaRegistry index (xem D).
- **Happy path:** 3 tiers lưu thành công, thumbnail dùng list view, medium hover/zoom, original khi tải về.
- **Case lỗi:**
  - **Canvas/WebP fail (Safari hoặc lib edge case):** retry với quality 0.7 hoặc fallback JPEG.
  - **Dexie quota exceeded:** chạy `cleanupExpired()` xoá blob expired/old; retry; vẫn fail → toast "Bộ nhớ đầy, hãy xoá ảnh cũ trong Settings → Storage".

### A2. Get image (lazy tier) ✅

- **Trigger:** UI cần render — chọn tier theo context.
- **Steps:** `getBlob({ imageId, tier })` → trả Blob trực tiếp. Tier auto-fallback: yêu cầu thumbnail nhưng tier không tồn tại → fallback medium → fallback original.
- **Case lỗi:**
  - **Entry không tồn tại:** trả `null` → UI fallback placeholder icon.
  - **Blob corrupted (read fail):** delete entry orphan, log warn.

### A3. Delete image ✅

- **Trigger:** User remove refImage, xoá khỏi album.
- **Steps:** xoá tất cả tiers `imageId__*` trong cùng transaction. Cascade: unregister khỏi MediaRegistry + ImageNameRegistry; release BlobUrlManager refs (nếu còn).
- **Case lỗi:** album_images record orphan → cleanup nightly.

### A4. Cleanup expired ✅

- **Trigger:** App init + manual qua Storage Settings.
- **Steps:** Scan `expires_at < now` → bulk delete; report bytes freed.
- **Default TTL:**
  - `reference` (refImages): không TTL (user-managed).
  - `result`: 7 ngày (configurable Settings).
  - `workflow_paste`: 24h.
  - `album`: không TTL.

---

## B. ThumbnailCache (LRU memory + persistent)

### B1. Cache thumbnail URLs ✅

- **Trigger:** UI render thumbnail → cần URL nhanh.
- **Steps:**
  1. Memory LRU map `imageId → blobURL` (cap ~100 entries).
  2. Cache miss → ImageStore.get(thumbnail tier) → `URL.createObjectURL(blob)` → put cache → trả URL.
  3. Evict LRU + `URL.revokeObjectURL` khi vượt cap.
- **Case lỗi:** Blob đã bị xoá → trả null → component fallback placeholder.

---

## C. BlobUrlManager (refcounted)

### C1. Acquire / Release ✅ (P2.5)

- **Trigger:** Component mount cần URL hiển thị blob.
- **Steps:**
  1. `acquire(imageId, tier='thumbnail')` → tăng refCount; create URL nếu chưa có.
  2. Component cleanup → `release(imageId, tier)` → giảm refCount; 0 → `URL.revokeObjectURL` + clear cache.
- **Happy path:** Memory ổn định kể cả khi user mở 1000 thumbnails (chỉ cache N visible).
- **Case lỗi:**
  - **Component unmount mà quên release:** dùng `useEffect` cleanup; nếu rò rỉ → debug bằng `BlobUrlManager.stats()` show count active.
  - **Acquire trên image đã xoá:** trả null → component xử lý placeholder.

---

## D. MediaRegistry & ImageNameRegistry

### D1. MediaRegistry — index theo nguồn ✅

- Maps: `tile_id → imageId`, `flow_file_id → imageId`, `provider_tile_id → imageId`.
- **Trigger:** Khi tile/file mới được capture/upload/generate.
- **Use case:** TileMonitor nhận `tile_id` → lookup imageId để cập nhật state.

### D2. ImageNameRegistry — @mention ✅

- Maps: `name → imageId` (case-insensitive).
- **Trigger:** User add refImage (đặt tên), capture (auto `capture_<ts>`), paste.
- **Lookup:** Khi parse prompt có `@xxx` → ImageNameRegistry.lookup(xxx) → resolve imageId.
- **Case lỗi:**
  - **Name trùng:** auto-suffix `_2`, `_3`... toast user "Đổi thành xxx_2".
  - **Name invalid (chứa space, @):** sanitize underscore.

---

## E. AlbumStore (CRUD + thumbnails)

### E1. Create album 📋

- **Trigger:** "+ New Album" trong Albums tab.
- **Steps:** `POST /albums` body `{ name, description? }` → nhận `album_id` → cache Dexie + local list.
- **Case lỗi:** name trùng → server append `(2)` hoặc inline error.

### E2. Add images to album 📋

- **Trigger:** Multi-select → "Add to album" → pick album.
- **Steps:**
  1. Mỗi imageId → ensure 3 tiers tồn tại (compress nếu chưa).
  2. `POST /albums/{albumId}/images` body `{ image_ids }`.
  3. Cache Dexie `album_images` join table.
  4. Emit `album:refresh`.
- **Case lỗi:**
  - **Quota album storage** (per-plan size cap): block + dialog upgrade.
  - **Một số image fail compress:** partial success, hiện toast "Đã thêm X/Y ảnh".

### E3. List albums (paginate + storage bar) 📋

- **Trigger:** Mở tab Albums.
- **Steps:**
  1. `GET /albums?page=1` (20/page).
  2. Cards show: name, cover (max 6 thumbnails + "+N"), total size, last update.
  3. Storage bar color: <1MB xanh / 1-5MB vàng / >5MB đỏ.
- **Case lỗi:** No covers (album rỗng) → placeholder icon.

### E4. Browse album content 📋

- **Trigger:** Click card album.
- **Steps:** Grid 2-3 col thumbnail; lazy-load qua IntersectionObserver. Click ảnh → modal viewer load medium → swap original khi zoom.
- **Case lỗi:** Image deleted server (cleanup) → placeholder + xoá khỏi UI list (sync local).

### E5. Delete album 📋

- **Trigger:** Card menu → Delete.
- **Steps:** confirm → `DELETE /albums/{id}` → soft delete (30d recovery window) → local list optimistic remove.
- **Case lỗi:**
  - **API 409 (đang có process dùng album):** retry sau 5s.
  - **Restore từ trash (P6+):** undo trong 30d.

### E6. Album thumbnail tiers (save flow) ✅

- **Trigger:** Save image vào album.
- **Steps:**
  1. Source blob từ ImageStore (đã có thumbnail/medium/original).
  2. Nếu chưa có 3 tier → compress on-demand (A1 flow).
  3. Update join table `album_images` với metadata: order, added_at, custom_name.
- **Case lỗi:** Compress fail tier → save tier khả dụng, log warn.

---

## F. Photos Tab

### F1. Album sub-tab 📋

- Browse albums giống E3, click vào → E4.

### F2. Flow Images sub-tab 📋

- **Trigger:** Mở tab.
- **Steps:**
  1. Content script scan `labs.google/fx` DOM tiles → trả list `{ tile_id, thumbnail_url, prompt }`.
  2. Render grid + actions: Copy URL, Add to album, Download, Remove from Flow.
- **Case lỗi:**
  - **Scan fail (Flow tab không mở):** show CTA "Mở Flow để hiển thị" + nút mở tab.
  - **Selector breaks:** ưu tiên fallback regex URL `https://lh3.googleusercontent.com/...`.

### F3. Search sub-tab (Pinterest/YouTube/...) 📋 (P5+)

- **Trigger:** User chọn kênh + keyword.
- **Steps:** `GET /search/{channel}?q=<keyword>&page=1` (backend proxy) → grid results, paginate scroll.
- **Case lỗi:**
  - **Timeout 30s:** retry button.
  - **Dead URL trên thumbnail:** broken-img placeholder + nút "Remove from cache".

### F4. Drag image → workflow / refImage ✅ (P3+)

- **Trigger:** Drag thumbnail từ Photos → drop vào canvas workflow hoặc refImage zone.
- **Steps:** Convert imageId → ref via MediaRegistry → add như refImage flow (B1 doc 03).
- **Case lỗi:** Drop vào node không nhận image input → reject + toast.

---

## G. DownloadExecutor

### G1. Auto-download sau generate ✅ (Settings); 📋 (real exec)

- **Trigger:** Workflow/Gen complete có `auto_download = true`.
- **Steps:**
  1. Serial queue (Flow context menu không cho parallel).
  2. Mỗi tile:
     - Mark `_inProgressTileIds.add(tileId)` (race-free).
     - `_waitForTileMediaReady(tileId)` (max 10s).
     - Build filename: template `{date}/{project}/{prompt_short}_{idx}.{ext}` (sanitize).
     - `chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' })`.
     - Wait `chrome.downloads.onChanged` → state `complete`.
  3. Mark `_downloadedTileIds.add` + remove `_inProgressTileIds`.
  4. Per-file timeout 45s.
- **Case lỗi:**
  - **Folder không tồn tại / permission denied:** fallback Downloads root + toast "Folder X không hợp lệ, đã lưu vào Downloads".
  - **Timeout 45s:** abort file, tiếp file kế.
  - **Disk full (chrome.downloads.onChanged state=interrupted reason=DISK_FULL):** abort batch + toast lớn.

### G2. Manual download single ✅

- **Trigger:** User click 📥 trên result card.
- **Steps:** giống G1 cho 1 file; `saveAs: true` (open dialog) nếu user chưa cấu hình folder.

### G3. Download as ZIP (multi-select) 📋

- **Trigger:** Multi-select results → "Download all as ZIP".
- **Steps:** Client zip qua `fflate` (in-memory), tối đa 200MB; >200MB → chia chunk hoặc server-side.
- **Case lỗi:** Browser OOM nếu user chọn 1000+ ảnh → cảnh báo trước + suggest "Tải lẻ".

### G4. Resolution tier 1K/2K/4K ✅ (Settings)

- **Trigger:** User chọn resolution trong AutoDownloadRow.
- **Steps:** Khi download, request URL provider với param resolution; nếu provider không hỗ trợ tier → fallback cao nhất khả dụng.
- **Case lỗi:**
  - **4K cần `auto_download_4k` feature:** FeatureGate check → fail → toast "Cần gói Pro để tải 4K".

---

## H. StorageManager + Migration

### H1. Storage Settings UI 📋

- **Trigger:** Settings tab → Storage section.
- **Steps:**
  1. Render `IndexedDB usage` bar (calculate qua `navigator.storage.estimate()`).
  2. Stats per kind: reference, result, album, workflow_paste — size + count.
  3. Actions: "Cleanup expired", "Clear cache (keep albums)", "Clear all (DANGER)".
- **Case lỗi:**
  - **Estimate API không support:** show fallback message.
  - **Clear all xoá nhầm albums:** confirm 2 lần + textbox gõ "DELETE" để xác nhận.

### H2. Migration version bump 📋

- **Trigger:** App khởi động phát hiện `dexie.version` cũ.
- **Steps:** Run migration scripts (vd: v1→v2 thêm field `kind`, v3 split `image_blobs` thành 3 tiers).
- **Case lỗi:**
  - **Migration crash:** rollback, log lỗi, hiện overlay "Lỗi nâng cấp storage, hãy xuất dữ liệu trước".

---

## I. Storage keys (chrome.storage) và events

| Key | Mục đích |
|---|---|
| `af_settings.download.folder` | Folder template |
| `af_settings.download.auto` | Bật/tắt auto-download |
| `af_settings.download.resolution` | 1K/2K/4K |
| `af_settings.storage.cleanup_days` | TTL cleanup |
| `af_pending_downloads` | Pending download retry across SW restart |

| Event | Khi nào |
|---|---|
| `album:refresh` | sau add/remove ảnh trong album |
| `image:added` / `image:removed` | global ImageStore mutate |
| `download:complete` / `download:failed` | per-file callback |
| `storage:quota_warning` | dexie usage > 80% |
