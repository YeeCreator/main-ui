import { describe, expect, test } from 'vitest';
import { hostProfileEditors, hostProfileValidationCases, hostProfileWorkspaces } from '../../../../demo/src/runtime/hostProfiles';

// 官方视图模板（一期 + 二期）经模板包在宿主运行时动态注册（见 demo registerPresetViewEditors），
// 不随 hostProfileEditors 夹具静态声明，这里并入其 kind 以还原真实注册集合。
const PRESET_VIEW_EDITOR_KINDS = [
  'view-tree', 'view-inspector', 'view-2d', 'view-table',
  'view-form', 'view-node', 'view-console',
];
const editorKinds = new Set([...hostProfileEditors.map((editor) => editor.kind), ...PRESET_VIEW_EDITOR_KINDS]);

describe('host profile fixtures', () => {
  test('all workspace editor references are registered', () => {
    for (const workspace of hostProfileWorkspaces) {
      for (const editorKind of workspace.allowedEditorKinds) {
        expect(editorKinds.has(editorKind), `${workspace.id} references ${editorKind}`).toBe(true);
      }
      for (const request of workspace.defaultOpenRequests) {
        expect(editorKinds.has(request.editorKind), `${workspace.id} default opens ${request.editorKind}`).toBe(true);
      }
    }
  });

  test('default layout contains requested target groups', () => {
    for (const workspace of hostProfileWorkspaces) {
      const layout = workspace.createDefaultLayout({ workspaceId: workspace.id });
      for (const request of workspace.defaultOpenRequests) {
        if (request.targetGroupId) {
          expect(layout.groups[request.targetGroupId], `${workspace.id} target group ${request.targetGroupId}`).toBeTruthy();
        }
      }
    }
  });

  test('对局宿主 profile supports parameterized game-session multi-instance', () => {
    const gameSession = hostProfileEditors.find((editor) => editor.kind === 'game-session');
    expect(gameSession?.capability.allowMultipleInstances).toBe(true);
    expect(gameSession?.capability.allowDuplicate).toBe(true);

    const 对局宿主 = hostProfileWorkspaces.find((workspace) => workspace.id === 'matches-workspace');
    expect(对局宿主?.allowedEditorKinds).toContain('game-session');
  });

  test('画布型宿主 profile contains viewport foundation surface', () => {
    const 画布型宿主 = hostProfileWorkspaces.find((workspace) => workspace.id === 'canvas-workspace');
    expect(画布型宿主?.allowedEditorKinds).toContain('canvas-placeholder');
    expect(画布型宿主?.allowedEditorKinds).toContain('viewport-foundation');
    expect(画布型宿主?.defaultOpenRequests.some((request) => request.editorKind === 'viewport-foundation')).toBe(true);
  });

  test('external mount adapter fixture is framework-neutral', () => {
    const adapterEditor = hostProfileEditors.find((editor) => editor.kind === 'external-mount-demo');
    expect(adapterEditor?.rendererKey).toBe('external-mount-demo-adapter');
    expect(JSON.stringify(adapterEditor)).not.toMatch(/react|react-dom|ReactDOM/);
  });

  test('validation cases cover the first three host targets', () => {
    expect(hostProfileValidationCases.map((item) => item.workspaceId)).toEqual([
      'docs-workspace',
      'canvas-workspace',
      'matches-workspace',
    ]);
  });
});
