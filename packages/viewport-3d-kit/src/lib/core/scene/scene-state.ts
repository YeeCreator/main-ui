import * as THREE from 'three';

/**
 * 场景对象几何类型。
 */
export type ViewportEntityKind = 'box' | 'sphere' | 'cylinder';

/**
 * 场景对象数据。
 */
export interface ViewportEntity {
  /** 对象唯一标识。 */
  id: string;
  /** 对象显示名称。 */
  name: string;
  /** 对象在世界坐标中的位置。 */
  position: [number, number, number];
  /** 对象在世界坐标中的尺寸。 */
  size: [number, number, number];
  /** 对象几何类型。 */
  kind?: ViewportEntityKind;
  /** 对象欧拉旋转（弧度制）。 */
  rotation?: [number, number, number];
  /** 对象材质颜色。 */
  color: string;
}

/**
 * 创建演示用场景对象。
 *
 * @returns 演示对象列表。
 */
export function createDemoEntities(): ViewportEntity[] {
  return [
    {
      id: 'crate-a',
      name: '箱体 A',
      position: [-2, 0.5, -1],
      size: [1, 1, 1],
      kind: 'box',
      rotation: [0, 0, 0],
      color: '#ff7a59',
    },
    {
      id: 'crate-b',
      name: '箱体 B',
      position: [0, 0.75, 2],
      size: [1.2, 1.5, 1],
      kind: 'cylinder',
      rotation: [0, 0, 0],
      color: '#4da3ff',
    },
    {
      id: 'crate-c',
      name: '箱体 C',
      position: [2.2, 0.4, 0.5],
      size: [0.8, 0.8, 0.8],
      kind: 'sphere',
      rotation: [0, 0, 0],
      color: '#66cc8a',
    },
  ];
}

/**
 * 计算场景包围盒。
 *
 * @param entities 场景对象数据。
 * @returns 场景包围盒。
 */
export function computeSceneBounds(entities: ViewportEntity[]): THREE.Box3 {
  const box = new THREE.Box3();

  entities.forEach((entity) => {
    const [px, py, pz] = entity.position;
    const [sx, sy, sz] = entity.size;

    const min = new THREE.Vector3(px - sx / 2, py - sy / 2, pz - sz / 2);
    const max = new THREE.Vector3(px + sx / 2, py + sy / 2, pz + sz / 2);
    box.expandByPoint(min);
    box.expandByPoint(max);
  });

  return box;
}
