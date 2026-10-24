/**
 * Minimal ambient types for pdfmake 0.3's Node entry points.
 *
 * `@types/pdfmake` models the class-based v0.2 API; v0.3 exports a ready-made
 * instance from `pdfmake/js/index.js`, so we describe only what this module uses.
 */
declare module 'pdfmake/js/index.js' {
  interface PdfMakeInstance {
    addFonts(fonts: Record<string, Record<string, string>>): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    setLocalAccessPolicy(callback: (path: string) => boolean): void;
    createPdf(documentDefinition: unknown): {
      getBuffer(): Promise<Buffer>;
    };
  }
  const pdfmake: PdfMakeInstance;
  export default pdfmake;
}

declare module 'pdfmake/standard-fonts/Helvetica.js' {
  const fonts: Record<string, Record<string, string>>;
  export default fonts;
}