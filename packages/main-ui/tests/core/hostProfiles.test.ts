import { describe, expect, test } from 'vitest';
import { hostProfileEditors, hostProfileValidationCases, hostProfileWorkspaces } from '../../../../demo/src/runtime/hostProfiles';

const editorKinds = new Set(hostProfileEditors.map((editor) => editor.kind));

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

  test('yeegames profile supports parameterized game-session multi-instance', () => {
    const gameSession = hostProfileEditors.find((editor) => editor.kind === 'game-session');
    expect(gameSession?.capability.allowMultipleInstances).toBe(true);
    expect(gameSession?.capability.allowDuplicate).toBe(true);

    const yeegames = hostProfileWorkspaces.find((workspace) => workspace.id === 'yeegames-profile');
    expect(yeegames?.allowedEditorKinds).toContain('game-session');
  });

  test('matheshop profile contains viewport foundation surface', () => {
    const matheshop = hostProfileWorkspaces.find((workspace) => workspace.id === 'matheshop-profile');
    expect(matheshop?.allowedEditorKinds).toContain('canvas-placeholder');
    expect(matheshop?.allowedEditorKinds).toContain('viewport-foundation');
    expect(matheshop?.defaultOpenRequests.some((request) => request.editorKind === 'viewport-foundation')).toBe(true);
  });

  test('external mount adapter fixture is framework-neutral', () => {
    const adapterEditor = hostProfileEditors.find((editor) => editor.kind === 'external-mount-demo');
    expect(adapterEditor?.rendererKey).toBe('external-mount-demo-adapter');
    expect(JSON.stringify(adapterEditor)).not.toMatch(/react|react-dom|ReactDOM/);
  });

  test('validation cases cover the first three host targets', () => {
    expect(hostProfileValidationCases.map((item) => item.workspaceId)).toEqual([
      'autodo-profile',
      'matheshop-profile',
      'yeegames-profile',
    ]);
  });
});
