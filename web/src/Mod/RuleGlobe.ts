import { Polygon } from "./Polygon.ts";
import { Texture, type TextureDefinition, type TerrainCriteriaDefinition } from "./Texture.ts";

function int16le(bytes: Uint8Array, offset: number): number {
  const value = bytes[offset] | (bytes[offset + 1] << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}

export function xcom2Rad(deg: number): number {
  return deg * 0.125 * Math.PI / 180.0;
}

export class RuleGlobe {
  private _polygons: Polygon[] = [];
  private _textures = new Map<number, Texture>();
  private _textureColors = new Map<number, number>();

  load(source: string): void {
    for (const definition of parseGlobeTextures(source)) {
      if (definition.delete != null) {
        this._textures.delete(definition.delete);
        continue;
      }
      if (definition.id == null) {
        continue;
      }
      let texture = this._textures.get(definition.id);
      if (!texture) {
        texture = new Texture(definition.id);
        this._textures.set(definition.id, texture);
      }
      texture.load(definition);
    }
  }

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

  getTexture(id: number): Texture | null {
    return this._textures.get(id) || null;
  }

  getTerrains(deployment: string): string[] {
    const terrains = new Set<string>();
    for (const texture of this._textures.values()) {
      if (!texture.getDeployments().has(deployment)) {
        continue;
      }
      for (const terrain of texture.getTerrain()) {
        if (terrain.name) {
          terrains.add(terrain.name);
        }
      }
    }
    return [...terrains];
  }
}

type GlobeTextureDefinition = TextureDefinition & {
  delete?: number;
};

function parseGlobeTextures(source: string): GlobeTextureDefinition[] {
  const definitions: GlobeTextureDefinition[] = [];
  let inTextures = false;
  let current: GlobeTextureDefinition | null = null;
  let currentTerrain: TerrainCriteriaDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();
    if (indent === 2 && /^textures:\s*$/.test(trimmed)) {
      inTextures = true;
      current = null;
      currentTerrain = null;
      section = "";
      continue;
    }
    if (!inTextures) {
      continue;
    }
    if (indent <= 2 && !/^textures:\s*$/.test(trimmed)) {
      inTextures = false;
      continue;
    }

    const idStart = /^-\s+id:\s*(-?[0-9]+)\s*$/.exec(trimmed);
    if (indent === 4 && idStart) {
      current = { id: Number(idStart[1]) };
      definitions.push(current);
      currentTerrain = null;
      section = "";
      continue;
    }

    const deleteStart = /^-\s+delete:\s*(-?[0-9]+)\s*$/.exec(trimmed);
    if (indent === 4 && deleteStart) {
      definitions.push({ delete: Number(deleteStart[1]) });
      current = null;
      currentTerrain = null;
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    if (indent === 6) {
      if (/^terrain:\s*$/.test(trimmed)) {
        current.terrain = current.terrain || [];
        currentTerrain = null;
        section = "terrain";
        continue;
      }
      if (/^deployments:\s*$/.test(trimmed)) {
        current.deployments = current.deployments || {};
        currentTerrain = null;
        section = "deployments";
        continue;
      }
    }

    const terrainStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
    if (indent === 8 && section === "terrain" && terrainStart) {
      currentTerrain = { name: unquote(terrainStart[1]) };
      (current.terrain ||= []).push(currentTerrain);
      continue;
    }

    const deployment = /^([A-Za-z0-9_]+):\s*(-?[0-9]+)\s*$/.exec(trimmed);
    if (indent === 8 && section === "deployments" && deployment) {
      if (!current.deployments || current.deployments instanceof Map) {
        current.deployments = {};
      }
      (current.deployments as Record<string, number>)[deployment[1]] = Number(deployment[2]);
      continue;
    }

    if (indent === 10 && section === "terrain" && currentTerrain) {
      const prop = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (!prop) {
        continue;
      }
      if (prop[1] === "weight") {
        currentTerrain.weight = Number(prop[2]);
      } else if (prop[1] === "area") {
        currentTerrain.area = parseNumberList(prop[2]);
      }
    }
  }

  return definitions;
}

function stripComment(line: string): string {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    } else if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNumberList(value: string): number[] {
  const body = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!body.trim()) {
    return [];
  }
  return body.split(",").map(part => Number(part.trim())).filter(part => Number.isFinite(part));
}
