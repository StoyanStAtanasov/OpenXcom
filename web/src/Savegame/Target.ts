import type { Language } from "../Engine/Language.ts";
import type { MovingTarget } from "./MovingTarget.ts";

export type CoordinateTarget = {
  getLongitude(): number;
  getLatitude(): number;
};

export type TargetLike = CoordinateTarget & {
  getName(lang: Language): string;
  getType?(): string;
  getId?(): number;
  setId?(id: number): void;
  getDefaultName?(lang: Language): string;
  getMarkerName?(): string;
  getMarkerId?(): number;
  getMarker?(): number;
  getFollowers?(): MovingTarget[];
};

function areSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * Math.max(1.0, Math.abs(left), Math.abs(right));
}

function clampAcos(value: number): number {
  return Math.acos(Math.max(-1, Math.min(1, value)));
}

export abstract class Target implements TargetLike {
  protected _lon = 0.0;
  protected _lat = 0.0;
  protected _id = 0;
  protected _name = "";
  protected _followers: MovingTarget[] = [];

  abstract getType(): string;

  abstract getMarker(): number;

  getLongitude(): number {
    return this._lon;
  }

  setLongitude(lon: number): void {
    this._lon = lon;
    while (this._lon < 0) {
      this._lon += 2 * Math.PI;
    }
    while (this._lon >= 2 * Math.PI) {
      this._lon -= 2 * Math.PI;
    }
  }

  getLatitude(): number {
    return this._lat;
  }

  setLatitude(lat: number): void {
    this._lat = lat;
    if (this._lat < -Math.PI / 2) {
      this._lat = -Math.PI - this._lat;
      this.setLongitude(this._lon + Math.PI);
    } else if (this._lat > Math.PI / 2) {
      this._lat = Math.PI - this._lat;
      this.setLongitude(this._lon - Math.PI);
    }
  }

  getId(): number {
    return this._id;
  }

  setId(id: number): void {
    this._id = id;
  }

  getName(lang: Language): string {
    if (this._name.length === 0) {
      return this.getDefaultName(lang);
    }
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  getDefaultName(lang: Language): string {
    return String(lang.getString(this.getMarkerName()).arg(this._id));
  }

  getMarkerName(): string {
    return `${this.getType()}_`;
  }

  getMarkerId(): number {
    return this._id;
  }

  getFollowers(): MovingTarget[] {
    return this._followers;
  }

  getDistance(target: CoordinateTarget): number;
  getDistance(lon: number, lat: number): number;
  getDistance(targetOrLon: CoordinateTarget | number, lat?: number): number {
    const lon = typeof targetOrLon === "number" ? targetOrLon : targetOrLon.getLongitude();
    const targetLat = typeof targetOrLon === "number" ? lat ?? 0 : targetOrLon.getLatitude();
    if (areSame(lon, this._lon) && areSame(targetLat, this._lat)) {
      return 0.0;
    }
    return clampAcos(Math.cos(this._lat) * Math.cos(targetLat) * Math.cos(lon - this._lon) + Math.sin(this._lat) * Math.sin(targetLat));
  }
}

export function targetsAreSame(left: number, right: number): boolean {
  return areSame(left, right);
}

export function nautical(speed: number): number {
  return speed * (1 / 60.0) * (Math.PI / 180.0);
}
