import * as PIXI from 'pixi.js';
import { extensions } from 'pixi.js';
import { CanvasRenderer } from '@pixi/canvas-renderer';
import '@pixi/canvas-display';
import '@pixi/canvas-graphics';
import '@pixi/canvas-sprite';

extensions.add(CanvasRenderer);

//типы трансформаций
interface Transform {
  x?: number; // сдвиг (translate)
  y?: number; // сдвиг (translate)
  rotation?: number; // поворот (rotate)
  scaleX?: number; // масштабирование (scale)
  scaleY?: number; // масштабирование (scale)
}

function applyTransform(obj: PIXI.DisplayObject, t: Transform) {
  if (t.x !== undefined) obj.x = t.x; //сдвиг (translate)
  if (t.y !== undefined) obj.y = t.y; // сдвиг (translate)
  if (t.rotation !== undefined) obj.rotation = t.rotation; //  поворот (rotate)

  //   масштабирование (scale):
  if (t.scaleX !== undefined || t.scaleY !== undefined) {
    obj.scale.set(t.scaleX ?? 1, t.scaleY ?? 1);
  }
}

// PIXI.Graphics — drawRect
function createRect(
  width: number,
  height: number,
  color: number,
  transform: Transform = {},
  callback: (event: PIXI.FederatedPointerEvent) => void,
): PIXI.Graphics {
  const g = new PIXI.Graphics();
  g.beginFill(color);
  g.drawRect(-width / 2, -height / 2, width, height); // центр в (0,0)
  g.endFill();
  applyTransform(g, transform);

  eventPointerDown(g, callback);
  eventPointerUp(g, callback);

  return g;
}

// PIXI.Graphics — drawShape
function createShape(
  shape: PIXI.IShape,
  color: number,
  transform: Transform = {},
  callback: (event: PIXI.FederatedPointerEvent) => void,
): PIXI.Graphics {
  const g = new PIXI.Graphics();
  g.beginFill(color);
  g.drawShape(shape);
  g.endFill();
  applyTransform(g, transform);

  eventPointerDown(g, callback);
  eventPointerUp(g, callback);

  return g;
}

// PIXI.Graphics — lineTo / moveTo
function createPolyline(
  points: { x: number; y: number }[],
  color: number,
  lineWidth: number,
  transform: Transform = {},
  callback: (event: PIXI.FederatedPointerEvent) => void,
): PIXI.Graphics {
  const g = new PIXI.Graphics();
  g.lineStyle(lineWidth, color, 1);
  points.forEach((p, i) => {
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  });

  g.hitArea = buildPolylineHitArea(points, lineWidth);

  applyTransform(g, transform);
  eventPointerDown(g, callback);
  eventPointerUp(g, callback);
  return g;
}

function buildPolylineHitArea(points: { x: number; y: number }[], lineWidth: number): PIXI.Polygon {
  const halfW = lineWidth / 2 + 2;
  const polygonPoints: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;

    if (i === 0) {
      polygonPoints.push(p1.x + nx, p1.y + ny);
    }
    polygonPoints.push(p2.x + nx, p2.y + ny);
  }

  for (let i = points.length - 1; i > 0; i--) {
    const p1 = points[i];
    const p2 = points[i - 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;

    if (i === points.length - 1) {
      polygonPoints.push(p1.x + nx, p1.y + ny);
    }
    polygonPoints.push(p2.x + nx, p2.y + ny);
  }

  return new PIXI.Polygon(polygonPoints);
}

// PIXI.Sprite — из URL
function createSprite(
  url: string,
  transform: Transform = {},
  callback: (event: PIXI.FederatedPointerEvent) => void,
): PIXI.Sprite {
  const sprite = PIXI.Sprite.from(url);
  sprite.anchor.set(0.5);
  applyTransform(sprite, transform);

  sprite.texture.baseTexture.on('loaded', () => {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.texture.width;
    canvas.height = sprite.texture.height;
    const ctx = canvas.getContext('2d')!;
    const img = (sprite.texture.baseTexture.resource as PIXI.Resource & { source: HTMLImageElement }).source;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    sprite.containsPoint = (point: PIXI.Point): boolean => {
      const local = sprite.worldTransform.applyInverse(point);
      const texX = Math.round(local.x + sprite.texture.width / 2);
      const texY = Math.round(local.y + sprite.texture.height / 2);

      if (texX < 0 || texY < 0 || texX >= sprite.texture.width || texY >= sprite.texture.height) return false;

      const alpha = imageData[(texY * sprite.texture.width + texX) * 4 + 3];
      return alpha > 10;
    };
  });

  if (sprite.texture.baseTexture.valid) {
    sprite.texture.baseTexture.emit('loaded');
  }

  eventPointerDown(sprite, callback);
  eventPointerUp(sprite, callback);

  return sprite;
}

export function createPixiApplication(width: number, height: number) {
  const app = new PIXI.Application<HTMLCanvasElement>({
    width: width,
    height: height,
    backgroundColor: 0x222222,
    forceCanvas: true,
  });

  return app;
}

interface CreatePixiContainerResult {
  container: PIXI.Container;
  tickerCallback: () => void;
}

function eventPointerDown(obj: PIXI.Graphics | PIXI.Sprite, callback: (event: PIXI.FederatedPointerEvent) => void) {
  // Включаем интерактивность для кнопки
  obj.eventMode = 'static';

  obj.on('pointerdown', (event) => {
    callback(event);
    console.log('Сработало событие pointerdown!', event.global);
  });
}

