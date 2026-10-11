declare module 'pngjs' {
  export interface PNGWithMetadata {
    width: number;
    height: number;
    data: Buffer;
  }

  export class PNG {
    static sync: {
      read(buffer: Buffer): PNGWithMetadata;
    };
  }
}
