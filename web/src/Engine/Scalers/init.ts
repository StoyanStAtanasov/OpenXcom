import { RGBtoYUV } from "./common.ts";

let initialized = false;

export function hqxInit(): void {
  initialized = true;
  void RGBtoYUV;
}

export function isHqxInitialized(): boolean {
  return initialized;
}
