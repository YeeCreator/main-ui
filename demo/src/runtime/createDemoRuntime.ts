import { createLocalStoragePersistenceAdapter } from 'main-ui/core';
import { createMainUiRuntime } from 'main-ui/vue';
import CanvasPlaceholderEditor from '../editors/CanvasPlaceholderEditor.vue';
import GameGalleryEditor from '../editors/GameGalleryEditor.vue';
import GameSessionEditor from '../editors/GameSessionEditor.vue';
import GraphPlaceholderEditor from '../editors/GraphPlaceholderEditor.vue';
import InspectorDemoEditor from '../editors/InspectorDemoEditor.vue';
import ProfilePanelEditor from '../editors/ProfilePanelEditor.vue';
import SettingsEditor from '../editors/SettingsEditor.vue';
import TableDemoEditor from '../editors/TableDemoEditor.vue';
import WelcomeEditor from '../editors/WelcomeEditor.vue';
import { hostProfileEditors, hostProfileWorkspaces } from './hostProfiles';
import { ViewportMainUiEditor } from '@main-ui/viewport-2d-kit/main-ui';
import { registerDemoPresetViewEditors } from '../adapter/registerPresetViewEditors';

export const createDemoRuntime = () => {
  const runtime = createMainUiRuntime({
    persistence: createLocalStoragePersistenceAdapter('main-ui:demo-workbench:v1'),
    activeWorkspaceId: 'workspace-demo',
  });

  for (const editor of hostProfileEditors) {
    runtime.core.registerEditor(editor);
  }

  for (const workspace of hostProfileWorkspaces) {
    runtime.core.registerWorkspace(workspace);
  }

  runtime.vue.registerEditorRenderer('welcome-editor', WelcomeEditor);
  runtime.vue.registerEditorRenderer('settings-editor', SettingsEditor);
  runtime.vue.registerEditorRenderer('table-demo-editor', TableDemoEditor);
  runtime.vue.registerEditorRenderer('inspector-demo-editor', InspectorDemoEditor);
  runtime.vue.registerEditorRenderer('graph-placeholder-editor', GraphPlaceholderEditor);
  runtime.vue.registerEditorRenderer('canvas-placeholder-editor', CanvasPlaceholderEditor);
  runtime.vue.registerEditorRenderer('profile-panel-editor', ProfilePanelEditor);
  runtime.vue.registerEditorRenderer('game-gallery-editor', GameGalleryEditor);
  runtime.vue.registerEditorRenderer('game-session-editor', GameSessionEditor);
  runtime.vue.registerEditorRenderer('viewport-foundation-editor', ViewportMainUiEditor);
  registerDemoPresetViewEditors(runtime);
  runtime.vue.registerEditorMountAdapter('external-mount-demo-adapter', {
    mount(container, context) {
      container.className = 'demo-external-adapter';
      container.tabIndex = 0;
      container.dataset.adapterMounted = 'true';
      const title = document.createElement('strong');
      title.textContent = 'External mount adapter';
      const description = document.createElement('p');
      description.textContent = `Mounted without framework dependency: ${JSON.stringify(context.editor.payload)}`;
      const eventStatus = document.createElement('p');
      eventStatus.textContent = 'Pointer not tested yet';
      container.append(title, description, eventStatus);

      const onPointerDown = () => {
        eventStatus.textContent = 'Pointer event received by external adapter';
        container.dataset.pointerTested = 'true';
      };
      container.addEventListener('pointerdown', onPointerDown);

      return () => {
        container.removeEventListener('pointerdown', onPointerDown);
      };
    },
    update(container, context) {
      const description = container.querySelector('p');
      if (description) {
        description.textContent = `Mounted without framework dependency: ${JSON.stringify(context.editor.payload)}`;
      }
    },
    unmount(container) {
      delete container.dataset.adapterMounted;
    },
  });

  return runtime;
};