function eventPointerUp(obj: PIXI.Graphics | PIXI.Sprite, callback: (event: PIXI.FederatedPointerEvent) => void) {
  // Включаем интерактивность для кнопки
  obj.eventMode = 'static';

  obj.on('pointerup', (event) => {
    callback(event);
    console.log('Сработало событие pointerup!', event.global);
  });
}

export function createPixiContainers(callback: (event: PIXI.FederatedPointerEvent) => void) {
  return [
    createPixiContainer1(callback),
    createPixiContainer2(callback),
    createPixiContainer3(callback),
    createPixiContainer4(callback),
  ];
}

function createPixiContainer1(callback: (event: PIXI.FederatedPointerEvent) => void): CreatePixiContainerResult {
  const container = new PIXI.Container();

  const rect = createRect(
    120,
    80,
    0x0000ff,
    {
      x: 160,
      y: 130,
      rotation: 0.3,
      scaleX: 1.2,
      scaleY: 1.2,
    },
    callback,
  );
  container.addChild(rect);

  const circle = createShape(
    new PIXI.Circle(0, 0, 45),
    0xff0000,
    {
      x: 530,
      y: 110,
      scaleX: 1.2,
      scaleY: 0.7,
    },
    callback,
  );
  container.addChild(circle);

  const ellipse = createShape(
    new PIXI.Ellipse(0, 0, 70, 35),
    0x00ff00,
    {
      x: 340,
      y: 130,
      rotation: -0.5,
    },
    callback,
  );
  container.addChild(ellipse);

  const triangle = createShape(
    new PIXI.Polygon([0, -45, 40, 30, -40, 30]),
    0xffaa00,
    {
      x: 500,
      y: 310,
      rotation: 0.2,
      scaleX: 1.1,
      scaleY: 1.1,
    },
    callback,
  );
  container.addChild(triangle);

  const polyline = createPolyline(
    [
      { x: 0, y: 0 },
      { x: 60, y: -40 },
      { x: 120, y: 15 },
      { x: 180, y: -30 },
    ],
    0x8000ff,
    5,
    { x: 80, y: 330, rotation: 0.0 },
    callback,
  );
  container.addChild(polyline);

  const sprite1 = createSprite(
    'https://pixijs.com/assets/bunny.png',
    {
      x: 200,
      y: 490,
      rotation: 0.4,
      scaleX: 2.5,
      scaleY: 2.5,
    },
    callback,
  );
  container.addChild(sprite1);

  const sprite2 = createSprite(
    'https://pixijs.com/assets/bunny.png',
    {
      x: 460,
      y: 490,
      scaleX: 3.5,
      scaleY: 1.8,
    },
    callback,
  );
  container.addChild(sprite2);

  return {
    container: container,
    tickerCallback: () => {
      rect.rotation += 0.01;
      circle.rotation += 0.005;
      ellipse.rotation -= 0.008;
      triangle.rotation += 0.006;
    },
  };
}

function createPixiContainer2(callback: (event: PIXI.FederatedPointerEvent) => void): CreatePixiContainerResult {
  const container = new PIXI.Container();

  const rect = createRect(
    120,
    80,
    0x0000ff,
    {
      x: 160,
      y: 130,
      rotation: 0.3,
      scaleX: 1.2,
      scaleY: 1.2,
    },
    callback,
  );
  container.addChild(rect);

  return {
    container: container,
    tickerCallback: () => {
      rect.rotation += 0.01;
    },
  };
}

function createPixiContainer3(callback: (event: PIXI.FederatedPointerEvent) => void): CreatePixiContainerResult {
  const container = new PIXI.Container();

  const circle = createShape(
    new PIXI.Circle(0, 0, 45),
    0xff0000,
    {
      x: 530,
      y: 110,
      scaleX: 1.2,
      scaleY: 0.7,
    },
    callback,
  );
  container.addChild(circle);

  return {
    container: container,
    tickerCallback: () => {
      circle.rotation += 0.005;
    },
  };
}

function createPixiContainer4(callback: (event: PIXI.FederatedPointerEvent) => void): CreatePixiContainerResult {
  const container = new PIXI.Container();

  const ellipse = createShape(
    new PIXI.Ellipse(0, 0, 70, 35),
    0x00ff00,
    {
      x: 340,
      y: 130,
      rotation: -0.5,
    },
    callback,
  );
  container.addChild(ellipse);

  const triangle = createShape(
    new PIXI.Polygon([0, -45, 40, 30, -40, 30]),
    0xffaa00,
    {
      x: 500,
      y: 310,
      rotation: 0.2,
      scaleX: 1.1,
      scaleY: 1.1,
    },
    callback,
  );
  container.addChild(triangle);

  const polyline = createPolyline(
    [
      { x: 0, y: 0 },
      { x: 60, y: -40 },
      { x: 120, y: 15 },
      { x: 180, y: -30 },
    ],
    0x8000ff,
    5,
    { x: 80, y: 330, rotation: 0.0 },
    callback,
  );
  container.addChild(polyline);

  const sprite1 = createSprite(
    'https://pixijs.com/assets/bunny.png',
    {
      x: 200,
      y: 490,
      rotation: 0.4,
      scaleX: 2.5,
      scaleY: 2.5,
    },
    callback,
  );
  container.addChild(sprite1);

  const sprite2 = createSprite(
    'https://pixijs.com/assets/bunny.png',
    {
      x: 460,
      y: 490,
      scaleX: 3.5,
      scaleY: 1.8,
    },
    callback,
  );
  container.addChild(sprite2);

  return {
    container: container,
    tickerCallback: () => {
      ellipse.rotation -= 0.008;
      triangle.rotation += 0.006;
    },
  };
}
