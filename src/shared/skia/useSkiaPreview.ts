import { useRef, useEffect } from 'react';
import CanvasKitInit from 'canvaskit-wasm';
import type { CanvasKit, Surface, Canvas, Path } from 'canvaskit-wasm';
import type { SceneNode } from '@/shared/skia/types.ts';
import wasmUrl from '../../../node_modules/canvaskit-wasm/bin/canvaskit.wasm?url';

let ckPromise: Promise<CanvasKit> | null = null;
function getCanvasKit(): Promise<CanvasKit> {
  if (!ckPromise) {
    ckPromise = CanvasKitInit({
      locateFile: () => wasmUrl,
    });
  }
  return ckPromise;
}

function pixiColorToSkia(color: number, alpha: number): [number, number, number, number] {
  return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255, alpha];
}

function shapeToSVGString(shape: Record<string, unknown>): string {
  if (shape._type === 'Rectangle') {
    const { x, y, width, height } = shape as { x: number; y: number; width: number; height: number };
    return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
  }
  if (shape._type === 'Circle') {
    const { x, y, radius: r } = shape as { x: number; y: number; radius: number };
    return `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
  }
  if (shape._type === 'Ellipse') {
    const {
      x,
      y,
      halfWidth: rx,
      halfHeight: ry,
    } = shape as { x: number; y: number; halfWidth: number; halfHeight: number };
    return `M ${x - rx} ${y} A ${rx} ${ry} 0 1 0 ${x + rx} ${y} A ${rx} ${ry} 0 1 0 ${x - rx} ${y} Z`;
  }
  if (shape._type === 'Polygon') {
    const { points } = shape as { points: number[] };
    if (points.length < 2) return '';
    let d = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) d += ` L ${points[i]} ${points[i + 1]}`;
    return d + ' Z';
  }
  if (shape._type === 'Polyline') {
    const { points } = shape as { points: number[] };
    if (points.length < 2) return '';
    let d = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) d += ` L ${points[i]} ${points[i + 1]}`;
    return d;
  }
  return '';
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function hitTest(
  ck: CanvasKit,
  node: SceneNode,
  x: number,
  y: number,
  parentMatrix: DOMMatrix = new DOMMatrix(),
): string | null {
  if (!node.visible) return null;

  const lt = node.localTransform;
  const matrix = parentMatrix.multiply(new DOMMatrix([lt.a, lt.b, lt.c, lt.d, lt.tx, lt.ty]));

  for (const gd of node.graphicsData) {
    if (gd.shape._type === 'Polyline') {
      const { points } = gd.shape as { points: number[] };
      const inverse = matrix.inverse();
      const localPoint = inverse.transformPoint({ x, y });
      const hit = hitTestPolyline(points, gd.lineStyle.width, localPoint.x, localPoint.y);
      if (hit) return 'Polyline';
      continue;
    }

    const svgString = shapeToSVGString(gd.shape);
    if (!svgString) continue;

    const path = ck.Path.MakeFromSVGString(svgString);
    if (!path) continue;

    // инвертируем матрицу и переводим точку клика в локальные координаты фигуры
    const inverse = matrix.inverse();
    const localPoint = inverse.transformPoint({ x, y });

    const hit = path.contains(localPoint.x, localPoint.y);
    path.delete();

    if (hit) return gd.shape._type as string;
  }

  for (let i = node.children.length - 1; i >= 0; i--) {
    const result = hitTest(ck, node.children[i], x, y, matrix);
    if (result) return result;
  }

  return null;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hitTestPolyline(points: number[], lineWidth: number, x: number, y: number): boolean {
  const threshold = lineWidth / 2 + 2; // +2px запас как в Pixi
  for (let i = 0; i < points.length - 2; i += 2) {
    const dist = distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]);
    if (dist <= threshold) return true;
  }
  return false;
}

function renderNode(ck: CanvasKit, skCanvas: Canvas, node: SceneNode): void {
  if (!node.visible) return;

  skCanvas.save();

  const lt = node.localTransform;
  skCanvas.concat([lt.a, lt.c, lt.tx, lt.b, lt.d, lt.ty, 0, 0, 1]);

  for (const gd of node.graphicsData) {
    const svgString = shapeToSVGString(gd.shape);
    if (!svgString) continue;

    const path: Path | null = ck.Path.MakeFromSVGString(svgString);
    if (!path) continue;

    if (gd.fillStyle.visible) {
      const paint = new ck.Paint();
      paint.setStyle(ck.PaintStyle.Fill);
      paint.setAntiAlias(true);
      const [r, g, b, a] = pixiColorToSkia(gd.fillStyle.color, gd.fillStyle.alpha);
      paint.setColor(ck.Color4f(r, g, b, a));
      skCanvas.drawPath(path, paint);
      paint.delete();
    }

    if (gd.lineStyle.visible) {
      const paint = new ck.Paint();
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setAntiAlias(true);
      paint.setStrokeWidth(gd.lineStyle.width);
      const [r, g, b, a] = pixiColorToSkia(gd.lineStyle.color, gd.lineStyle.alpha);
      paint.setColor(ck.Color4f(r, g, b, a));
      skCanvas.drawPath(path, paint);
      paint.delete();
    }

    path.delete();
  }

  for (const child of node.children) {
    renderNode(ck, skCanvas, child);
  }

  skCanvas.restore();
}

interface UseSkiaPreviewOptions {
  getSceneJSON: () => SceneNode;
  width: number;
  height: number;
  callback: (message: string, type: 'pointerdown' | 'pointerup') => void;
}

export function useSkiaPreview(options: UseSkiaPreviewOptions) {
  const { getSceneJSON } = options;

  const skiaCanvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<Surface | null>(null);
  const ckRef = useRef<CanvasKit | null>(null);
  const sceneRef = useRef<SceneNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = skiaCanvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    async function init() {
      const ck = await getCanvasKit();
      if (cancelled) return;

      ckRef.current = ck;

      const surface = ck.MakeWebGLCanvasSurface(canvas!);
      if (!surface) {
        console.error('Skia: не удалось создать WebGL surface');
        return;
      }
      surfaceRef.current = surface; //

      function frame() {
        if (cancelled || !surfaceRef.current || !ckRef.current) return;

        const scene = getSceneJSON();
        sceneRef.current = scene;

        const skCanvas = surfaceRef.current.getCanvas();
        skCanvas.clear(ck.Color4f(0.13, 0.13, 0.13, 1));
        renderNode(ck, skCanvas, scene);
        surfaceRef.current.flush();

        rafRef.current = requestAnimationFrame(frame);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      surfaceRef.current?.delete();
      surfaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = skiaCanvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (event: PointerEvent) => {
      const ck = ckRef.current;
      const scene = sceneRef.current;
      if (!ck || !scene) return;

      const { x, y } = getCanvasPoint(canvas, event);
      const hit = hitTest(ck, scene, x, y);
      if (hit !== null) {
        console.log('Skia pointerdown!');
        options.callback(
          `Сработало событие pointerdown! 
        Point x = ${x.toFixed(2)},  y = ${y.toFixed(2)}`,
          'pointerdown',
        );
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const ck = ckRef.current;
      const scene = sceneRef.current;
      if (!ck || !scene) return;

      const { x, y } = getCanvasPoint(canvas, event);
      const hit = hitTest(ck, scene, x, y);
      if (hit !== null) {
        console.log('Skia pointerup!');
        options.callback(
          `Сработало событие pointerup! 
        Point x = ${x.toFixed(2)},  y = ${y.toFixed(2)}`,
          'pointerup',
        );
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  return { skiaCanvasRef };
}
