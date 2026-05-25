import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Game } from "../Engine/Game.ts";
import { Options } from "../Engine/Options.ts";
import type { State } from "../Engine/State.ts";
import { Polygon } from "../Mod/Polygon.ts";
import type { RuleGlobe } from "../Mod/RuleGlobe.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { Ufo } from "../Savegame/Ufo.ts";

type GlobeTarget = {
  getLongitude(): number;
  getLatitude(): number;
  getName(...args: any[]): string;
  isDiscovered?: () => boolean;
};

type CraftTarget = Craft & {
  getDestination?: () => GlobeTarget | null;
};

const NEAR_RADIUS = 25;
const DOGFIGHT_ZOOM = 3;
const RANDOM_SURF_SIZE = 60;
const COLOR_GROUP = 15 << 4;
const COLOR_SHADE = 15;

export class Globe extends InteractiveSurface {
  private _newBaseHover = false;
  private _hoverLon = Number.NaN;
  private _hoverLat = Number.NaN;
  private _rotationLon = 0;
  private _rotationLat = 0;
  private _zoom = 0;
  private _zoomOld = 0;
  private _zoomTexture = 0;
  private _radius = 0;
  private _radiusStep = 0;
  private _zoomRadius: number[] = [];
  private _polygons: Polygon[] = [];
  private _cacheLand: Polygon[] = [];
  private _rules: RuleGlobe | null = null;
  private _texture: SurfaceSet | null = null;
  private _randomNoiseData = new Int16Array(RANDOM_SURF_SIZE * RANDOM_SURF_SIZE);

  constructor(
    private _game: Game,
    private _centerX: number,
    private _centerY: number,
    width: number,
    height: number,
    x = 0,
    y = 0
  ) {
    super(width, height, x, y);
    this._rules = this._game.getMod()?.getGlobe() || null;
    this._texture = this._game.getMod()?.getSurfaceSet("TEXTURE.DAT") || null;
    this._polygons = this._rules?.getPolygons() || [];
    const save = this._game.getSavedGame();
    if (save) {
      this._rotationLon = save.getGlobeLongitude();
      this._rotationLat = save.getGlobeLatitude();
      this._zoom = save.getGlobeZoom();
      this._zoomOld = this._zoom;
    }
    this.setupRadii(width, height);
    for (let i = 0; i < this._randomNoiseData.length; ++i) {
      this._randomNoiseData[i] = ((i * 1103515245 + 12345) >>> 16) & 3;
    }
    this.setZoom(this._zoom);
    this.cachePolygons();
  }

  override draw(): void {
    if (this._redraw) {
      this.cachePolygons();
    }
    super.draw();
    this.drawOcean();
    this.drawLand();
    this.drawShadow();
    this.drawDetail();
    if (this._newBaseHover && Number.isFinite(this._hoverLon) && Number.isFinite(this._hoverLat)) {
      const p = this.polarToCart(this._hoverLon, this._hoverLat);
      this.drawLine(p.x - 4, p.y, p.x + 4, p.y, 138);
      this.drawLine(p.x, p.y - 4, p.x, p.y + 4, 138);
    }
  }

  override handle(action: Action, state: State): void {
    super.handle(action, state);
  }

  rotateStop(): void {}

  rotateStopLon(): void {}

  rotateStopLat(): void {}

  rotateLeft(): void {
    this._rotationLon -= 0.05;
    this.invalidate();
  }

  rotateRight(): void {
    this._rotationLon += 0.05;
    this.invalidate();
  }

  rotateUp(): void {
    this._rotationLat -= 0.05;
    this.invalidate();
  }

  rotateDown(): void {
    this._rotationLat += 0.05;
    this.invalidate();
  }

  zoomIn(): void {
    if (this._zoom < this._zoomRadius.length - 1) {
      this.setZoom(this._zoom + 1);
    }
  }

  zoomOut(): void {
    if (this._zoom > 0) {
      this.setZoom(this._zoom - 1);
    }
  }

  zoomMax(): void {
    this.setZoom(this._zoomRadius.length - 1);
  }

  zoomMin(): void {
    this.setZoom(0);
  }

  saveZoomDogfight(): void {
    this._zoomOld = this._zoom;
  }

