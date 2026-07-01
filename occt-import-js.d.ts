declare module 'occt-import-js' {
  interface OcctInstance {
    ReadStepFile: (content: Uint8Array) => Promise<{ meshes: unknown[] }>;
  }

  function occtImportJs(config: {
    wasmBinary?: ArrayBuffer;
    locateFile?: (path: string) => string;
  }): OcctInstance;

  export = occtImportJs;
}
