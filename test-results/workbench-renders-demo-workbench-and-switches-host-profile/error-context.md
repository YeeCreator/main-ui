# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workbench.spec.ts >> renders demo workbench and switches host profile
- Location: packages/main-ui/tests/e2e/workbench.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Formula canvas viewport' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Formula canvas viewport' })

```

```yaml
- application "main-ui workbench":
  - complementary "Workspaces":
    - button "DM Demo"
    - button "IN Inspector"
    - button "AU Docs"
    - button "MA Canvas" [pressed]
    - button "MA Matches"
    - button "⚙ Settings"
  - banner:
    - text: MA
    - strong: Canvas
    - text: Canvas-heavy host fixture
    - button "◧"
    - button "◨"
    - button "▤"
    - button "▥"
    - button "↻"
    - button "☾"
  - main:
    - button "PA Math tools ×"
    - button "›"
    - button "⋯"
    - combobox "Open editor":
      - option "+" [selected]
      - option "Panel"
      - option "Canvas"
      - option "Viewport"
      - option "Dual output"
      - option "Minimap"
      - option "Inspector"
      - option "Settings"
    - button "↺" [disabled]
    - button "◧"
    - button "◨"
    - button "▤"
    - button "▥"
    - button "×"
    - button "□"
    - region "Panel":
      - heading "Math tools" [level=3]
      - paragraph: Tool palettes, colors, symbols and history.
      - strong: Workspace
      - paragraph: canvas-workspace
      - strong: Editor kind
      - paragraph: profile-panel
      - strong: Payload
      - paragraph: "{\"title\":\"Math tools\",\"description\":\"Tool palettes, colors, symbols and history.\"}"
    - separator
    - button "VI Formula canvas ×"
    - button "DU Dual output demo ×"
    - button "MI Minimap demo ×"
    - combobox "Open editor":
      - option "+" [selected]
      - option "Panel"
      - option "Canvas"
      - option "Viewport"
      - option "Dual output"
      - option "Minimap"
      - option "Inspector"
      - option "Settings"
    - button "↺" [disabled]
    - button "⇱"
    - button "◧"
    - button "◨"
    - button "▤"
    - button "▥"
    - button "×"
    - button "□"
    - region "Minimap":
      - strong: 缩略导航：一个抽象，两种画法
      - text: 点击下方任一缩略图，主视口跳到该处（两张图的坐标数学完全相同） 100%
      - heading "① 质点画法（游戏小地图）" [level=4]
      - paragraph: 每个实体画成质点，半径固定为像素值 —— 缩放缩略图尺寸时点不跟着变大。
      - img "缩略导航"
      - heading "② 缩略画法（画布导航）" [level=4]
      - paragraph:
        - text: 单元按比例画成框，点实体给最小可视尺寸 —— 与左边
        - strong: 同一份数据、同一套坐标映射
        - text: 。
      - img "缩略导航"
    - separator
    - button "IN Formula inspector ×"
    - button "›"
    - button "⋯"
    - combobox "Open editor":
      - option "+" [selected]
      - option "Panel"
      - option "Canvas"
      - option "Viewport"
      - option "Dual output"
      - option "Minimap"
      - option "Inspector"
      - option "Settings"
    - button "↺" [disabled]
    - button "⇱"
    - button "◧"
    - button "◨"
    - button "▤"
    - button "▥"
    - button "×"
    - button "□"
    - region "Inspector":
      - heading "Inspector" [level=3]
      - paragraph: Represents property panels, detail views and contextual side surfaces.
      - text: Selection
      - textbox: editor-instance
      - text: Status
      - textbox: Active
      - text: Surface
      - textbox: leaf group
      - text: Payload
      - textbox: "{}"
  - contentinfo:
    - button "⚙"
    - text: "Workspace: canvas-workspace Groups: 3 Tabs: 5"
    - button "☼ 浅色"
    - button "☾ 深色"
    - button "◐ 自动"
    - button "↻ 重置布局"
    - text: "Theme: system / light"
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | 
  3   | test('renders demo workbench and switches host profile', async ({ page }) => {
  4   |   await page.goto('/');
  5   |   await expect(page.getByText('main-ui workbench')).toBeVisible();
  6   |   await page.getByTitle('Canvas').click();
> 7   |   await expect(page.getByRole('heading', { name: 'Formula canvas viewport' })).toBeVisible();
      |                                                                                ^ Error: expect(locator).toBeVisible() failed
  8   | });
  9   | 
  10  | test('preset view template loads via mock adapter (loading then data)', async ({ page }) => {
  11  |   await page.goto('/');
  12  |   await expect(page.getByText('main-ui workbench')).toBeVisible();
  13  | 
  14  |   // 一期模板经模拟后端适配层异步取数：先三态 loading，再经 Props 回流呈现数据
  15  |   await page.locator('select.main-ui-editor-select').first().selectOption('view-tree');
  16  |   const tree = page.locator('.main-ui-view-tree');
  17  |   await expect(tree.getByText('Loading…')).toBeVisible();
  18  |   await expect(tree.getByText('module-1')).toBeVisible();
  19  |   await expect(tree.getByText('Loading…')).toHaveCount(0);
  20  | });
  21  | 
  22  | test('docking guide: five-zone indicator appears and edge drop splits the target group', async ({ page }) => {
  23  |   await page.goto('/');
  24  |   await expect(page.getByText('main-ui workbench')).toBeVisible();
  25  | 
  26  |   // 打开一个可拖拽编辑器，再分割出第二个空组作为落点目标
  27  |   await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  28  |   await page.getByTitle('Split right').first().click();
  29  |   await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);
  30  | 
  31  |   // 模拟原生拖拽：源页签 dragstart → 目标组右边缘 dragover
  32  |   await page.evaluate(() => {
  33  |     const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
  34  |     const target = document.querySelectorAll('.main-ui-leaf-group')[1];
  35  |     if (!sourceTab || !target) throw new Error('drag fixture missing');
  36  |     const dataTransfer = new DataTransfer();
  37  |     sourceTab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
  38  |     const rect = target.getBoundingClientRect();
  39  |     target.dispatchEvent(new DragEvent('dragover', {
  40  |       bubbles: true, cancelable: true, dataTransfer,
  41  |       clientX: rect.right - 8, clientY: rect.top + rect.height / 2,
  42  |     }));
  43  |   });
  44  | 
  45  |   // 五向落点指示器出现（含 Ghost 预览），非法/合法状态由能力标记裁决（默认全合法）
  46  |   const indicator = page.locator('.main-ui-dock-indicator');
  47  |   await expect(indicator).toBeVisible();
  48  |   await expect(indicator.locator('.main-ui-dock-indicator__zone')).toHaveCount(5);
  49  |   await expect(indicator.locator('.main-ui-dock-indicator__zone.is-right.is-active')).toHaveCount(1);
  50  | 
  51  |   // 落点确认 → 落 action：目标组右侧新增分割组持有被拖页签，原组保留（快照只存引用）
  52  |   await page.evaluate(() => {
  53  |     const target = document.querySelectorAll('.main-ui-leaf-group')[1];
  54  |     const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
  55  |     if (!target || !sourceTab) throw new Error('drag fixture missing');
  56  |     const dataTransfer = new DataTransfer();
  57  |     const rect = target.getBoundingClientRect();
  58  |     target.dispatchEvent(new DragEvent('drop', {
  59  |       bubbles: true, cancelable: true, dataTransfer,
  60  |       clientX: rect.right - 8, clientY: rect.top + rect.height / 2,
  61  |     }));
  62  |     sourceTab.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  63  |   });
  64  |   await expect(page.locator('.main-ui-leaf-group')).toHaveCount(3);
  65  |   await expect(page.locator('.main-ui-dock-indicator')).toHaveCount(0);
  66  | });
  67  | 
  68  | test('docking guide: cancelled drag leaves layout untouched', async ({ page }) => {
  69  |   await page.goto('/');
  70  |   await expect(page.getByText('main-ui workbench')).toBeVisible();
  71  |   await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  72  |   await page.getByTitle('Split right').first().click();
  73  |   await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);
  74  | 
  75  |   // dragstart → dragover → dragend（Esc 取消等价路径）：不落 action，布局与指示器无残留
  76  |   await page.evaluate(() => {
  77  |     const sourceTab = document.querySelector('.main-ui-leaf-group .main-ui-tab');
  78  |     const target = document.querySelectorAll('.main-ui-leaf-group')[1];
  79  |     if (!sourceTab || !target) throw new Error('drag fixture missing');
  80  |     const dataTransfer = new DataTransfer();
  81  |     sourceTab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
  82  |     const rect = target.getBoundingClientRect();
  83  |     target.dispatchEvent(new DragEvent('dragover', {
  84  |       bubbles: true, cancelable: true, dataTransfer,
  85  |       clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  86  |     }));
  87  |     sourceTab.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  88  |   });
  89  |   await expect(page.locator('.main-ui-leaf-group')).toHaveCount(2);
  90  |   await expect(page.locator('.main-ui-dock-indicator')).toHaveCount(0);
  91  | });
  92  | 
  93  | test('floating window popout, dock back and out-of-viewport clamp', async ({ page }) => {
  94  |   await page.goto('/');
  95  |   await expect(page.getByText('main-ui workbench')).toBeVisible();
  96  | 
  97  |   // 打开允许浮动的 Table 编辑器后拖出入口才出现（能力门控）
  98  |   await page.locator('select.main-ui-editor-select').first().selectOption('table-demo');
  99  |   const popoutButton = page.getByTitle('Pop out to floating window');
  100 |   await expect(popoutButton).toBeVisible();
  101 |   await popoutButton.click();
  102 | 
  103 |   const floatingWindow = page.locator('.main-ui-floating-window');
  104 |   await expect(floatingWindow).toBeVisible();
  105 | 
  106 |   // 拖回主布局后窗口回收
  107 |   await floatingWindow.getByTitle('Dock back to workbench').click();
```