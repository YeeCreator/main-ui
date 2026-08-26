import type { EditorKind } from '../types';
import type { EditorCapabilityPolicy } from './types';

/**
 * Slot 交互动作枚举：统一裁决拖放、浮动、关闭等交互的合法性。
 * 与 `EditorCapabilityPolicy` 的标记一一对应。
 */
export type SlotAction =
  | 'create'
  | 'duplicate'
  | 'multipleInstances'
  | 'multipleSurfacesPerInstance'
  | 'close'
  | 'reorderInGroup'
  | 'moveAcrossGroups'
  | 'splitDrop'
  | 'popoutWindow'
  | 'floatingWindow'
  | 'modalOverlay'
  | 'mirrorDisplay';

/**
 * 统一叶子插槽的类型化描述符。
 *
 * Slot 是布局叶子组内业务视图的统一挂载点：以类型化 descriptor 与属性方法管理，
 * 不做运行时字符串拼接查找。`viewType` 复用既有 `rendererKey` / `EditorKind`
 * 命名空间，editor 类表面默认以 `EditorKind` 作为 `viewType`。
 */
export type SlotDescriptor = {
  /** 视图唯一类型标识，用于快照持久化与注册查找 */
  viewType: string;
  /** 关联的 editor kind（editor 类表面）；纯视图插槽可省略 */
  editorKind?: EditorKind;
  /** 展示标题（占位表面与启动器消费） */
  title?: string;
  /** 能力约束：指向既有 `EditorCapabilityPolicy` 标记集合 */
  constraints: EditorCapabilityPolicy;
};

/**
 * 注册表按 `viewType` 查找的结果。
 * 未注册的 `viewType` 不抛错、不返回 undefined，而是返回显式的「缺失」结果，
 * 供快照降级占位（missing-view 表面）消费。
 */
export type SlotLookup =
  | { status: 'registered'; descriptor: SlotDescriptor }
  | { status: 'missing'; viewType: string };

/** Slot 能力查询：纯函数式的 `can(action)` 风格裁决。 */
export const slotCan = (descriptor: SlotDescriptor, action: SlotAction): boolean => {
  const policy = descriptor.constraints;
  switch (action) {
    case 'create':
      return policy.allowCreate;
    case 'duplicate':
      return policy.allowDuplicate;
    case 'multipleInstances':
      return policy.allowMultipleInstances;
    case 'multipleSurfacesPerInstance':
      return policy.allowMultipleSurfacesPerInstance;
    case 'close':
      return policy.allowClose;
    case 'reorderInGroup':
      return policy.allowReorderInGroup;
    case 'moveAcrossGroups':
      return policy.allowMoveAcrossGroups;
    case 'splitDrop':
      return policy.allowSplitDrop;
    case 'popoutWindow':
      return policy.allowPopoutWindow;
    case 'floatingWindow':
      return policy.allowFloatingWindow;
    case 'modalOverlay':
      return policy.allowModalOverlay;
    case 'mirrorDisplay':
      return policy.allowMirrorDisplay;
    default:
      return false;
  }
};

/**
 * Slot 注册表：按 `viewType` 登记、查找与校验插槽描述符。
 * 与既有 `rendererKey` 注册方式为叠加关系（不替换）。
 */
export class SlotRegistry {
  private readonly slots = new Map<string, SlotDescriptor>();

  register(descriptor: SlotDescriptor): void {
    this.slots.set(descriptor.viewType, descriptor);
  }

  unregister(viewType: string): void {
    this.slots.delete(viewType);
  }

  /** 未注册时返回 `{ status: 'missing', viewType }`，永不抛错。 */
  resolve(viewType: string): SlotLookup {
    const descriptor = this.slots.get(viewType);
    return descriptor ? { status: 'registered', descriptor } : { status: 'missing', viewType };
  }

  /** 便捷能力查询：缺失或非注册插槽一律返回 false。 */
  can(viewType: string, action: SlotAction): boolean {
    const lookup = this.resolve(viewType);
    return lookup.status === 'registered' && slotCan(lookup.descriptor, action);
  }

  list(): SlotDescriptor[] {
    return [...this.slots.values()];
  }

  clear(): void {
    this.slots.clear();
  }
}
