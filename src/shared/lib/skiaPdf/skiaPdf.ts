import SkiaPDFInit from './skia_pdf.js';
import wasmUrl from './skia_pdf.wasm?url';

let moduleInstance: SkiaPDFModule | null = null;

export async function loadSkiaPDF(): Promise<SkiaPDFModule> {
  if (moduleInstance) return moduleInstance;

  moduleInstance = await SkiaPDFInit({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return wasmUrl;
      return path;
    },
  });

  return moduleInstance;
}

export async function exportContainerToPDF(container: object, pageWidth = 595, pageHeight = 842): Promise<void> {
  const mod = await loadSkiaPDF();
  const pdfBytes = mod.exportToPDF(container, pageWidth, pageHeight);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
