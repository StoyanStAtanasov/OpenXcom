import type { Language } from "../Engine/Language.ts";
import { Target } from "../Savegame/Target.ts";

/**
 * Represents a city of the world.
 */
export class City extends Target {
  constructor(name: string, lon: number, lat: number) {
    super();
    this._name = name;
    this._lon = lon;
    this._lat = lat;
  }

  getType(): string {
    return "";
  }

  override getName(lang: Language): string {
    return String(lang.getString(this._name));
  }

  getMarker(): number {
    return 8;
  }
}
