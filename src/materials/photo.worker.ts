/// <reference lib="webworker" />
import { processSample } from './process';

export interface PhotoJob {
  w: number;
  h: number;
  buffer: ArrayBuffer;
  normalStrength: number;
}

export interface PhotoResult {
  w: number;
  h: number;
  albedo: ArrayBuffer;
  normal: ArrayBuffer;
  roughness: ArrayBuffer;
  mean: string;
}

self.onmessage = (e: MessageEvent<PhotoJob>) => {
  const { w, h, buffer, normalStrength } = e.data;
  const maps = processSample({ w, h, data: new Uint8ClampedArray(buffer) }, { normalStrength });
  const result: PhotoResult = {
    w,
    h,
    albedo: maps.albedo.data.buffer as ArrayBuffer,
    normal: maps.normal.data.buffer as ArrayBuffer,
    roughness: maps.roughness.data.buffer as ArrayBuffer,
    mean: maps.mean,
  };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(result, [result.albedo, result.normal, result.roughness]);
};
