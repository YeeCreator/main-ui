import {
  createSingleGroupLayout,
  createThreePaneLayout,
  createTwoPaneLayout,
  defaultEditorCapability,
  defaultModalPresentation,
  defaultTabPresentation,
} from 'main-ui/core';
import type { EditorDescriptor, WorkspaceDescriptor } from 'main-ui/core';

export const hostProfileWorkspaceIds = [
  'workspace-demo',
  'inspector-demo',
  'autodo-profile',
  'matheshop-profile',
  'yeegames-profile',
] as const;

export type HostProfileWorkspaceId = (typeof hostProfileWorkspaceIds)[number];

const allWorkspaceIds = [...hostProfileWorkspaceIds];

const createEditor = (
  kind: string,
  title: string,
  rendererKey: string,
  options: Partial<EditorDescriptor> = {},
): EditorDescriptor => ({
  kind,
  title,
  rendererKey,
  icon: title.slice(0, 2).toUpperCase(),
  description: options.description,
  capability: {
    ...defaultEditorCapability,
    ...(options.capability ?? {}),
  },
  presentation: options.presentation ?? defaultTabPresentation,
  availability: options.availability ?? { allowedWorkspaceIds: allWorkspaceIds },
  createDefaultPayload: options.createDefaultPayload,
});

export const hostProfileEditors: EditorDescriptor[] = [
  createEditor('welcome', 'Welcome', 'welcome-editor', { description: 'Neutral start page.' }),
  createEditor('settings', 'Settings', 'settings-editor', {
    description: 'System settings overlay.',
    capability: {
      ...defaultEditorCapability,
      allowMultipleInstances: false,
      launcherVisibility: 'visible',
    },
    presentation: defaultModalPresentation,
  }),
  createEditor('table-demo', 'Table', 'table-demo-editor', { description: 'Information table editor.' }),
  createEditor('inspector-demo', 'Inspector', 'inspector-demo-editor', { description: 'Property inspector editor.' }),
  createEditor('graph-placeholder', 'Graph', 'graph-placeholder-editor', { description: 'Graph or DAG surface.' }),
  createEditor('canvas-placeholder', 'Canvas', 'canvas-placeholder-editor', { description: 'Canvas style interaction surface.' }),
  createEditor('viewport-foundation', 'Viewport', 'viewport-foundation-editor', {
    description: 'Neutral viewport-2d-kit editor foundation fixture.',
    createDefaultPayload: () => ({ foundation: 'viewport-2d-kit', variant: 'generic' }),
  }),
  createEditor('profile-panel', 'Panel', 'profile-panel-editor', { description: 'Host profile side panel.' }),
  createEditor('external-mount-demo', 'Adapter', 'external-mount-demo-adapter', {
    description: 'External mount adapter smoke test.',
    createDefaultPayload: () => ({ label: 'DOM adapter payload', mode: 'framework-free' }),
  }),
  createEditor('game-gallery', 'Games', 'game-gallery-editor', { description: 'Game library editor.' }),
  createEditor('game-session', 'Session', 'game-session-editor', {
    description: 'Parameterized game session editor.',
    capability: {
      ...defaultEditorCapability,
      allowMultipleInstances: true,
      allowDuplicate: true,
    },
  }),
];

