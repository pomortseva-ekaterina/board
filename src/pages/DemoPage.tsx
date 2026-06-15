import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { loadSkiaPDF } from '@/shared/lib/skiaPdf/skiaPdf';

import Button from '@/shared/ui/Button.tsx';
import { createPixiApplication, createPixiContainers } from '@/shared/pixi/pixi.ts';

import { useSkiaPreview } from '@/shared/skia/useSkiaPreview.ts';
import { convertPixiContainerToSkia } from '@/shared/skia/pixiToSkia.ts';

const CANVAS_WIDTH = 650;
const CANVAS_HEIGHT = 600;

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export default function DemoPage() {
  const [pixiPointerDown, setPixiEventPointerDown] = useState<string>('');
  const [pixiEventPointerUp, setPixiEventPointerUp] = useState<string>('');

  const [skiaPointerDown, setSkiaEventPointerDown] = useState<string>('');
  const [skiaEventPointerUp, setSkiaEventPointerUp] = useState<string>('');

  const [containerIndex, setContainerIndex] = useState<number>(0);

  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const callback = (event: PIXI.FederatedPointerEvent) => {
    const type = event.type;
    if (type === 'pointerdown') {
      setPixiEventPointerDown(
        `Сработало событие pointerdown! Point x = ${event.global.x.toFixed(2)},  y = ${event.global.y.toFixed(2)}`,
      );
    }
    if (type === 'pointerup') {
      setPixiEventPointerUp(
        `Сработало событие pointerup! Point x = ${event.global.x.toFixed(2)},  y = ${event.global.y.toFixed(2)}`,
      );
    }
  };

  const pixiContainers = useRef(createPixiContainers(callback)).current;

  const appRef = useRef(createPixiApplication(CANVAS_WIDTH, CANVAS_HEIGHT));

  const stage = appRef.current.stage;

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');

  useEffect(() => {
    canvasWrapRef.current?.appendChild(appRef.current.view);

    appRef.current.stage.addChild(pixiContainers[0].container); //в pixi приложение добавляет контейнер
    appRef.current.ticker.add(pixiContainers[0].tickerCallback); // Анимация
  }, []);

  const { skiaCanvasRef } = useSkiaPreview({
    getSceneJSON: () => convertPixiContainerToSkia(stage),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    callback: (massage, type) => {
      if (type === 'pointerdown') {
        setSkiaEventPointerDown(massage);
      }
      if (type === 'pointerup') {
        setSkiaEventPointerUp(massage);
      }
    },
  });

  const updateCurrentContainer = (index: number) => {
    stage.removeChild(pixiContainers[containerIndex].container);
    stage.addChild(pixiContainers[index].container); //в pixi приложение добавляет контейнер

    appRef.current.ticker.remove(pixiContainers[containerIndex].tickerCallback);
    appRef.current.ticker.add(pixiContainers[index].tickerCallback); // Анимация

    setContainerIndex(index);
  };

  const nextContainer = () => {
    const nextIndex = containerIndex + 1 >= pixiContainers.length ? 0 : containerIndex + 1;
    updateCurrentContainer(nextIndex);
  };

  const prevContainer = () => {
    const prevIndex = containerIndex === 0 ? pixiContainers.length - 1 : containerIndex - 1;
    updateCurrentContainer(prevIndex);
  };

  //экспорт PDF
  const handleExport = async () => {
    console.log('handleExport called', stage);
    if (!stage) return;
    setExportStatus('loading');
    try {
      const mod = await loadSkiaPDF();
      console.log('children count:', stage.children.length);
      stage.children.forEach((child, i) => {
        console.log(`child[${i}]:`, child.constructor.name);
      });

      const serialized = convertPixiContainerToSkia(stage);
      const pdfBytes: Uint8Array = mod.exportToPDF(serialized, CANVAS_WIDTH, CANVAS_HEIGHT);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scene.pdf';
      a.click();
      URL.revokeObjectURL(url);

      setExportStatus('success');
    } catch (e) {
      console.error('PDF export error:', e);
      setExportStatus('error');
    }
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'grid',
        columnGap: '24px',
        padding: '24px',
        gridTemplateColumns: `minmax(${CANVAS_WIDTH + 4}px, 1fr) minmax(${CANVAS_WIDTH + 4}px, 1fr) 100px`,
      }}
    >
      <div>
        {/* PIXI канвас*/}
        <div
          ref={canvasWrapRef}
          style={{
            border: '2px solid yellow',
            width: `${CANVAS_WIDTH + 4}px`,
            height: `${CANVAS_HEIGHT + 4}px`,
          }}
        />
        <div>
          Канвас 1 Pixi.js. Контейнер №{containerIndex + 1} из {pixiContainers.length}
        </div>
        <div>{pixiPointerDown !== '' ? pixiPointerDown : ''}</div>
        <div>{pixiEventPointerUp !== '' ? pixiEventPointerUp : ''}</div>
      </div>

      <div>
        <div style={{ border: '2px solid green', width: `${CANVAS_WIDTH + 4}px`, height: `${CANVAS_HEIGHT + 4}px` }}>
          {/* SKIA канвас*/}
          <canvas
            ref={skiaCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>
        <div>
          Канвас 2 Skia. Контейнер №{containerIndex + 1} из {pixiContainers.length}
        </div>
        <div>{skiaPointerDown !== '' ? skiaPointerDown : ''}</div>
        <div>{skiaEventPointerUp !== '' ? skiaEventPointerUp : ''}</div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          rowGap: '10px',
        }}
      >
        <Button onClick={handleExport} disabled={exportStatus === 'loading'}>
          {exportStatus === 'loading' ? 'Generating...' : 'Экспорт в PDF'}
        </Button>

        {/* кнопка Предыдущий PIXI.Container */}
        <Button onClick={prevContainer} disabled={exportStatus === 'loading'}>
          {exportStatus === 'loading' ? 'Generating...' : 'Предыдущий'}
        </Button>

        {/* кнопка Следующий PIXI.Container */}
        <Button onClick={nextContainer} disabled={exportStatus === 'loading'}>
          {exportStatus === 'loading' ? 'Generating...' : 'Следующий'}
        </Button>

        {exportStatus === 'success' && (
          <div style={{ marginTop: 8, color: '#4a9', fontSize: 12, fontFamily: 'monospace' }}>✓ Downloaded</div>
        )}
        {exportStatus === 'error' && (
          <div style={{ marginTop: 8, color: '#e55', fontSize: 12, fontFamily: 'monospace' }}>✗ Export failed</div>
        )}
      </div>
    </div>
  );
}
