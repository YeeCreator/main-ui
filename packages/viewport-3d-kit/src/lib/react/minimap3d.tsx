import { memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { computeSceneBounds, type ViewportEntity } from '../core/scene/scene-state';

/**
 * 小地图模式。
 */
export type MiniMapMode = 'top-down' | 'follow';

/**
 * 小地图组件属性。
 */
export interface MiniMap3DProps {
  /** 是否开启小地图。 */
  enabled: boolean;
  /** 小地图模式。 */
  mode?: MiniMapMode;
  /** 场景对象列表。 */
  entities: ViewportEntity[];
  /** 小地图容器类名。 */
  className?: string;
}

/**
 * 小地图中的实体渲染。
 *
 * @param props 组件属性。
 * @returns 场景网格与实体。
 */
function MiniMapEntities(props: { entities: ViewportEntity[] }) {
  const { entities } = props;

  return (
    <>
      <Grid args={[30, 30]} cellSize={1} cellThickness={0.4} sectionSize={5} sectionThickness={1} fadeDistance={40} />
      <axesHelper args={[4]} />

      {entities.map((entity) => {
        const [px, py, pz] = entity.position;
        const [sx, sy, sz] = entity.size;

        return (
          <mesh key={entity.id} position={[px, py, pz]}>
            {entity.kind === 'sphere' ? (
              <sphereGeometry args={[Math.max(sx, sy, sz) / 2, 20, 10]} />
            ) : entity.kind === 'cylinder' ? (
              <cylinderGeometry args={[Math.max(sx, sz) / 2, Math.max(sx, sz) / 2, sy, 20]} />
            ) : (
              <boxGeometry args={[sx, sy, sz]} />
            )}
            <meshStandardMaterial color={entity.color} wireframe />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * 通用小地图组件。
 *
 * @param props 组件属性。
 * @returns 小地图组件。
 */
export const MiniMap3D = memo(function MiniMap3D(props: MiniMap3DProps) {
  const { enabled, mode = 'top-down', entities, className } = props;

  const bounds = useMemo(() => computeSceneBounds(entities), [entities]);
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds]);
  const size = useMemo(() => bounds.getSize(new THREE.Vector3()), [bounds]);

  if (!enabled) {
    return null;
  }

  const mapHeight = mode === 'follow' ? Math.max(size.length(), 12) * 0.7 : Math.max(size.length(), 12);
  const cameraPosition: [number, number, number] = [center.x, center.y + mapHeight, center.z];
  const mapSize = Math.max(size.x, size.z, 12);

  return (
    <div className={`vk-minimap ${className ?? ''}`.trim()}>
      <Canvas orthographic camera={{ position: cameraPosition, zoom: 20, near: 0.1, far: 1000 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[12, 16, 10]} intensity={0.8} />

        <group>
          <MiniMapEntities entities={entities} />
          <Line
            points={[
              [center.x - mapSize / 2, 0.01, center.z],
              [center.x + mapSize / 2, 0.01, center.z],
            ]}
            color="#9ca3af"
            lineWidth={1}
          />
          <Line
            points={[
              [center.x, 0.01, center.z - mapSize / 2],
              [center.x, 0.01, center.z + mapSize / 2],
            ]}
            color="#9ca3af"
            lineWidth={1}
          />
        </group>
      </Canvas>
    </div>
  );
});
