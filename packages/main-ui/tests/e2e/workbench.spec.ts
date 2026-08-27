import { expect, test } from '@playwright/test';

test('renders demo workbench and switches host profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();
  await page.getByTitle('Matheshop').click();
  await expect(page.getByRole('heading', { name: 'Formula canvas viewport' })).toBeVisible();
});

test('preset view template loads via mock adapter (loading then data)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();

  // 一期模板经模拟后端适配层异步取数：先三态 loading，再经 Props 回流呈现数据
  await page.locator('select.main-ui-editor-select').first().selectOption('view-tree');
  const tree = page.locator('.main-ui-view-tree');
  await expect(tree.getByText('Loading…')).toBeVisible();
  await expect(tree.getByText('module-1')).toBeVisible();
  await expect(tree.getByText('Loading…')).toHaveCount(0);
});

test('docking guide: five-zone indicator appears and edge drop splits the target group', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();

  // 打开一个可拖拽编辑器，再分割出第二个空组作为落点目标
  await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  await page.getByTitle('Split right').first().click();
  await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);

  // 模拟原生拖拽：源页签 dragstart → 目标组右边缘 dragover
  await page.evaluate(() => {
    const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
    const target = document.querySelectorAll('.main-ui-leaf-group')[1];
    if (!sourceTab || !target) throw new Error('drag fixture missing');
    const dataTransfer = new DataTransfer();
    sourceTab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer,
      clientX: rect.right - 8, clientY: rect.top + rect.height / 2,
    }));
  });

  // 五向落点指示器出现（含 Ghost 预览），非法/合法状态由能力标记裁决（默认全合法）
  const indicator = page.locator('.main-ui-dock-indicator');
  await expect(indicator).toBeVisible();
  await expect(indicator.locator('.main-ui-dock-indicator__zone')).toHaveCount(5);
  await expect(indicator.locator('.main-ui-dock-indicator__zone.is-right.is-active')).toHaveCount(1);

  // 落点确认 → 落 action：目标组右侧新增分割组持有被拖页签，原组保留（快照只存引用）
  await page.evaluate(() => {
    const target = document.querySelectorAll('.main-ui-leaf-group')[1];
    const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
    if (!target || !sourceTab) throw new Error('drag fixture missing');
    const dataTransfer = new DataTransfer();
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer,
      clientX: rect.right - 8, clientY: rect.top + rect.height / 2,
    }));
    sourceTab.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  await expect(page.locator('.main-ui-leaf-group')).toHaveCount(3);
  await expect(page.locator('.main-ui-dock-indicator')).toHaveCount(0);
});

test('docking guide: cancelled drag leaves layout untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();
  await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  await page.getByTitle('Split right').first().click();
  await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);

  // dragstart → dragover → dragend（Esc 取消等价路径）：不落 action，布局与指示器无残留
  await page.evaluate(() => {
    const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
    const target = document.querySelectorAll('.main-ui-leaf-group')[1];
    if (!sourceTab || !target) throw new Error('drag fixture missing');
    const dataTransfer = new DataTransfer();
    sourceTab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    sourceTab.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);
  await expect(page.locator('.main-ui-dock-indicator')).toHaveCount(0);
});

test('floating window popout, dock back and out-of-viewport clamp', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();

  // 打开允许浮动的 Table 编辑器后拖出入口才出现（能力门控）
  await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  const popoutButton = page.getByTitle('Pop out to floating window');
  await expect(popoutButton).toBeVisible();
  await popoutButton.click();

  const floatingWindow = page.locator('.main-ui-floating-window');
  await expect(floatingWindow).toBeVisible();

  // 拖回主布局后窗口回收
  await floatingWindow.getByTitle('Dock back to workbench').click();
  await expect(floatingWindow).toHaveCount(0);

  // 再次拖出，向快照注入越界坐标，重载后应自动归位主视口内
  await popoutButton.click();
  await expect(floatingWindow).toBeVisible();
  await page.evaluate(() => {
    const raw = localStorage.getItem('main-ui:demo-workbench:v1');
    if (!raw) return;
    const documentState = JSON.parse(raw) as {
      activeWorkspaceId: string;
      workspaceStates: Record<string, { floatingWindows?: Record<string, { position: { x: number; y: number } }> }>;
    };
    const workspace = documentState.workspaceStates[documentState.activeWorkspaceId];
    for (const floatingWindow of Object.values(workspace.floatingWindows ?? {})) {
      floatingWindow.position = { x: 20000, y: 20000 };
    }
    localStorage.setItem('main-ui:demo-workbench:v1', JSON.stringify(documentState));
  });
  await page.reload();
  await expect(floatingWindow).toBeVisible();
  const box = await floatingWindow.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeLessThan(viewport!.width);
  expect(box!.y).toBeLessThan(viewport!.height);
  expect(box!.x).toBeGreaterThanOrEqual(-(box!.width - 32));
});
