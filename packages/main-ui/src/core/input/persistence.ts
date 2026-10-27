/**
 * core/input/persistence —— 快捷键覆盖的持久化。
 *
 * 复用既有 `SettingsStore`（命名空间 `main-ui.shortcuts`），不新造存储通道：
 * 快捷键覆盖就是一项用户设置，独立存储会带来「两套设置中心」的分裂。
 *
 * 存 `user` 作用域为默认；`workspace` 作用域可选，语义为「仅在该工作区生效的额外覆盖」。
 */
import type { SettingsStore } from '../settings/store';
import type { ShortcutStore, ShortcutOverrideMap } from './shortcut-store';

/** 设置键名（唯一命名空间）。 */
export const SHORTCUTS_SETTING_ID = 'main-ui.shortcuts';

/** 存储结构版本。 */
export const SHORTCUTS_SCHEMA_VERSION = 1;

/** 持久化载荷。 */
export type ShortcutPersistencePayload = {
  version: number;
  overrides: ShortcutOverrideMap;
};

/** 校验并归一化载荷。 */
export function parseShortcutPayload(raw: unknown): ShortcutPersistencePayload {
  if (!raw || typeof raw !== 'object') return { version: SHORTCUTS_SCHEMA_VERSION, overrides: {} };
  const container = raw as { version?: unknown; overrides?: unknown };
  const overrides: ShortcutOverrideMap = {};
  if (container.overrides && typeof container.overrides === 'object') {
    for (const [id, value] of Object.entries(container.overrides as Record<string, unknown>)) {
      const entry = value as { binding?: unknown };
      if (!entry || typeof entry !== 'object') continue;
      if (entry.binding === null) {
        overrides[id] = { binding: null };
        continue;
      }
      if (typeof entry.binding === 'string') {
        overrides[id] = { binding: entry.binding };
      }
    }
  }
  return {
    version: typeof container.version === 'number' ? container.version : SHORTCUTS_SCHEMA_VERSION,
    overrides,
  };
}

/**
 * 从设置库读出覆盖并装载到绑定库。
 *
 * @param settings 设置库。
 * @param store 绑定库。
 * @param context 作用域（缺省 user）。
 */
export function loadShortcutOverrides(
  settings: SettingsStore,
  store: ShortcutStore,
  context: { workspaceId?: string; profileId?: string } = {},
): void {
  const raw = settings.getRaw(SHORTCUTS_SETTING_ID, context);
  const payload = parseShortcutPayload(raw);
  store.replaceOverrides(payload.overrides);
}

/**
 * 把当前覆盖写入设置库并落盘。
 *
 * @param settings 设置库。
 * @param store 绑定库。
 * @param context 作用域。
 * @returns 写入结果。
 */
export async function saveShortcutOverrides(
  settings: SettingsStore,
  store: ShortcutStore,
  context: { workspaceId?: string; profileId?: string } = {},
): Promise<void> {
  const payload: ShortcutPersistencePayload = {
    version: SHORTCUTS_SCHEMA_VERSION,
    overrides: store.listOverrides(),
  };
  settings.setRaw(SHORTCUTS_SETTING_ID, payload as unknown as import('../types').JsonValue, {
    scope: 'user',
    workspaceId: context.workspaceId,
    profileId: context.profileId,
  });
  await settings.save();
}