  zoomDogfightIn(): boolean {
    if (this._zoom < DOGFIGHT_ZOOM) {
      const radiusNow = this._radius;
      if (radiusNow + this._radiusStep >= this._zoomRadius[DOGFIGHT_ZOOM]) {
        this.setZoom(DOGFIGHT_ZOOM);
      } else {
        if (radiusNow + this._radiusStep >= this._zoomRadius[this._zoom + 1]) {
          this._zoom++;
        }
        this.setZoom(this._zoom);
        this._radius = radiusNow + this._radiusStep;
        this.cachePolygons();
        this.invalidate();
      }
      return false;
    }
    return true;
  }

  zoomDogfightOut(): boolean {
    if (this._zoom > this._zoomOld) {
      const radiusNow = this._radius;
      if (radiusNow - this._radiusStep <= this._zoomRadius[this._zoomOld]) {
        this.setZoom(this._zoomOld);
      } else {
        if (radiusNow - this._radiusStep <= this._zoomRadius[this._zoom - 1]) {
          this._zoom--;
        }
        this.setZoom(this._zoom);
        this._radius = radiusNow - this._radiusStep;
        this.cachePolygons();
        this.invalidate();
      }
      return false;
    }
    return true;
  }

  getZoom(): number {
    return this._zoom;
  }

  setZoom(zoom: number): void {
    const maxZoom = Math.max(0, this._zoomRadius.length - 1);
    this._zoom = Math.max(0, Math.min(maxZoom, Math.trunc(zoom)));
    const totalFrames = this._texture?.getTotalFrames() || 0;
    this._zoomTexture = totalFrames > 0 ? (2 - Math.floor(this._zoom / 2.0)) * Math.trunc(totalFrames / 3) : 0;
    this._radius = this._zoomRadius[this._zoom] || 0;
    this._game.getSavedGame()?.setGlobeZoom(this._zoom);
    this.invalidate();
  }

  center(lon: number, lat: number): void {
    this._rotationLon = lon;
    this._rotationLat = lat;
    const save = this._game.getSavedGame();
    save?.setGlobeLongitude(lon);
    save?.setGlobeLatitude(lat);
    this.invalidate();
  }

  cartToPolar(mouseX: number, mouseY: number): { lon: number; lat: number } {
    const x = mouseX - this.getX() - this._centerX;
    const y = mouseY - this.getY() - this._centerY;
    const r = this.radius();
    const rho = Math.sqrt(x * x + y * y);
    if (rho > r || r <= 0) {
      return { lon: Number.NaN, lat: Number.NaN };
    }
    if (rho === 0) {
      return { lon: this.normalizeLon(this._rotationLon), lat: this._rotationLat };
    }
    const c = Math.asin(Math.min(1, rho / r));
    const sinC = Math.sin(c);
    const cosC = Math.cos(c);
    const sinCenterLat = Math.sin(this._rotationLat);
    const cosCenterLat = Math.cos(this._rotationLat);
    const lat = Math.asin((y * sinC * cosCenterLat) / rho + cosC * sinCenterLat);
    const lon = Math.atan2(
      x * sinC,
      rho * cosCenterLat * cosC - y * sinCenterLat * sinC
    ) + this._rotationLon;
    return {
      lon: this.normalizeLon(lon),
      lat
    };
  }

  insideLand(lon: number, lat: number): boolean {
    return this.getPolygonFromLonLat(lon, lat) != null;
  }

  getPolygonTextureAndShade(lon: number, lat: number): { texture: number; shade: number } {
    const worldshades = [
      0, 0, 0, 0, 1, 1, 2, 2,
      3, 3, 4, 4, 5, 5, 6, 6,
      7, 7, 8, 8, 9, 9, 10, 11,
      11, 12, 12, 13, 13, 14, 15, 15
    ];
    const polygon = this.getPolygonFromLonLat(lon, lat);
    const shadow = this.getShadowValue({ x: 0, y: 0, z: 1 }, this.getSunDirection(lon, lat), 0);
    return {
      texture: polygon?.getTexture() ?? -1,
      shade: worldshades[shadow] ?? 0
    };
  }

