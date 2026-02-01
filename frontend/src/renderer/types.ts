/**
 * Type definitions for the visionflow IPC bridge
 */

export interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
}

export interface VisionFlowAPI {
  getSources: () => Promise<SourceInfo[]>;
  setSource: (sourceId: string) => Promise<boolean>;
  saveRecording: (buffer: ArrayBuffer) => Promise<string>;
}

declare global {
  interface Window {
    visionflow: VisionFlowAPI;
  }
}
