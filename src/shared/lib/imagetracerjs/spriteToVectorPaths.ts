import * as PIXI from 'pixi.js';
import ImageTracer from 'imagetracerjs';

interface SVGPath {
  points: number[];
  fillColor: number;
  fillAlpha: number;
}

function parseColor(rgb: string): number {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 0x000000;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return (r << 16) | (g << 8) | b;
}

function parseSVGPathD(d: string): number[] {
  const points: number[] = [];
  const commands = d.trim().split(/(?=[MLCQHVZz])/);
  let currentX = 0;
  let currentY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (type === 'M' && args.length >= 2) {
      currentX = args[0];
      currentY = args[1];
      points.push(currentX, currentY);
    } else if (type === 'L' && args.length >= 2) {
      currentX = args[0];
      currentY = args[1];
      points.push(currentX, currentY);
    } else if (type === 'H' && args.length >= 1) {
      currentX = args[0];
      points.push(currentX, currentY);
    } else if (type === 'V' && args.length >= 1) {
      currentY = args[0];
      points.push(currentX, currentY);
    } else if (type === 'Q' && args.length >= 4) {
      // квадратичная кривая Безье — аппроксимируем точками
      const cpX = args[0];
      const cpY = args[1];
      const endX = args[2];
      const endY = args[3];
      for (let t = 0.02; t <= 1; t += 0.02) {
        const x = (1 - t) * (1 - t) * currentX + 2 * (1 - t) * t * cpX + t * t * endX;
        const y = (1 - t) * (1 - t) * currentY + 2 * (1 - t) * t * cpY + t * t * endY;
        points.push(x, y);
      }
      currentX = endX;
      currentY = endY;
    } else if (type === 'C' && args.length >= 6) {
      const cp1X = args[0];
      const cp1Y = args[1];

      const cp2X = args[2];
      const cp2Y = args[3];

      const endX = args[4];
      const endY = args[5];

      for (let t = 0.02; t <= 1; t += 0.02) {
        const mt = 1 - t;

        const x = mt * mt * mt * currentX + 3 * mt * mt * t * cp1X + 3 * mt * t * t * cp2X + t * t * t * endX;

        const y = mt * mt * mt * currentY + 3 * mt * mt * t * cp1Y + 3 * mt * t * t * cp2Y + t * t * t * endY;

        points.push(x, y);
      }

      currentX = endX;
      currentY = endY;
    }
  }
  return points;
}

export function parseSVGToPaths(svg: string): SVGPath[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const pathElements = doc.querySelectorAll('path');
  const result: SVGPath[] = [];

  pathElements.forEach((el) => {
    const d = el.getAttribute('d') ?? '';
    const fill = el.getAttribute('fill') ?? 'rgb(0,0,0)';
    const opacity = parseFloat(el.getAttribute('opacity') ?? '1');

    if (opacity === 0) return;

    const points = parseSVGPathD(d);
    if (points.length < 4) return;

    result.push({
      points,
      fillColor: parseColor(fill),
      fillAlpha: opacity,
    });
  });

  return result;
}

export function spriteToSVGPaths(sprite: PIXI.Sprite): SVGPath[] {
  const texture = sprite.texture;
  const w = texture.width;
  const h = texture.height;

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  const resource = texture.baseTexture.resource;
  if (resource instanceof PIXI.ImageResource) {
    const source = resource.source;
    if (source instanceof HTMLImageElement) {
      ctx.drawImage(source, 0, 0);
    }
  }

  const imageData = ctx.getImageData(0, 0, w, h);

  const svg = ImageTracer.imagedataToSVG(imageData, {
    ltres: 0.1,
    qtres: 0.1,

    pathomit: 0,

    colorsampling: 2,
    numberofcolors: 128,

    mincolorratio: 0,
    colorquantcycles: 10,

    strokewidth: 0,
    linefilter: false,
  });

  return parseSVGToPaths(svg);
}