  getTargets(x: number, y: number, craft: boolean): GlobeTarget[] {
    const save = this._game.getSavedGame();
    const targets: GlobeTarget[] = [];
    if (!save) {
      return targets;
    }

    if (!craft) {
      for (const base of save.getBases() as Base[]) {
        if (base.getLongitude() === 0.0 && base.getLatitude() === 0.0) {
          continue;
        }
        if (this.targetNear(base, x, y)) {
          targets.push(base);
        }

        for (const baseCraft of base.getCrafts() as CraftTarget[]) {
          if (baseCraft.getLongitude() === base.getLongitude() &&
            baseCraft.getLatitude() === base.getLatitude() &&
            !baseCraft.getDestination?.()) {
            continue;
          }
          if (this.targetNear(baseCraft, x, y)) {
            targets.push(baseCraft);
          }
        }
      }
    }

    for (const ufo of save.getUfos() as Ufo[]) {
      if (!ufo.getDetected()) {
        continue;
      }
      if (this.targetNear(ufo, x, y)) {
        targets.push(ufo);
      }
    }

    for (const waypoint of save.getWaypoints()) {
      if (this.targetNear(waypoint, x, y)) {
        targets.push(waypoint);
      }
    }

    for (const missionSite of save.getMissionSites()) {
      if (this.targetNear(missionSite, x, y)) {
        targets.push(missionSite);
      }
    }

    for (const alienBase of save.getAlienBases()) {
      if (!alienBase.isDiscovered()) {
        continue;
      }
      if (this.targetNear(alienBase, x, y)) {
        targets.push(alienBase);
      }
    }

    return targets;
  }

  setCraftRange(_lon: number, _lat: number, _range: number): void {
    this.invalidate();
  }

  setNewBaseHover(hover: boolean): void {
    this._newBaseHover = hover;
    this.invalidate();
  }

  setNewBaseHoverPos(lon: number, lat: number): void {
    this._hoverLon = lon;
    this._hoverLat = lat;
    this.invalidate();
  }

  private polarToCart(lon: number, lat: number): { x: number; y: number } {
    const r = this.radius();
    const deltaLon = lon - this._rotationLon;
    return {
      x: this._centerX + Math.floor(r * Math.cos(lat) * Math.sin(deltaLon)),
      y: this._centerY + Math.floor(r * (Math.cos(this._rotationLat) * Math.sin(lat) - Math.sin(this._rotationLat) * Math.cos(lat) * Math.cos(deltaLon)))
    };
  }

  private pointBack(lon: number, lat: number): boolean {
    const c = Math.cos(this._rotationLat) * Math.cos(lat) * Math.cos(lon - this._rotationLon) + Math.sin(this._rotationLat) * Math.sin(lat);
    return c < 0.0;
  }

  private targetNear(target: GlobeTarget, x: number, y: number): boolean {
    if (this.pointBack(target.getLongitude(), target.getLatitude())) {
      return false;
    }
    const point = this.polarToCart(target.getLongitude(), target.getLatitude());
    const dx = x - point.x;
    const dy = y - point.y;
    return dx * dx + dy * dy <= NEAR_RADIUS;
  }

  private radius(): number {
    return this._radius;
  }

  private drawOcean(): void {
    this.drawCircle(this._centerX + 1, this._centerY, Math.trunc(this.radius() + 20), this._rules?.getOceanColor() ?? 192);
  }

