declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imagedata: ImageData, options?: object): string;
    imagedataToTracedata(imagedata: ImageData, options?: object): object;
    svgToString(tracedata: object, options?: object): string;
  };
  export default ImageTracer;
}
