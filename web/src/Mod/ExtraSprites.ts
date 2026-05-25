import { Surface } from "../Engine/Surface.ts";
import { SurfaceSet } from "../Engine/SurfaceSet.ts";
import type { ModDataLike } from "./ExtraSounds.ts";

export type ExtraSpritesNode = {
  type?: string;
  files?: Record<string, string> | Map<number, string>;
  width?: number;
  height?: number;
  singleImage?: boolean;
  subX?: number;
  subY?: number;
};

export class ExtraSprites {
  private _type = "";
  private _sprites = new Map<number, string>();
  private _current: ModDataLike | null = null;
  private _width = 320;
  private _height = 200;
  private _singleImage = false;
  private _subX = 0;
  private _subY = 0;
  private _loaded = false;

  load(node: ExtraSpritesNode, current: ModDataLike | null): void {
    this._type = node.type ?? this._type;
    this._sprites = node.files instanceof Map
      ? new Map(node.files)
      : new Map(Object.entries(node.files || {}).map(([key, value]) => [Number(key), value]));
    this._width = node.width ?? this._width;
    this._height = node.height ?? this._height;
    this._singleImage = node.singleImage ?? this._singleImage;
    this._subX = node.subX ?? this._subX;
    this._subY = node.subY ?? this._subY;
    this._current = current;
  }

  getType(): string {
    return this._type;
  }

  getSprites(): Map<number, string> {
    return this._sprites;
  }

  getWidth(): number {
    return this._width;
  }

  getHeight(): number {
    return this._height;
  }

  getSingleImage(): boolean {
    return this._singleImage;
  }

  getSubX(): number {
    return this._subX;
  }

  getSubY(): number {
    return this._subY;
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  static isImageFile(filename: string): boolean {
    return /\.(png|gif|bmp|lbm|iff|pcx|tga|tif|tiff)$/i.test(filename);
  }

  loadSurface(surface: Surface | null): Surface | null {
    if (!this._singleImage) {
      return surface;
    }
    this._loaded = true;
    const result = new Surface(this._width, this._height);
    const fileName = this._sprites.values().next().value;
    if (fileName) {
      void result.loadImage(fileName);
    }
    return result;
  }

  loadSurfaceSet(set: SurfaceSet | null): SurfaceSet | null {
    if (this._singleImage) {
      return set;
    }
    this._loaded = true;
    const subdivision = this._subX !== 0 && this._subY !== 0;
    const surfaceSetX = subdivision ? this._subX : this._width;
    const surfaceSetY = subdivision ? this._subY : this._height;
    let result = set;
    if (!result) {
      result = new SurfaceSet(surfaceSetX, surfaceSetY);
    }
    for (const [index, fileName] of this._sprites) {
      if (fileName.endsWith("/")) {
        continue;
      }
      const frame = this.getFrame(result, index);
      void frame.loadImage(fileName);
    }
    return result;
  }

  private getFrame(set: SurfaceSet, index: number): Surface {
    let indexWithOffset = index;
    if (indexWithOffset >= set.getMaxSharedFrames() && this._current) {
      if (indexWithOffset >= this._current.size) {
        throw new Error(`ExtraSprites '${this._type}' frame '${indexWithOffset}' exceeds mod '${this._current.name}' size limit ${this._current.size}`);
      }
      indexWithOffset += this._current.offset;
    } else if (indexWithOffset < 0) {
      throw new Error(`ExtraSprites '${this._type}' frame '${indexWithOffset}' is not allowed.`);
    }
    const frame = set.getFrame(indexWithOffset);
    if (frame) {
      frame.clear();
      return frame;
    }
    return set.addFrame(indexWithOffset);
  }
}
