/**
 * 二维档的离屏纹理面片层（Pixi）。
 *
 * ## 为什么二维档也需要它
 *
 * `texture-quad` 最初只实现了三维后端（`render-3d`）。二维（Pixi）后端
 * 的几何 `switch` 里没有它，于是**静默丢弃**——表现为「画面全白、无报错」。
 * 2026-11-11 迁元胞自动机时实测踩到：快照里明确有一个面片，场景里却什么都没有。
 *
 * 大网格（64×64 以上）在二维档同样需要「一张整图」而非逐格图元：
 * 6400 个四边形交给 Pixi 逐帧重建，代价与三维档一致。
 *
 * ## 与三维档的差异
 *
 * | 项 | 三维档 | 二维档（本模块） |
 * | --- | --- | --- |
 * | 载体 | `CanvasTexture` + `Mesh` | Pixi `Texture` + `Sprite` |
 * | 朝向 | 需绕 X 轴 +90° 躺平 | **不需要**：二维平面本就正对相机 |
 * | 公告牌 | 需每帧对齐相机 | 天然成立（无三维朝向） |
 *
 * ## 刷新
 *
 * 画布内容变化后要调 `texture.source.update()` 让 Pixi 重新上传。
 * 这是二维档的「就地刷新」——与三维档的 `refreshTexture` 同一语义。
 */
import { Container, Sprite, Texture } from 'pixi.js';
import type { QuadTextureResolver, TextureQuadItem } from '../primitives/types';

/** 一个已装配的二维面片。 */
export interface CanvasTextureQuad {
  /** 精灵对象（已加入层）。 */
  sprite: Sprite;
  /** 纹理键。 */
  key: string;
  /** 绑定的 Pixi 纹理（刷新用它）。 */
  texture: Texture;
}

/** 纹理键 → 二维纹理缓存（同一键复用同一张纹理，避免每次重建都新上传）。 */
const textureCache = new Map<string, Texture>();

/**
 * 创建离屏纹理面片层（二维档）。
 *
 * @param items 面片项。
 * @param resolver 纹理键 → 图像源（与三维档同一约定：返回**同一块 canvas**）。
 * @returns 层容器与逐项句柄（供就地刷新）。
 */
export function createTextureQuadLayer(
  items: readonly TextureQuadItem[],
  resolver?: QuadTextureResolver | null,
): { layer: Container; quads: CanvasTextureQuad[] } {
  const layer = new Container();
  layer.label = 'texture-quad';
  const quads: CanvasTextureQuad[] = [];
  if (!resolver) return { layer, quads };

  for (const item of items) {
    if (!item.texture) continue;
    const source = resolver(item.texture);
    // 无图像源时**不画** —— 与三维档同一判据：宁可不出，也不画纯色板
    if (!source) continue;

    let texture = textureCache.get(item.texture);
    if (!texture) {
      texture = Texture.from(source as HTMLCanvasElement);
      textureCache.set(item.texture, texture);
    } else {
      // 源内容可能已变（宿主重画过画布）
      texture.source.update();
    }

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = item.x;
    sprite.y = item.y;
    sprite.width = item.width;
    sprite.height = item.height;
    if (typeof item.opacity === 'number' && item.opacity < 1) {
      sprite.alpha = item.opacity;
    }
    layer.addChild(sprite);
    quads.push({ sprite, key: item.texture, texture });
  }

  return { layer, quads };
}

/**
 * 让指定纹理键重新上传像素（二维档的就地刷新）。
 *
 * @param key 纹理键。
 * @returns 是否命中。
 */
export function refreshTextureQuad(key: string): boolean {
  const texture = textureCache.get(key);
  if (!texture) return false;
  texture.source.update();
  return true;
}

/**
 * 清掉纹理缓存（后端卸载时调用）。
 *
 * 不清理会让「换一块画布」后仍绑着旧纹理 —— 表现为「内容再也不更新」。
 */
export function clearTextureQuadCache(): void {
  for (const texture of textureCache.values()) texture.destroy(true);
  textureCache.clear();
}
