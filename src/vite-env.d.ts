interface SkiaPDFModule {
  exportToPDF(container: object, pageWidth: number, pageHeight: number): Uint8Array;
}

declare module '*/skia_pdf.js' {
  const SkiaPDF: (moduleArg?: object) => Promise<SkiaPDFModule>;
  export default SkiaPDF;
}

declare module '*.wasm' {
  const url: string;
  export default url;
}