export const hostProfileWorkspaces: WorkspaceDescriptor[] = [
  {
    id: 'workspace-demo',
    title: 'Demo',
    description: 'Core workbench smoke test',
    icon: 'DM',
    allowedEditorKinds: ['welcome', 'settings', 'table-demo', 'graph-placeholder', 'inspector-demo', 'external-mount-demo'],
    recommendedEditorKinds: ['welcome', 'table-demo', 'graph-placeholder', 'external-mount-demo', 'settings'],
    defaultOpenRequests: [{ editorKind: 'welcome' }],
    createDefaultLayout: () => createSingleGroupLayout({ groupId: 'workspace-demo-group', leafNodeId: 'workspace-demo-leaf' }),
    allowUserReset: true,
  },
  {
    id: 'inspector-demo',
    title: 'Inspector',
    description: 'Three-pane editor layout',
    icon: 'IN',
    allowedEditorKinds: ['table-demo', 'inspector-demo', 'graph-placeholder', 'settings'],
    recommendedEditorKinds: ['table-demo', 'inspector-demo', 'graph-placeholder', 'settings'],
    defaultOpenRequests: [
      { editorKind: 'table-demo', targetGroupId: 'inspector-demo-group-left' },
      { editorKind: 'graph-placeholder', targetGroupId: 'inspector-demo-group-center' },
      { editorKind: 'inspector-demo', targetGroupId: 'inspector-demo-group-right' },
    ],
    createDefaultLayout: () => createThreePaneLayout('inspector-demo'),
    allowUserReset: true,
  },
  {
    id: 'autodo-profile',
    title: 'Autodo',
    description: 'Multi-workspace information host fixture',
    icon: 'AU',
    allowedEditorKinds: ['profile-panel', 'table-demo', 'graph-placeholder', 'viewport-foundation', 'settings'],
    recommendedEditorKinds: ['profile-panel', 'table-demo', 'viewport-foundation', 'graph-placeholder', 'settings'],
    defaultOpenRequests: [
      {
        editorKind: 'profile-panel',
        title: 'Literature sidebar',
        targetGroupId: 'autodo-profile-group-left',
        payload: { title: 'Literature sidebar', description: 'Navigation and queue controls.' },
      },
      { editorKind: 'table-demo', title: 'Literature table', targetGroupId: 'autodo-profile-group-center' },
      {
        editorKind: 'viewport-foundation',
        title: 'Knowledge graph',
        targetGroupId: 'autodo-profile-group-right',
        payload: { foundation: 'viewport-2d-kit', variant: 'autodo-graph' },
      },
    ],
    createDefaultLayout: () => createThreePaneLayout('autodo-profile'),
    allowUserReset: true,
  },
  {
    id: 'matheshop-profile',
    title: 'Matheshop',
    description: 'Canvas-heavy host fixture',
    icon: 'MA',
    allowedEditorKinds: ['profile-panel', 'canvas-placeholder', 'viewport-foundation', 'inspector-demo', 'settings'],
    recommendedEditorKinds: ['viewport-foundation', 'canvas-placeholder', 'profile-panel', 'inspector-demo', 'settings'],
    defaultOpenRequests: [
      {
        editorKind: 'profile-panel',
        title: 'Math tools',
        targetGroupId: 'matheshop-profile-group-left',
        payload: { title: 'Math tools', description: 'Tool palettes, colors, symbols and history.' },
      },
      {
        editorKind: 'viewport-foundation',
        title: 'Formula canvas',
        targetGroupId: 'matheshop-profile-group-center',
        payload: { foundation: 'viewport-2d-kit', variant: 'math-canvas' },
      },
      { editorKind: 'inspector-demo', title: 'Formula inspector', targetGroupId: 'matheshop-profile-group-right' },
    ],
    createDefaultLayout: () => createThreePaneLayout('matheshop-profile'),
    allowUserReset: true,
  },
  {
    id: 'yeegames-profile',
    title: 'Yeegames',
    description: 'Game library and session fixture',
    icon: 'YG',
    allowedEditorKinds: ['profile-panel', 'game-gallery', 'game-session', 'viewport-foundation', 'settings'],
    recommendedEditorKinds: ['game-gallery', 'game-session', 'viewport-foundation', 'profile-panel', 'settings'],
    defaultOpenRequests: [
      {
        editorKind: 'profile-panel',
        title: 'Game resources',
        targetGroupId: 'yeegames-profile-group-1',
        payload: { title: 'Game resources', description: 'Resource tree, rule packs and saved games.' },
      },
      { editorKind: 'game-gallery', targetGroupId: 'yeegames-profile-group-1' },
      {
        editorKind: 'viewport-foundation',
        title: 'Board viewport',
        targetGroupId: 'yeegames-profile-group-2',
        payload: { foundation: 'viewport-2d-kit', variant: 'game-board' },
      },
    ],
    createDefaultLayout: () => createTwoPaneLayout('yeegames-profile', 'vertical'),
    allowUserReset: true,
  },
];

export const hostProfileValidationCases = [
  {
    workspaceId: 'autodo-profile',
    validates: '多资料工作区、左侧导航、中部表格、右侧 viewport-2d-kit 图谱底座，不把文献业务写入 main-ui。',
  },
  {
    workspaceId: 'matheshop-profile',
    validates: '强指针 viewport-2d-kit 画布、工具面板、Inspector 与设置 overlay，不把数学引擎写入 main-ui。',
  },
  {
    workspaceId: 'yeegames-profile',
    validates: '游戏广场、参数化 game-session、多实例与 viewport-2d-kit 棋盘底座，不把游戏规则写入 main-ui。',
  },
] as const;
