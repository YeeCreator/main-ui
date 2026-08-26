# 0.1.0 host example

```ts
import { createMemorySettingsPersistenceAdapter, createLocalStoragePersistenceAdapter, createSingleGroupLayout, defaultEditorCapability, defaultTabPresentation } from 'main-ui/core'
import { createMainUiRuntime } from 'main-ui/vue'

const runtime = createMainUiRuntime({
  persistence: createLocalStoragePersistenceAdapter('host-workbench'),
  settingsPersistence: createMemorySettingsPersistenceAdapter(),
})

runtime.core.registerCommand({ id: 'host.openWelcome', title: 'Open Welcome', run: () => { void runtime.core.dispatch({ type: 'editor/open', request: { editorKind: 'welcome' } }) } })
runtime.core.registerKeybinding({ commandId: 'host.openWelcome', keybinding: 'Ctrl+Shift+W' })
runtime.core.registerMenu({ id: 'host.file.openWelcome', location: 'menubar', label: 'Open Welcome', commandId: 'host.openWelcome' })
runtime.core.registerSettingSchema({ id: 'host.density', title: 'Density', type: 'enum', defaultValue: 'comfortable', enumValues: [{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }] })
runtime.core.registerViewContribution({ id: 'host.explorer', title: 'Explorer', defaultVisible: true, rendererKey: 'host-explorer' })
runtime.core.registerWorkspace({ id: 'host', title: 'Host', allowedEditorKinds: ['welcome'], recommendedEditorKinds: ['welcome'], defaultOpenRequests: [{ editorKind: 'welcome' }], createDefaultLayout: () => createSingleGroupLayout(), allowUserReset: true })
runtime.core.registerEditor({ kind: 'welcome', title: 'Welcome', rendererKey: 'host-welcome', capability: defaultEditorCapability, presentation: defaultTabPresentation, availability: { allowedWorkspaceIds: ['host'] } })
```

New contributions are opt-in; existing host registration remains valid if these lines are omitted.
