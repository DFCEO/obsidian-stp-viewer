declare module 'occt-import-js' {
  interface OcctMeshAttribute {
    array: number[];
  }

  interface OcctMesh {
    name?: string;
    color?: [number, number, number];
    attributes: {
      position: OcctMeshAttribute;
      normal?: OcctMeshAttribute;
      color?: OcctMeshAttribute;
    };
    index: { array: number[] };
  }

  interface OcctInstance {
    ReadStepFile: (content: Uint8Array) => Promise<{ meshes: OcctMesh[] }>;
  }

  const occtImportJs: (config: {
    wasmBinary?: ArrayBuffer;
    locateFile?: (path: string) => string;
  }) => OcctInstance;

  export { OcctMeshAttribute, OcctMesh, OcctInstance };
  export default occtImportJs;
}