  private drawLand(): void {
    for (const polygon of this._cacheLand) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < polygon.getPoints(); ++i) {
        xs.push(polygon.getX(i));
        ys.push(polygon.getY(i));
      }
      if (xs.length < 3) {
        continue;
      }
      const texture = this._texture?.getFrame(polygon.getTexture() + this._zoomTexture) || null;
      if (texture) {
        this.drawTexturedPolygon(xs, ys, xs.length, texture, 0, 0);
      } else {
        this.drawPolygon(xs, ys, xs.length, this.textureColor(polygon.getTexture()));
      }
    }
  }

  private setupRadii(width: number, height: number): void {
    this._zoomRadius = [
      0.45 * height,
      0.60 * height,
      0.90 * height,
      1.40 * height,
      2.25 * height,
      3.60 * height
    ];
    this._radius = this._zoomRadius[this._zoom] || this._zoomRadius[0] || Math.min(width, height) * 0.45;
    this._radiusStep = (this._zoomRadius[DOGFIGHT_ZOOM] - this._zoomRadius[0]) / 10.0;
  }

  private cachePolygons(): void {
    this._cacheLand = [];
    for (const polygon of this._polygons) {
      let closest = 0.0;
      let furthest = 0.0;
      for (let j = 0; j < polygon.getPoints(); ++j) {
        const z = Math.cos(this._rotationLat) * Math.cos(polygon.getLatitude(j)) * Math.cos(polygon.getLongitude(j) - this._rotationLon) +
          Math.sin(this._rotationLat) * Math.sin(polygon.getLatitude(j));
        if (z > closest) {
          closest = z;
        } else if (z < furthest) {
          furthest = z;
        }
      }
      if (-furthest > closest) {
        continue;
      }

      const cached = polygon.clone();
      for (let j = 0; j < cached.getPoints(); ++j) {
        const p = this.polarToCart(cached.getLongitude(j), cached.getLatitude(j));
        cached.setX(j, p.x);
        cached.setY(j, p.y);
      }
      this._cacheLand.push(cached);
    }
  }

  private drawShadow(): void {
    const sun = this.getSunDirection(this._rotationLon, this._rotationLat);
    for (let y = 0; y < this.getHeight(); ++y) {
      for (let x = 0; x < this.getWidth(); ++x) {
        const dest = this.getPixel(x, y);
        const earth = this.circleNorm(this._centerX, this._centerY, this.radius(), x + 0.5, y + 0.5);
        const noise = this._randomNoiseData[positiveModulo(y, RANDOM_SURF_SIZE) * RANDOM_SURF_SIZE + positiveModulo(x, RANDOM_SURF_SIZE)];
        if (dest && earth.z) {
          const shadow = this.getShadowValue(earth, sun, noise);
          if (this.isOcean(dest)) {
            this.setPixel(x, y, this.getOceanShadow(shadow));
          } else {
            this.setPixel(x, y, this.getLandShadow(dest, shadow));
          }
        } else {
          this.setPixel(x, y, 0);
        }
      }
    }
  }

  private drawDetail(): void {
    if (!Options.globeDetail || this._zoom < 1) {
      return;
    }
    for (const polyline of this._rules?.getPolylines() || []) {
      for (let j = 0; j < polyline.getPoints() - 1; ++j) {
        if (this.pointBack(polyline.getLongitude(j), polyline.getLatitude(j)) ||
          this.pointBack(polyline.getLongitude(j + 1), polyline.getLatitude(j + 1))) {
          continue;
        }
        const start = this.polarToCart(polyline.getLongitude(j), polyline.getLatitude(j));
        const end = this.polarToCart(polyline.getLongitude(j + 1), polyline.getLatitude(j + 1));
        this.drawLine(start.x, start.y, end.x, end.y, this._rules?.getLineColor() ?? 162);
      }
    }
  }

  private circleNorm(ox: number, oy: number, r: number, x: number, y: number): { x: number; y: number; z: number } {
    const limit = r * r;
    const norm = 1.0 / r;
    const retX = x - ox;
    const retY = y - oy;
    const temp = retX * retX + retY * retY;
    if (limit > temp) {
      return {
        x: retX * norm,
        y: retY * norm,
        z: Math.sqrt(limit - temp) * norm
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  private isOcean(dest: number): boolean {
    const ocean = this._rules?.getOceanColor() ?? 192;
    return Boolean(this._rules?.getOceanShading() ?? true) && dest >= ocean && dest < ocean + 32;
  }

  private getOceanShadow(shadow: number): number {
    return (this._rules?.getOceanColor() ?? 192) + shadow;
  }

  private getLandShadow(dest: number, shadow: number): number {
    if (shadow === 0) {
      return dest;
    }
    const shaded = Math.trunc(shadow / 3);
    const candidate = dest + shaded;
    const group = dest & COLOR_GROUP;
    if (candidate > group + COLOR_SHADE) {
      return group + COLOR_SHADE;
    }
    return candidate;
  }

  private textureColor(texture: number): number {
    return this._rules?.getTextureColor(texture) || 21;
  }

  private getPolygonFromLonLat(lon: number, lat: number): Polygon | null {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return null;
    }
    const zDiscard = 0.75;
    const normalizedLon = this.normalizeLon(lon);
    const coslat = Math.cos(lat);
    const sinlat = Math.sin(lat);

    for (const polygon of this._polygons) {
      let z = 0;
      for (let j = 0; j < polygon.getPoints(); ++j) {
        z = coslat * Math.cos(polygon.getLatitude(j)) * Math.cos(polygon.getLongitude(j) - normalizedLon) + sinlat * Math.sin(polygon.getLatitude(j));
        if (z < zDiscard) {
          break;
        }
      }
      if (z < zDiscard) {
        continue;
      }

      let odd = false;
      let clat = polygon.getLatitude(0);
      let clon = polygon.getLongitude(0);
      let x = Math.cos(clat) * Math.sin(clon - normalizedLon);
      let y = coslat * Math.sin(clat) - sinlat * Math.cos(clat) * Math.cos(clon - normalizedLon);

      for (let j = 0; j < polygon.getPoints(); ++j) {
        const k = (j + 1) % polygon.getPoints();
        clat = polygon.getLatitude(k);
        clon = polygon.getLongitude(k);

        const x2 = Math.cos(clat) * Math.sin(clon - normalizedLon);
        const y2 = coslat * Math.sin(clat) - sinlat * Math.cos(clat) * Math.cos(clon - normalizedLon);
        if (((y > 0) !== (y2 > 0)) && 0 < (x2 - x) * (0 - y) / (y2 - y) + x) {
          odd = !odd;
        }
        x = x2;
        y = y2;
      }
      if (odd) {
        return polygon;
      }
    }
    return null;
  }

  private normalizeLon(lon: number): number {
    const tau = Math.PI * 2;
    return ((lon % tau) + tau) % tau;
  }

  private getSunDirection(lon: number, lat: number): { x: number; y: number; z: number } {
    const time = this._game.getSavedGame()?.getTime();
    const curTime = time?.getDaylight() ?? 0;
    const rot = curTime * 2 * Math.PI;
    let sun = 0;
    if (Options.globeSeasons && time) {
      const monthDays1 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
      const monthDays2 = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
      const year = time.getYear();
      const month = time.getMonth() - 1;
      const day = time.getDay() - 1;
      const tm = (((time.getHour() * 60) + time.getMinute()) * 60 + time.getSecond()) / 86400;
      const leap = year % 4 === 0 && !(year % 100 === 0 && year % 400 !== 0);
      let curDay = ((leap ? monthDays2[month] : monthDays1[month]) + day + tm) / (leap ? 366 : 365) - 0.219;
      if (curDay < 0) {
        curDay += 1.0;
      }
      sun = -0.261 * Math.sin(curDay * 2 * Math.PI);
    }

    const scale = sun > 0 ? 1.0 - sun : 1.0 + sun;
    const direction = {
      x: Math.cos(rot + lon) * scale,
      y: Math.sin(rot + lon) * -Math.sin(lat) * scale + Math.cos(lat) * sun,
      z: Math.sin(rot + lon) * Math.cos(lat) * scale + Math.sin(lat) * sun
    };
    const norm = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (norm <= 0) {
      return { x: 0, y: 0, z: 1 };
    }
    return {
      x: direction.x / norm,
      y: direction.y / norm,
      z: direction.z / norm
    };
  }

  private getShadowValue(earth: { x: number; y: number; z: number }, sun: { x: number; y: number; z: number }, noise: number): number {
    let value = (earth.x - sun.x) * (earth.x - sun.x) +
      (earth.y - sun.y) * (earth.y - sun.y) +
      (earth.z - sun.z) * (earth.z - sun.z);
    value -= 2.0;
    value *= 125.0;
    if (value < -110) {
      value = -31;
    } else if (value > 120) {
      value = 50;
    } else {
      value = this.shadeGradient(Math.trunc(value) + 120);
    }
    value -= noise;
    return Math.max(0, Math.min(31, Math.trunc(value)));
  }

  private shadeGradient(index: number): number {
    let j = index - 120;
    if (j < -66) j = -16;
    else if (j < -48) j = -15;
    else if (j < -33) j = -14;
    else if (j < -22) j = -13;
    else if (j < -15) j = -12;
    else if (j < -11) j = -11;
    else if (j < -9) j = -10;

    if (j > 120) j = 19;
    else if (j > 98) j = 18;
    else if (j > 86) j = 17;
    else if (j > 74) j = 16;
    else if (j > 54) j = 15;
    else if (j > 38) j = 14;
    else if (j > 26) j = 13;
    else if (j > 18) j = 12;
    else if (j > 13) j = 11;
    else if (j > 10) j = 10;
    else if (j > 8) j = 9;
    return j + 16;
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
