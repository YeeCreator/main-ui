/**
 * demo 视图数据仓库 —— 适配层的单一事实源（按编辑器实例隔离）。
 *
 * 数据流：适配层取数 → 写入本仓库（响应式）→ 模板包渲染器在渲染时读取
 * → 模板包抛出意图（Emits）→ 适配层裁决后回写本仓库 → 受控数据回流视图。
 * 模板包本身不持有业务数据、不发起请求。
 */
import { reactive } from 'vue';

export type PresetViewRecord = {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  data: Record<string, unknown>;
};

/** key = editorInstanceId */
const store = reactive(new Map<string, PresetViewRecord>());

/** 已发起加载的实例（幂等守卫：渲染函数中可安全调用）。 */
const inflight = new Set<string>();

export const getViewRecord = (editorInstanceId: string): PresetViewRecord | undefined =>
  store.get(editorInstanceId);

/**
 * 确保实例数据已加载（幂等）：首次调用置 loading 并启动异步取数；
 * 渲染函数中调用也安全——仅登记副作用，结果经响应式回流触发重渲染。
 */
export const ensureViewData = (
  editorInstanceId: string,
  loader: () => Promise<Record<string, unknown>>,
): void => {
  if (store.has(editorInstanceId) || inflight.has(editorInstanceId)) return;
  inflight.add(editorInstanceId);
  store.set(editorInstanceId, { status: 'loading', error: null, data: {} });
  loader()
    .then((data) => {
      store.set(editorInstanceId, { status: 'ready', error: null, data });
    })
    .catch((reason: unknown) => {
      store.set(editorInstanceId, {
        status: 'error',
        error: reason instanceof Error ? reason.message : String(reason),
        data: {},
      });
    })
    .finally(() => {
      inflight.delete(editorInstanceId);
    });
};

/** 意图裁决通过后回写数据（触发受控回流）。 */
export const patchViewData = (
  editorInstanceId: string,
  patch: Partial<Omit<PresetViewRecord, 'data'>> & { data?: Record<string, unknown> },
): void => {
  const record = store.get(editorInstanceId);
  if (!record) return;
  store.set(editorInstanceId, { ...record, ...patch, data: patch.data ?? record.data });
};

/** 编辑器实例关闭时清理（可选，防内存增长）。 */
export const disposeViewData = (editorInstanceId: string): void => {
  store.delete(editorInstanceId);
  inflight.delete(editorInstanceId);
};
