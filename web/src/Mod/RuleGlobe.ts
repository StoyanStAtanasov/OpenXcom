import { Polygon } from "./Polygon.ts";

function int16le(bytes: Uint8Array, offset: number): number {
  const value = bytes[offset] | (bytes[offset + 1] << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}

export function xcom2Rad(deg: number): number {
  return deg * 0.125 * Math.PI / 180.0;
}

export class RuleGlobe {
  private _polygons: Polygon[] = [];
  private _textureColors = new Map<number, number>();

  loadDat(buffer: ArrayBuffer | Uint8Array): void {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this._polygons = [];
    for (let offset = 0; offset + 19 < bytes.length; offset += 20) {
      const value: number[] = [];
      for (let i = 0; i < 10; ++i) {
        value.push(int16le(bytes, offset + i * 2));
      }
      const points = value[6] !== -1 ? 4 : 3;
      const polygon = new Polygon(points);
      for (let i = 0, j = 0; i < points; ++i) {
        polygon.setLongitude(i, xcom2Rad(value[j++]));
        polygon.setLatitude(i, xcom2Rad(value[j++]));
      }
      polygon.setTexture(value[8]);
      this._polygons.push(polygon);
    }
  }

  getPolygons(): Polygon[] {
    return this._polygons;
  }

  loadTextureDat(buffer: ArrayBuffer | Uint8Array, width = 32, height = 32): void {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const frameSize = width * height;
    this._textureColors.clear();
    for (let frame = 0; frame * frameSize < bytes.length; ++frame) {
      const counts = new Map<number, number>();
      const start = frame * frameSize;
      const end = Math.min(start + frameSize, bytes.length);
      for (let i = start; i < end; ++i) {
        const pixel = bytes[i];
        if (pixel !== 0) {
          counts.set(pixel, (counts.get(pixel) || 0) + 1);
        }
      }
      let color = 0;
      let count = -1;
      for (const [candidate, candidateCount] of counts) {
        if (candidateCount > count) {
          color = candidate;
          count = candidateCount;
        }
      }
      this._textureColors.set(frame, color);
    }
  }

  getTextureColor(texture: number): number {
    return this._textureColors.get(texture) || this._textureColors.get(0) || 21;
  }
}
