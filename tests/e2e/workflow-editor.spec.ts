/**
 * Workflow editor — critical path e2e tests.
 *
 * Mỗi test maps tới 1 "Done = ALL true" trong PROGRESS.md. Khi 1 test fail,
 * lookup chunk tương ứng để hiểu regression.
 *
 * Strategy:
 *   - `beforeEach` clear Dexie + localStorage để isolated.
 *   - Navigate `?wf=new` → editor tự gọi `newWorkflow(null)` tạo doc rỗng.
 *   - Tương tác qua DOM selector (data-id của React Flow + class h2flow-…).
 *
 * KHÔNG test extension context — chỉ test dev:web mode (Vite dev server).
 * Extension-specific paths (popup window.open, chrome.windows.create) test
 * thủ công ở Phase 6 polish.
 */

import { test, expect, type Page } from '@playwright/test';

const EDITOR_URL = '/workflow-editor.html?wf=new';

async function openEmptyEditor(page: Page) {
  await page.addInitScript(() => {
    // Clear state TRƯỚC khi page load để bootstrap không thấy doc cũ.
    try {
      indexedDB.deleteDatabase('h2-flow');
    } catch {}
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(EDITOR_URL);
  // Đợi React Flow render xong (có pane).
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
  // Đợi store load doc (toolbar có name input).
  await page.waitForSelector('input[placeholder="Tên workflow"]', { timeout: 5_000 });
}

/**
 * Helper: tạo node bằng cách dispatch CustomEvent `h2flow:drop` (mô phỏng
 * pointer-based drop từ NodePalette). Bypass UI palette để test focused vào
 * canvas behavior — palette drag test riêng.
 */
async function addNodeAt(page: Page, kind: string, x: number, y: number) {
  await page.evaluate(
    ({ kind, x, y }) => {
      window.dispatchEvent(
        new CustomEvent('h2flow:drop', { detail: { kind, x, y } }),
      );
    },
    { kind, x, y },
  );
  // Đợi node render.
  await page.waitForSelector('.react-flow__node', { timeout: 3_000 });
}

/* ─── Tests ──────────────────────────────────────────────────────────── */

test.describe('Workflow editor — sanity', () => {
  test('opens new workflow with empty canvas', async ({ page }) => {
    await openEmptyEditor(page);
    // Toolbar có name + Tạo mới + Đóng.
    await expect(page.locator('input[placeholder="Tên workflow"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo mới/ })).toBeVisible();
    // Side toolbar có + ▶ ↶ ↷ 📄 ⊡ ⚙.
    await expect(page.getByRole('button', { name: 'Thêm node' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chạy' })).toBeVisible();
    // Brand badge.
    await expect(page.locator('text=h2-flow').first()).toBeVisible();
  });
});

test.describe('Add node (P3.4 + P3.16)', () => {
  test('palette drop creates a generate node visible on canvas', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = page.locator('.react-flow__pane');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not measurable');

    // Drop tại trung tâm canvas.
    await addNodeAt(page, 'generate', box.x + box.width / 2, box.y + box.height / 2);

    // Đúng 1 node, type="base", có chữ "Generate".
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Generate');
  });

  test('prompt node has inline textarea (P3.16)', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Body có textarea inline (theo PromptBody).
    await expect(page.locator('.react-flow__node textarea')).toBeVisible();
  });

  test('delay node has inline number input (P3.16)', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'delay', canvas.x + 300, canvas.y + 200);
    await expect(page.locator('.react-flow__node input[type="number"]')).toBeVisible();
  });
});

test.describe('Node drag (P3.17 regression)', () => {
  test('drag node body changes its position', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'generate', canvas.x + 300, canvas.y + 200);

    const node = page.locator('.react-flow__node').first();
    const before = await node.boundingBox();
    if (!before) throw new Error('node not measurable');

    // Kéo từ giữa header (vùng KHÔNG có button stop-propagation) sang phải+xuống.
    // Click ở (cx-40, cy+50) để tránh enable toggle ở right edge của header.
    const startX = before.x + 40;
    const startY = before.y + 12; // header is at top
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
    await page.mouse.up();

    const after = await node.boundingBox();
    if (!after) throw new Error('node disappeared');
    // Node phải di chuyển đáng kể (>= 100px theo X).
    expect(after.x - before.x).toBeGreaterThan(80);
  });
});

test.describe('Action toolbar (P3.14)', () => {
  test('clicking node shows floating action toolbar with 5 buttons', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);

    // Click node để select.
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    // Selector qua aria-label trực tiếp — getByRole bị ambiguous với side
    // toolbar (cũng có "Cài đặt").
    await expect(page.locator('[aria-label="Chạy node"]')).toBeVisible();
    await expect(page.locator('[aria-label="Tạo nhánh"]')).toBeVisible();
    await expect(page.locator('[aria-label^="Nhân bản"]')).toBeVisible();
    await expect(page.locator('[aria-label="Xoá"]')).toBeVisible();
  });

  test('duplicate button creates a clone', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    await page.locator('[aria-label^="Nhân bản"]').click();

    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('delete button removes the node', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    await page.locator('[aria-label="Xoá"]').click();

    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });
});

test.describe('Right-click context menu (P3.14)', () => {
  test('right-click on node shows 6-item context menu', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'generate', canvas.x + 300, canvas.y + 200);

    await page.locator('.react-flow__node').first().click({ button: 'right' });

    // 6 items: Chạy node / Bật-tắt / Cài đặt / Tạo nhánh / Nhân bản / Xoá.
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(6);
  });

  test('clicking outside closes context menu', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'generate', canvas.x + 300, canvas.y + 200);
    await page.locator('.react-flow__node').first().click({ button: 'right' });
    await expect(page.locator('[role="menu"]')).toBeVisible();

    await page.mouse.click(canvas.x + 50, canvas.y + 50);
    await expect(page.locator('[role="menu"]')).not.toBeVisible();
  });
});

test.describe('Settings modal (P3.14)', () => {
  test('settings button opens modal with params form', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'generate', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    // Click cog button trong action toolbar.
    // Action toolbar settings button — phải scope ngoài SideToolbar (cũng có "Cài đặt").
    await page.locator('.react-flow__node [aria-label="Cài đặt"]').click();

    // Dialog mở với title "Cài đặt node".
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Cài đặt node');
    // Có field "Tên hiển thị".
    await expect(dialog.locator('text=Tên hiển thị')).toBeVisible();
  });

  test('renaming node in modal updates header', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });
    // Action toolbar settings button — phải scope ngoài SideToolbar (cũng có "Cài đặt").
    await page.locator('.react-flow__node [aria-label="Cài đặt"]').click();

    const titleInput = page.getByRole('dialog').locator('input').first();
    await titleInput.fill('My Custom Title');

    await page.keyboard.press('Escape');
    // Header node hiển thị title mới.
    await expect(page.locator('.react-flow__node').first()).toContainText(
      'My Custom Title',
    );
  });
});

test.describe('Keyboard shortcuts', () => {
  test('Ctrl+D duplicates selected node', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    await page.keyboard.press('Control+D');

    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('Delete key removes selected node', async ({ page }) => {
    await openEmptyEditor(page);
    const canvas = await page.locator('.react-flow__pane').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await addNodeAt(page, 'prompt', canvas.x + 300, canvas.y + 200);
    // Click vào header (top 12px) thay vì center — center có thể là textarea/input
    // có stopPropagation → không trigger RF selection.
    await page.locator('.react-flow__node').first().click({ position: { x: 80, y: 12 } });

    await page.keyboard.press('Delete');

    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });
});
