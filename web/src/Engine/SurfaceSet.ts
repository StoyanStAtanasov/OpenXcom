import { Surface } from "./Surface.ts";
import type { PaletteColor } from "../types.ts";

export class SurfaceSet {
  private _frames = new Map<number, Surface>();
  private _sharedFrames = Number.MAX_SAFE_INTEGER;

  constructor(private _width: number, private _height: number) {}

  loadPck(pck: ArrayBuffer | Uint8Array, tab?: ArrayBuffer | Uint8Array | null): void {
    const image = pck instanceof ArrayBuffer ? new Uint8Array(pck) : pck;
    let nframes = 1;

    if (tab) {
      const offsets = tab instanceof ArrayBuffer ? new Uint8Array(tab) : tab;
      if (offsets.length >= 4) {
        const view = new DataView(offsets.buffer, offsets.byteOffset, offsets.byteLength);
        const firstOffset = view.getInt32(0, true);
        nframes = firstOffset !== 0 ? Math.trunc(offsets.length / 2) : Math.trunc(offsets.length / 4);
      } else {
        nframes = Math.trunc(offsets.length / 2);
      }
    }

    this._frames.clear();
    let offset = 0;
    for (let frame = 0; frame < nframes; ++frame) {
      const surface = new Surface(this._width, this._height);
      this._frames.set(frame, surface);
      const pos = { x: 0, y: 0 };
      if (offset >= image.length) {
        continue;
      }

      const rows = image[offset++];
      for (let i = 0; i < rows; ++i) {
        for (let j = 0; j < this._width; ++j) {
          surface.setPixelIterative(pos, 0);
        }
      }

      while (offset < image.length) {
        const value = image[offset++];
        if (value === 255) {
          break;
        }
        if (value === 254) {
          const count = offset < image.length ? image[offset++] : 0;
          for (let i = 0; i < count; ++i) {
            surface.setPixelIterative(pos, 0);
          }
        } else {
          surface.setPixelIterative(pos, value);
        }
      }
    }
  }

  loadDat(dat: ArrayBuffer | Uint8Array): void {
    const image = dat instanceof ArrayBuffer ? new Uint8Array(dat) : dat;
    const nframes = Math.trunc(image.length / (this._width * this._height));
    this._frames.clear();
    for (let frame = 0; frame < nframes; ++frame) {
      const surface = new Surface(this._width, this._height);
      const start = frame * this._width * this._height;
      surface.loadRaw(image.slice(start, start + this._width * this._height));
      this._frames.set(frame, surface);
    }
  }

  getFrame(i: number): Surface | null {
    return this._frames.get(i) || null;
  }

  addFrame(i: number): Surface {
    const surface = new Surface(this._width, this._height);
    this._frames.set(i, surface);
    return surface;
  }

  getWidth(): number {
    return this._width;
  }

  getHeight(): number {
    return this._height;
  }

  setMaxSharedFrames(i: number): void {
    this._sharedFrames = i >= 0 ? i : 0;
  }

  getMaxSharedFrames(): number {
    return this._sharedFrames;
  }

  getTotalFrames(): number {
    return this._frames.size;
  }

  setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    for (const frame of this._frames.values()) {
      frame.setPalette(colors, firstcolor, ncolors);
    }
  }

  getFrames(): Map<number, Surface> {
    return this._frames;
  }
}
