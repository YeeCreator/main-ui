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
