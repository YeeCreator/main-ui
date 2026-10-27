/**
 * core/input/shortcut-store —— 绑定库与三层覆盖。
 *
 * 三层合并（浅 → 深）：
 *
 * 1. `default`：框架内置绑定；
 * 2. `host`：宿主 `register` 注册的绑定（同 id 覆盖默认）；
 * 3. `user`：用户在面板里改的覆盖（按 `bindingId` 定位）。
 *
 * 合并只在 {@link ShortcutStore.resolve} 内做一次，匹配时面对扁平列表，
 * 避免运行时逐层查询（否则「到底是谁赢了」会变得不可解释）。
 */
import type { Binding, BindingDraft } from '@main-ui/core/input';

/** 用户覆盖项。`binding: null` 表示解绑。 */
export type ShortcutOverride = {
  /** 新的绑定表达式；`null` 表示解绑。 */
  binding: string | null;
};

/** 覆盖集合（持久化形态）。 */
export type ShortcutOverrideMap = Record<string, ShortcutOverride>;

/** 归一化绑定：补齐缺省字段。 */
function normalize(binding: Binding): Binding {
  return {
    ...binding,
    swallow: binding.swallow ?? true,
    mode: binding.mode ?? 'once',
    chord: {
      mods: { ...binding.chord.mods },
      modsMatch: binding.chord.modsMatch ?? 'exact',
      buttons: [...binding.chord.buttons],
      keys: [...binding.chord.keys],
    },
  };
}

/** 绑定库。 */
export class ShortcutStore {
  private readonly defaults = new Map<string, Binding>();
  private readonly hosts = new Map<string, Binding>();
  private readonly overrides = new Map<string, ShortcutOverride>();
  private sequence = 0;

  /** 注册默认绑定（同 id 覆盖）。 */
  registerDefault(binding: Binding): void {
    this.defaults.set(binding.id, normalize({ ...binding, origin: 'default' }));
  }

  /** 注册宿主绑定（同 id 覆盖默认）。 */
  registerHost(binding: Binding): void {
    this.hosts.set(binding.id, normalize({ ...binding, origin: 'host' }));
  }

  /** 注销绑定（按 id 或命令 id）。 */
  unregister(idOrCommandId: string): void {
    const remove = (map: Map<string, Binding>) => {
      if (map.delete(idOrCommandId)) return true;
      let removed = false;
      for (const [key, value] of map) {
        if (value.commandId === idOrCommandId) {
          map.delete(key);
          removed = true;
        }
      }
      return removed;
    };
    remove(this.defaults);
    remove(this.hosts);
    this.overrides.delete(idOrCommandId);
  }

  /** 设置用户覆盖。 */
  setOverride(bindingId: string, override: ShortcutOverride): void {
    this.overrides.set(bindingId, override);
  }

  /** 清除单个用户覆盖。 */
  clearOverride(bindingId: string): void {
    this.overrides.delete(bindingId);
  }

  /** 清除全部用户覆盖。 */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /** 读取当前覆盖（复制，供持久化）。 */
  listOverrides(): ShortcutOverrideMap {
    const result: ShortcutOverrideMap = {};
    for (const [id, override] of this.overrides) result[id] = { ...override };
    return result;
  }

  /** 批量导入覆盖（导入前由调用方校验命令存在性）。 */
  replaceOverrides(map: ShortcutOverrideMap): void {
    this.overrides.clear();
    for (const [id, override] of Object.entries(map)) {
      this.overrides.set(id, { ...override });
    }
  }

  /**
   * 合并三层，产出扁平绑定列表。
   *
   * 覆盖解析顺序不可调换：先取默认+宿主的合并结果，
   * 再按 id 应用用户覆盖；被解绑（`binding: null`）的绑定直接消失。
   *
   * @param parse 表达式解析器（由调用方注入，避免 core 依赖 DSL 的平台探测）。
   * @returns 合并后的绑定列表。
   * @example
   * const bindings = store.resolve((text) => draftFromText(text, 'mac'))
   */
  resolve(parse: (text: string) => BindingDraft): Binding[] {
    const merged = new Map<string, Binding>();
    for (const [id, binding] of this.defaults) merged.set(id, binding);
    for (const [id, binding] of this.hosts) merged.set(id, binding);

    const result: Binding[] = [];
    for (const [id, binding] of merged) {
      const override = this.overrides.get(id);
      if (!override) {
        result.push(binding);
        continue;
      }
      if (override.binding === null) continue; // 解绑
      try {
        const draft = parse(override.binding);
        result.push(
          normalize({
            ...binding,
            ...draft,
            id,
            commandId: binding.commandId,
            origin: 'user',
          }),
        );
      } catch {
        // 解析失败的覆盖不生效，回落到原绑定（面板会在保存前校验）
        result.push(binding);
      }
    }
    return result;
  }

  /** 下一个自动 id（`default:<commandId>:<n>`）。 */
  nextId(commandId: string): string {
    const id = `default:${commandId}:${this.sequence}`;
    this.sequence += 1;
    return id;
  }
}
