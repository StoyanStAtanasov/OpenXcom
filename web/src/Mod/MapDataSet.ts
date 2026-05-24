import { SurfaceSet } from "../Engine/SurfaceSet.ts";
import { MapData, TilePart } from "./MapData.ts";
import type { MCDPatch } from "./MCDPatch.ts";

const MCD_RECORD_SIZE = 62;

function bytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

export class MapDataSet {
  private _objects: MapData[] = [];
  private _surfaceSet: SurfaceSet | null = null;
  private _loaded = false;
  private static _blankTile: MapData | null = null;
  private static _scorchedTile: MapData | null = null;

  constructor(private _name: string) {}

  static loadLOFTEMPS(dat: ArrayBuffer | Uint8Array): number[] {
    const data = bytes(dat);
    if (data.length % 2 !== 0) {
      throw new Error("Invalid LOFTEMPS");
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const voxelData: number[] = [];
    for (let offset = 0; offset < data.length; offset += 2) {
      voxelData.push(view.getUint16(offset, true));
    }
    return voxelData;
  }

  getName(): string {
    return this._name;
  }

  getSize(): number {
    return this._objects.length;
  }

  getObject(i: number): MapData {
    if (i < 0 || i >= this._objects.length) {
      throw new Error(`MCD ${this._name} has no object ${i}`);
    }
    return this._objects[i];
  }

  getSurfaceset(): SurfaceSet | null {
    return this._surfaceSet;
  }

  loadData(mcdData: ArrayBuffer | Uint8Array, pckData: ArrayBuffer | Uint8Array | null = null, tabData: ArrayBuffer | Uint8Array | null = null, patch: MCDPatch | null = null): void {
    if (this._loaded) {
      return;
    }
    this._loaded = true;
    const mcd = bytes(mcdData);
    if (mcd.length % MCD_RECORD_SIZE !== 0) {
      throw new Error(`Invalid MCD file TERRAIN/${this._name}.MCD`);
    }

    const view = new DataView(mcd.buffer, mcd.byteOffset, mcd.byteLength);
    const records = Math.trunc(mcd.length / MCD_RECORD_SIZE);
    for (let record = 0; record < records; ++record) {
      const offset = record * MCD_RECORD_SIZE;
      const to = new MapData(this);
      this._objects.push(to);

      for (let frame = 0; frame < 8; ++frame) {
        to.setSprite(frame, view.getUint8(offset + frame));
      }
      to.setYOffset(view.getUint8(offset + 49));
      to.setSpecialType(view.getUint8(offset + 59), view.getUint8(offset + 53) as TilePart);
      to.setTUCosts(view.getUint8(offset + 39), view.getUint8(offset + 41), view.getUint8(offset + 40));
      to.setFlags(
        view.getUint8(offset + 30) !== 0,
        view.getUint8(offset + 31) !== 0,
        view.getUint8(offset + 32) !== 0,
        view.getUint8(offset + 33),
        view.getUint8(offset + 34) !== 0,
        view.getUint8(offset + 35) !== 0,
        view.getUint8(offset + 36) !== 0,
        view.getUint8(offset + 37) !== 0,
        view.getUint8(offset + 60) !== 0
      );
      to.setTerrainLevel(view.getInt8(offset + 48));
      to.setFootstepSound(view.getUint8(offset + 52));
      to.setAltMCD(view.getUint8(offset + 46));
      to.setDieMCD(view.getUint8(offset + 44));
      to.setBlockValue(
        view.getUint8(offset + 51),
        view.getUint8(offset + 31),
        view.getUint8(offset + 43),
        view.getUint8(offset + 37),
        view.getUint8(offset + 45),
        view.getUint8(offset + 43)
      );
      to.setLightSource(view.getUint8(offset + 58));
      to.setArmor(view.getUint8(offset + 42));
      to.setFlammable(view.getUint8(offset + 45));
      to.setFuel(view.getUint8(offset + 57));
      to.setExplosiveType(view.getUint8(offset + 54));
      to.setExplosive(view.getUint8(offset + 55));
      to.setMiniMapIndex(view.getUint16(offset + 20, true));

      for (let layer = 0; layer < 12; ++layer) {
        to.setLoftID(view.getUint8(offset + 8 + layer), layer);
      }

      if (this._name === "BLANKS") {
        if (record === 0) {
          MapDataSet._blankTile = to;
        } else if (record === 1) {
          MapDataSet._scorchedTile = to;
        }
      }
    }

    patch?.modifyData(this);
    this.validateData();

    if (pckData && tabData) {
      this._surfaceSet = new SurfaceSet(32, 40);
      this._surfaceSet.loadPck(pckData, tabData);
    }
  }

  unloadData(): void {
    if (!this._loaded) {
      return;
    }
    this._objects = [];
    this._surfaceSet = null;
    this._loaded = false;
    if (this._name === "BLANKS") {
      MapDataSet._blankTile = null;
      MapDataSet._scorchedTile = null;
    }
  }

  static getBlankFloorTile(): MapData | null {
    return MapDataSet._blankTile;
  }

  static getScorchedEarthTile(): MapData | null {
    return MapDataSet._scorchedTile;
  }

  private validateData(): void {
    let validData = true;
    for (let i = 0; i < this._objects.length; ++i) {
      const object = this._objects[i];
      if (object.getDieMCD() >= this._objects.length) {
        validData = false;
      }
      if (object.getAltMCD() >= this._objects.length) {
        validData = false;
      }
      if (object.getArmor() === 0) {
        validData = false;
      }
    }
    if (!validData) {
      throw new Error(`invalid MCD file: TERRAIN/${this._name}.MCD, check log file for more details.`);
    }
  }
}
