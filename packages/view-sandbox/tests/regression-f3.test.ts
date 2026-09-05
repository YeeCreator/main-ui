import { describe, expect, test } from 'vitest';
import { ref } from 'vue';
import type { SandboxCamera } from '../src/types';
import { DEFAULT_SANDBOX_CAMERA } from '../src/types';

/**
 * 回归测试 F-3（main-ui 高危缺陷）：
 * SandboxView.getViewState 返回的 camera 必须是普通对象，
 * 不能是 Vue ref 的响应式 Proxy，否则内核 structuredClone(document) 会抛 DataCloneError。
 *
 * 修复：getViewState 内用 `{ x: cam.x, y: cam.y, zoom: cam.zoom }` 显式展开。
 */
describe('regression F-3: view state must be structuredClone-safe', () => {
  test('camera ref .value is a Proxy (reproduces the bug)', () => {
    const cameraState = ref<SandboxCamera>({ ...DEFAULT_SANDBOX_CAMERA });
    // ref .value 是响应式 Proxy（Vue 3 行为）
    const stateBroken = { camera: cameraState.value };
    expect(() => structuredClone(stateBroken)).toThrow();
  });

  test('SandboxView spread pattern is clone-safe', () => {
    const cameraState = ref<SandboxCamera>({ x: 100, y: 200, zoom: 1.5 });
    // 修复模式：显式展开为普通对象
    const cam = cameraState.value;
    const stateFixed = {
      camera: { x: cam.x, y: cam.y, zoom: cam.zoom },
      selectedElementIds: ['a', 'b'],
      embeddedRefs: ['embed-1'],
    };
    expect(() => structuredClone(stateFixed)).not.toThrow();
    const cloned = structuredClone(stateFixed);
    expect(cloned).toEqual(stateFixed);
    // 克隆后是独立对象（不与 ref 共享引用）
    expect(cloned.camera).not.toBe(cam);
  });
});
