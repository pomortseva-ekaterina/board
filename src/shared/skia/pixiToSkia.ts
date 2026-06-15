import * as PIXI from 'pixi.js';
import '@pixi/canvas-display';
import '@pixi/canvas-graphics';
import '@pixi/canvas-sprite';
import type { SceneNode } from '@/shared/skia/types';
import { spriteToSVGPaths } from '@/shared/lib/imagetracerjs/spriteToVectorPaths.ts';

function serializeShape(shape: PIXI.IShape): Record<string, unknown> {
  if (shape instanceof PIXI.Rectangle) {
    return { _type: 'Rectangle', x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  if (shape instanceof PIXI.Circle) {
    return { _type: 'Circle', x: shape.x, y: shape.y, radius: shape.radius };
  }
  if (shape instanceof PIXI.Ellipse) {
    return { _type: 'Ellipse', x: shape.x, y: shape.y, halfWidth: shape.width, halfHeight: shape.height };
  }
  if (shape instanceof PIXI.Polygon) {
    return { _type: 'Polygon', points: shape.points };
  }
  return { _type: 'Unknown' };
}

export function convertPixiContainerToSkia(container: PIXI.Container): SceneNode {
  const children = container.children.map((child) => {
    const typeName = child.constructor.name;

    if (typeName === 'Sprite' || child instanceof PIXI.Sprite) {
      const sprite = child as PIXI.Sprite;

      const paths = spriteToSVGPaths(sprite);

      const texW = sprite.texture.width;
      const texH = sprite.texture.height;

      const offsetX = -sprite.anchor.x * texW;
      const offsetY = -sprite.anchor.y * texH;

      const lt = sprite.localTransform;

      return {
        visible: sprite.visible,
        _type: 'Graphics',
        localTransform: {
          a: lt.a,
          b: lt.b,
          c: lt.c,
          d: lt.d,
          tx: lt.tx + offsetX * lt.a,
          ty: lt.ty + offsetY * lt.d,
        },
        graphicsData: paths.map((p) => ({
          shape: { _type: 'Polygon', points: p.points },
          fillStyle: { visible: true, color: p.fillColor, alpha: p.fillAlpha },
          lineStyle: { visible: false, width: 0, color: 0, alpha: 1 },
        })),
        children: [],
      };
    }

    if (typeName === '_Graphics' || typeName === 'Graphics' || child instanceof PIXI.Graphics) {
      const graphics = child as PIXI.Graphics;

      return {
        visible: graphics.visible,
        _type: 'Graphics',
        localTransform: {
          a: graphics.localTransform.a,
          b: graphics.localTransform.b,
          c: graphics.localTransform.c,
          d: graphics.localTransform.d,
          tx: graphics.localTransform.tx,
          ty: graphics.localTransform.ty,
        },

        graphicsData: graphics.geometry.graphicsData.map((d: any) => {
          const hasOnlyLine = d.lineStyle.width > 0 && !d.fillStyle.visible;
          return {
            shape: hasOnlyLine ? serializePolyline(d) : serializeShape(d.shape),
            fillStyle: {
              visible: d.fillStyle.visible,
              color: d.fillStyle.color,
              alpha: d.fillStyle.alpha,
            },
            lineStyle: {
              visible: d.lineStyle.width > 0,
              width: d.lineStyle.width,
              color: d.lineStyle.color,
              alpha: d.lineStyle.alpha,
            },
          } as const;
        }),

        children: [],
      } as const;
    }

    if (child instanceof PIXI.Container) {
      return convertPixiContainerToSkia(child);
    }

    throw new Error('Неподдерживаемый тип pixi объекта');
  });

  return {
    visible: container.visible,
    _type: 'Container',
    localTransform: {
      a: container.localTransform.a,
      b: container.localTransform.b,
      c: container.localTransform.c,
      d: container.localTransform.d,
      tx: container.localTransform.tx,
      ty: container.localTransform.ty,
    },
    graphicsData: [],
    children: children.filter(Boolean) as SceneNode[],
  };
}

function serializePolyline(d: { shape: PIXI.Polygon }): Record<string, unknown> {
  return {
    _type: 'Polyline',
    points: [...d.shape.points],
  };
}
