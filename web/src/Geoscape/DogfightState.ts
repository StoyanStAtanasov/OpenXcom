import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { CraftWeapon } from "../Savegame/CraftWeapon.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";
import type { GeoscapeState } from "./GeoscapeState.ts";

export const STANDOFF_DIST = 560;

enum ColorNames {
  CRAFT_MIN,
  CRAFT_MAX,
  RADAR_MIN,
  RADAR_MAX,
  DAMAGE_MIN,
  DAMAGE_MAX,
  BLOB_MIN,
  RANGE_METER,
  DISABLED_WEAPON,
  DISABLED_AMMO,
  DISABLED_RANGE
}

enum CraftWeaponProjectileType {
  CWPT_STINGRAY_MISSILE,
  CWPT_AVALANCHE_MISSILE,
  CWPT_CANNON_ROUND,
  CWPT_FUSION_BALL,
  CWPT_LASER_BEAM,
  CWPT_PLASMA_BEAM
}

enum CraftWeaponProjectileGlobalType {
  CWPGT_MISSILE,
  CWPGT_BEAM
}

enum Directions {
  D_NONE,
  D_UP,
  D_DOWN
}

const HP_LEFT = -1;
const HP_CENTER = 0;
const HP_RIGHT = 1;
const CRAFT_DESTINATION_BOUNDARY = "__openxcomCraftDestinationBoundary";
const CRAFT_DOGFIGHT_BOUNDARY = "__openxcomCraftInDogfightBoundary";
const CRAFT_INTERCEPTION_ORDER_BOUNDARY = "__openxcomCraftInterceptionOrderBoundary";

type CraftDogfightBoundary = Craft & {
  getDestination?: () => unknown;
  setDestination?: (target: unknown) => void;
  returnToBase?: () => void;
  getLowFuel?: () => boolean;
  isDestroyed?: () => boolean;
  isInDogfight?: () => boolean;
  setInDogfight?: (inDogfight: boolean) => void;
  getInterceptionOrder?: () => number;
  setInterceptionOrder?: (order: number) => void;
  getUniqueId?: () => string | number;
  [CRAFT_DESTINATION_BOUNDARY]?: unknown;
  [CRAFT_DOGFIGHT_BOUNDARY]?: boolean;
  [CRAFT_INTERCEPTION_ORDER_BOUNDARY]?: number;
};

type UfoDogfightBoundary = Ufo & {
  getCraftFollowers?: () => Craft[];
};

type GeoscapeDogfightBoundary = GeoscapeState & {
  popup?: (state: State) => void;
};

type AlienMissionBoundary = {
  ufoShotDown?: (ufo: Ufo) => void;
  getRules?: () => { getRetaliationOdds?: () => number };
  getRegion?: () => string;
};

class ImageButton extends InteractiveSurface {
  private _group: { value: ImageButton | null } | null = null;
  private _color = 0;

  setGroup(group: { value: ImageButton | null } | null): void {
    this._group = group;
    if (group && group.value === null) {
      group.value = this;
    }
    this.invalidate();
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override mousePress(action: Action, state: State): void {
    if (this._group) {
      const old = this._group.value;
      this._group.value = this;
      old?.draw();
      this.draw();
    }
    super.mousePress(action, state);
  }

  override draw(): void {
    super.draw();
    if (this._group?.value === this || this.isButtonPressed()) {
      this.invert(this._color + 3);
    }
  }
}

class CraftWeaponProjectile {
  private _type = CraftWeaponProjectileType.CWPT_CANNON_ROUND;
  private _globalType = CraftWeaponProjectileGlobalType.CWPGT_MISSILE;
  private _speed = 0;
  private _direction = Directions.D_NONE;
  private _currentPosition = 0;
  private _horizontalPosition = 0;
  private _state = 0;
  private _accuracy = 0;
  private _damage = 0;
  private _range = 0;
  private _toBeRemoved = false;
  private _missed = false;
  private _distanceCovered = 0;

  setType(type: CraftWeaponProjectileType): void {
    this._type = type;
    if (type >= CraftWeaponProjectileType.CWPT_LASER_BEAM) {
      this._globalType = CraftWeaponProjectileGlobalType.CWPGT_BEAM;
      this._state = 8;
    }
  }

  getType(): CraftWeaponProjectileType {
    return this._type;
  }

  getGlobalType(): CraftWeaponProjectileGlobalType {
    return this._globalType;
  }

  setDirection(direction: Directions): void {
    this._direction = direction;
    if (this._direction === Directions.D_UP) {
      this._currentPosition = 0;
    }
  }

  getDirection(): Directions {
    return this._direction;
  }

  move(): void {
    if (this._globalType === CraftWeaponProjectileGlobalType.CWPGT_MISSILE) {
      let positionChange = this._speed;
      if (Math.trunc(this._distanceCovered / 8) < this.getRange() && Math.trunc((this._distanceCovered + this._speed) / 8) >= this.getRange()) {
        positionChange = this.getRange() * 8 - this._distanceCovered;
      }
      if (Math.trunc(this._distanceCovered / 8) >= this.getRange()) {
        this.setMissed(true);
      }
      if (this._direction === Directions.D_UP) {
        this._currentPosition += positionChange;
      } else if (this._direction === Directions.D_DOWN) {
        this._currentPosition -= positionChange;
      }
      this._distanceCovered += positionChange;
    } else if (this._globalType === CraftWeaponProjectileGlobalType.CWPGT_BEAM) {
      this._state = Math.trunc(this._state / 2);
      if (this._state === 1) {
        this._toBeRemoved = true;
      }
    }
  }

  setPosition(position: number): void {
    this._currentPosition = position;
  }

  getPosition(): number {
    return this._currentPosition;
  }

  setHorizontalPosition(position: number): void {
    this._horizontalPosition = position;
  }

  getHorizontalPosition(): number {
    return this._horizontalPosition;
  }

  remove(): void {
    this._toBeRemoved = true;
  }

  toBeRemoved(): boolean {
    return this._toBeRemoved;
  }

  getState(): number {
    return this._state;
  }

  setDamage(damage: number): void {
    this._damage = damage;
  }

  getDamage(): number {
    return this._damage;
  }

  setAccuracy(accuracy: number): void {
    this._accuracy = accuracy;
  }

  getAccuracy(): number {
    return this._accuracy;
  }

  setMissed(missed: boolean): void {
    this._missed = missed;
  }

  getMissed(): boolean {
    return this._missed;
  }

  setRange(range: number): void {
    this._range = range;
  }

  getRange(): number {
    return this._range;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }
}

function getCraftBoundary(craft: Craft): CraftDogfightBoundary {
  return craft as CraftDogfightBoundary;
}

function getCraftDestination(craft: Craft): unknown {
  const boundary = getCraftBoundary(craft);
  return boundary.getDestination?.() || boundary[CRAFT_DESTINATION_BOUNDARY] || null;
}

function setCraftDestination(craft: Craft, target: unknown): void {
  const boundary = getCraftBoundary(craft);
  if (boundary.setDestination) {
    boundary.setDestination(target);
  } else {
    boundary[CRAFT_DESTINATION_BOUNDARY] = target;
  }
}

function returnCraftToBase(craft: Craft): void {
  const boundary = getCraftBoundary(craft);
  if (boundary.returnToBase) {
    boundary.returnToBase();
  } else {
    setCraftDestination(craft, craft.getBase());
  }
}

function craftLowFuel(craft: Craft): boolean {
  return getCraftBoundary(craft).getLowFuel?.() || false;
}

function craftDestroyed(craft: Craft): boolean {
  return getCraftBoundary(craft).isDestroyed?.() ?? craft.getDamagePercentage() >= 100;
}

function setCraftInDogfight(craft: Craft, inDogfight: boolean): void {
  const boundary = getCraftBoundary(craft);
  if (boundary.setInDogfight) {
    boundary.setInDogfight(inDogfight);
  } else {
    boundary[CRAFT_DOGFIGHT_BOUNDARY] = inDogfight;
  }
}

function craftInDogfight(craft: Craft): boolean {
  const boundary = getCraftBoundary(craft);
  return boundary.isInDogfight?.() ?? boundary[CRAFT_DOGFIGHT_BOUNDARY] ?? true;
}

function getInterceptionOrder(craft: Craft): number {
  const boundary = getCraftBoundary(craft);
  return boundary.getInterceptionOrder?.() ?? boundary[CRAFT_INTERCEPTION_ORDER_BOUNDARY] ?? 0;
}

function setInterceptionOrder(craft: Craft, order: number): void {
  const boundary = getCraftBoundary(craft);
  if (boundary.setInterceptionOrder) {
    boundary.setInterceptionOrder(order);
  } else {
    boundary[CRAFT_INTERCEPTION_ORDER_BOUNDARY] = order;
  }
}

function getCraftUniqueId(craft: Craft): string | number {
  const id = getCraftBoundary(craft).getUniqueId?.();
  return Array.isArray(id) ? `${id[0]}:${id[1]}` : id ?? `${craft.getType()}:${craft.getId()}`;
}

function difficultyCoefficient(save: unknown): number {
  const boundary = save as { getDifficultyCoefficient?: () => number; getDifficulty?: () => number } | null;
  return boundary?.getDifficultyCoefficient?.() ?? boundary?.getDifficulty?.() ?? 0;
}

function isWaterOnlyCraft(craft: Craft): boolean {
  const rules = craft.getRules() as { isWaterOnly?: () => boolean; getMaxAltitude?: () => number };
  return rules.isWaterOnly?.() ?? (rules.getMaxAltitude?.() ?? -1) > -1;
}

function playGeoscapeSound(_id: number): void {
  // Browser Mod sound playback is not translated yet.
}

function projectileFromWeapon(weapon: CraftWeapon): CraftWeaponProjectile {
  const projectile = new CraftWeaponProjectile();
  projectile.setType(weapon.getRules().getProjectileType() as CraftWeaponProjectileType);
  projectile.setSpeed(weapon.getRules().getProjectileSpeed());
  projectile.setAccuracy(weapon.getRules().getAccuracy());
  projectile.setDamage(weapon.getRules().getDamage());
  projectile.setRange(weapon.getRules().getRange());
  return projectile;
}

/**
 * Shows a dogfight (interception) between a player craft and an UFO.
 */
export class DogfightState extends State {
  private static readonly _projectileBlobs = [
    [[0, 1, 0], [1, 9, 1], [1, 4, 1], [0, 3, 0], [0, 2, 0], [0, 1, 0]],
    [[1, 2, 1], [2, 9, 2], [2, 5, 2], [1, 3, 1], [0, 2, 0], [0, 1, 0]],
    [[0, 0, 0], [0, 7, 0], [0, 2, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0]],
    [[2, 4, 2], [4, 9, 4], [2, 4, 2], [0, 0, 0], [0, 0, 0], [0, 0, 0]]
  ];

  private _craftDamageAnimTimer: Timer;
  private _window: Surface;
  private _battle: Surface;
  private _range1: Surface;
  private _range2: Surface;
  private _damage: Surface;
  private _btnMinimize: InteractiveSurface;
  private _preview: InteractiveSurface;
  private _weapon1: InteractiveSurface;
  private _weapon2: InteractiveSurface;
  private _btnStandoff: ImageButton;
  private _btnCautious: ImageButton;
  private _btnStandard: ImageButton;
  private _btnAggressive: ImageButton;
  private _btnDisengage: ImageButton;
  private _btnUfo: ImageButton;
  private _mode: { value: ImageButton | null };
  private _btnMinimizedIcon: InteractiveSurface;
  private _txtAmmo1: Text;
  private _txtAmmo2: Text;
  private _txtDistance: Text;
  private _txtStatus: Text;
  private _txtInterceptionNumber: Text;
  private _timeout = 50;
  private _currentDist = 640;
  private _targetDist = STANDOFF_DIST;
  private _w1FireInterval = 0;
  private _w2FireInterval = 0;
  private _w1FireCountdown = 0;
  private _w2FireCountdown = 0;
  private _end = false;
  private _destroyUfo = false;
  private _destroyCraft = false;
  private _ufoBreakingOff = false;
  private _weapon1Enabled = true;
  private _weapon2Enabled = true;
  private _minimized = false;
  private _endDogfight = false;
  private _animatingHit = false;
  private _waitForPoly = false;
  private _waitForAltitude = false;
  private _projectiles: CraftWeaponProjectile[] = [];
  private _ufoSize = 0;
  private _craftHeight = 0;
  private _currentCraftDamageColor = 0;
  private _interceptionNumber = 0;
  private _interceptionsCount = 0;
  private _x = 0;
  private _y = 0;
  private _minimizedIconX = 0;
  private _minimizedIconY = 0;
  private _colors = Array.from({ length: 11 }, () => 0);

  constructor(private _state: GeoscapeState, private _craft: Craft, private _ufo: Ufo) {
    super();
    this._screen = false;
    setCraftInDogfight(this._craft, true);
    if (getCraftDestination(this._craft) === null) {
      setCraftDestination(this._craft, this._ufo);
    }

    this._window = new Surface(160, 96, this._x, this._y);
    this._battle = new Surface(77, 74, this._x + 3, this._y + 3);
    this._weapon1 = new InteractiveSurface(15, 17, this._x + 4, this._y + 52);
    this._range1 = new Surface(21, 74, this._x + 19, this._y + 3);
    this._weapon2 = new InteractiveSurface(15, 17, this._x + 64, this._y + 52);
    this._range2 = new Surface(21, 74, this._x + 43, this._y + 3);
    this._damage = new Surface(22, 25, this._x + 93, this._y + 40);
    this._btnMinimize = new InteractiveSurface(12, 12, this._x, this._y);
    this._preview = new InteractiveSurface(160, 96, this._x, this._y);
    this._btnStandoff = new ImageButton(36, 15, this._x + 83, this._y + 4);
    this._btnCautious = new ImageButton(36, 15, this._x + 120, this._y + 4);
    this._btnStandard = new ImageButton(36, 15, this._x + 83, this._y + 20);
    this._btnAggressive = new ImageButton(36, 15, this._x + 120, this._y + 20);
    this._btnDisengage = new ImageButton(36, 15, this._x + 120, this._y + 36);
    this._btnUfo = new ImageButton(36, 17, this._x + 120, this._y + 52);
    this._txtAmmo1 = new Text(16, 9, this._x + 4, this._y + 70);
    this._txtAmmo2 = new Text(16, 9, this._x + 64, this._y + 70);
    this._txtDistance = new Text(40, 9, this._x + 116, this._y + 72);
    this._txtStatus = new Text(150, 9, this._x + 4, this._y + 85);
    this._btnMinimizedIcon = new InteractiveSurface(32, 20, this._minimizedIconX, this._minimizedIconY);
    this._txtInterceptionNumber = new Text(16, 9, this._minimizedIconX + 18, this._minimizedIconY + 6);
    this._mode = { value: this._btnStandoff };
    this._craftDamageAnimTimer = new Timer(500);

    this.setInterface("dogfight");

    this.add(this._window);
    this.add(this._battle);
    this.add(this._weapon1);
    this.add(this._range1);
    this.add(this._weapon2);
    this.add(this._range2);
    this.add(this._damage);
    this.add(this._btnMinimize);
    this.add(this._btnStandoff, "standoffButton", "dogfight", this._window);
    this.add(this._btnCautious, "cautiousButton", "dogfight", this._window);
    this.add(this._btnStandard, "standardButton", "dogfight", this._window);
    this.add(this._btnAggressive, "aggressiveButton", "dogfight", this._window);
    this.add(this._btnDisengage, "disengageButton", "dogfight", this._window);
    this.add(this._btnUfo, "ufoButton", "dogfight", this._window);
    this.add(this._txtAmmo1, "numbers", "dogfight", this._window);
    this.add(this._txtAmmo2, "numbers", "dogfight", this._window);
    this.add(this._txtDistance, "distance", "dogfight", this._window);
    this.add(this._preview);
    this.add(this._txtStatus, "text", "dogfight", this._window);
    this.add(this._btnMinimizedIcon);
    this.add(this._txtInterceptionNumber, "minimizedNumber", "dogfight");

    for (const button of [this._btnStandoff, this._btnCautious, this._btnStandard, this._btnAggressive, this._btnDisengage, this._btnUfo]) {
      button.invalidate(false);
    }

    this.setupGraphics();
    this.setupButtonsAndText();
    this.setupInterceptionNumber();
    this.setupColors();
    this.setupWeapons();
    this.setupDamageIndicator();
    this.setupInitialCounters();
  }

  override think(): void {
    if (!this._endDogfight) {
      this.update();
      this._craftDamageAnimTimer.think(this, null);
    }
    if (!craftInDogfight(this._craft) || getCraftDestination(this._craft) !== this._ufo || this._ufo.getStatus() === UfoStatus.LANDED) {
      this.endDogfight();
    }
  }

  animateCraftDamage(): void {
    if (this._minimized) {
      return;
    }
    --this._currentCraftDamageColor;
    if (this._currentCraftDamageColor < this._colors[ColorNames.DAMAGE_MIN]) {
      this._currentCraftDamageColor = this._colors[ColorNames.DAMAGE_MAX];
    }
    this.drawCraftDamage();
  }

  drawCraftDamage(): void {
    if (this._craft.getDamagePercentage() === 0) {
      return;
    }
    if (!this._craftDamageAnimTimer.isRunning()) {
      this._craftDamageAnimTimer.start();
      if (this._currentCraftDamageColor < this._colors[ColorNames.DAMAGE_MIN]) {
        this._currentCraftDamageColor = this._colors[ColorNames.DAMAGE_MIN];
      }
    }
    const damagePercentage = this._craft.getDamagePercentage();
    const rowsToColor = Math.floor(this._craftHeight * (damagePercentage / 100.0));
    if (rowsToColor === 0) {
      return;
    }
    let rowsColored = 0;
    for (let y = 0; y < this._damage.getHeight(); ++y) {
      let rowColored = false;
      for (let x = 0; x < this._damage.getWidth(); ++x) {
        const pixelColor = this._damage.getPixel(x, y);
        if (pixelColor >= this._colors[ColorNames.DAMAGE_MIN] && pixelColor <= this._colors[ColorNames.DAMAGE_MAX]) {
          this._damage.setPixel(x, y, this._currentCraftDamageColor);
          rowColored = true;
        }
        if (pixelColor >= this._colors[ColorNames.CRAFT_MIN] && pixelColor < this._colors[ColorNames.CRAFT_MAX]) {
          this._damage.setPixel(x, y, this._currentCraftDamageColor);
          rowColored = true;
        }
      }
      if (rowColored) {
        ++rowsColored;
      }
      if (rowsColored === rowsToColor) {
        break;
      }
    }
  }

  animate(): void {
    for (let x = 0; x < this._window.getWidth(); ++x) {
      for (let y = 0; y < this._window.getHeight(); ++y) {
        let radarPixelColor = this._window.getPixel(x, y);
        if (radarPixelColor >= this._colors[ColorNames.RADAR_MIN] && radarPixelColor < this._colors[ColorNames.RADAR_MAX]) {
          ++radarPixelColor;
          if (radarPixelColor >= this._colors[ColorNames.RADAR_MAX]) {
            radarPixelColor = this._colors[ColorNames.RADAR_MIN];
          }
          this._window.setPixel(x, y, radarPixelColor);
        }
      }
    }

    this._battle.clear();
    if (!this._ufo.isDestroyed()) {
      this.drawUfo();
    }
    for (const projectile of this._projectiles) {
      this.drawProjectile(projectile);
    }

    if (this._timeout === 0) {
      this._txtStatus.setText("");
    } else {
      --this._timeout;
    }

    let lastHitAnimFrame = false;
    if (this._animatingHit && this._ufo.getHitFrame() > 0) {
      this._ufo.setHitFrame(this._ufo.getHitFrame() - 1);
      if (this._ufo.getHitFrame() === 0) {
        this._animatingHit = false;
        lastHitAnimFrame = true;
      }
    }

    if (this._ufo.isCrashed() && this._ufo.getHitFrame() === 0 && !lastHitAnimFrame) {
      --this._ufoSize;
    }
  }

  update(): void {
    let finalRun = false;
    if (getCraftDestination(this._craft) !== this._ufo || !craftInDogfight(this._craft) || craftLowFuel(this._craft) || (this._minimized && this._ufo.isCrashed())) {
      this.endDogfight();
      return;
    }

    if (!this._minimized) {
      this.animate();
      if (!this._ufo.isCrashed() && !this._ufo.isDestroyed() && !craftDestroyed(this._craft) && !this._ufo.getInterceptionProcessed()) {
        this._ufo.setInterceptionProcessed(true);
        let escapeCounter = this._ufo.getEscapeCountdown();
        if (escapeCounter > 0) {
          escapeCounter--;
          this._ufo.setEscapeCountdown(escapeCounter);
          if (escapeCounter === 0) {
            this._ufo.setSpeed(this._ufo.getRules().getMaxSpeed());
          }
        }
        if (this._ufo.getFireCountdown() > 0) {
          this._ufo.setFireCountdown(this._ufo.getFireCountdown() - 1);
        }
      }
    }

    if (this._ufo.getSpeed() > this._craft.getRules().getMaxSpeed()) {
      this._ufoBreakingOff = true;
      finalRun = true;
      this.setStatus("STR_UFO_OUTRUNNING_INTERCEPTOR");
    } else {
      this._ufoBreakingOff = false;
    }

    let projectileInFlight = false;
    if (!this._minimized) {
      projectileInFlight = this.updateDistanceAndProjectiles();
      this.handleWeaponFire(projectileInFlight);
      projectileInFlight = projectileInFlight || this._projectiles.length > 0;
      this.handleUfoFire();
    }

    if (this._end && (((this._currentDist > 640 || this._minimized) && (this._mode.value === this._btnDisengage || this._ufoBreakingOff)) || (this._timeout === 0 && (this._ufo.isCrashed() || craftDestroyed(this._craft))))) {
      if (this._ufoBreakingOff) {
        this._ufo.move();
        setCraftDestination(this._craft, this._ufo);
      }
      if (!this._destroyCraft && (this._destroyUfo || this._mode.value === this._btnDisengage)) {
        returnCraftToBase(this._craft);
      }
      if (this._ufo.isCrashed()) {
        for (const follower of (this._ufo as UfoDogfightBoundary).getCraftFollowers?.() || []) {
          if (follower.getNumSoldiers() === 0 && follower.getNumVehicles() === 0) {
            returnCraftToBase(follower);
          }
        }
      }
      this.endDogfight();
    }

    if (this._currentDist > 640 && this._ufoBreakingOff) {
      finalRun = true;
    }

    if (!this._end) {
      finalRun = this.handleDestruction(finalRun);
    }

    if (!projectileInFlight && finalRun) {
      this._end = true;
    }
  }

  fireWeapon1(): void {
    const w1 = this._craft.getWeapons()[0];
    if (!w1) {
      return;
    }
    if (w1.setAmmo(w1.getAmmo() - 1)) {
      this._w1FireCountdown = this._w1FireInterval;
      this._txtAmmo1.setText(String(w1.getAmmo()));
      const projectile = projectileFromWeapon(w1);
      projectile.setDirection(Directions.D_UP);
      projectile.setHorizontalPosition(HP_LEFT);
      this._projectiles.push(projectile);
      playGeoscapeSound(w1.getRules().getSound());
    }
  }

  fireWeapon2(): void {
    const w2 = this._craft.getWeapons()[1];
    if (!w2) {
      return;
    }
    if (w2.setAmmo(w2.getAmmo() - 1)) {
      this._w2FireCountdown = this._w2FireInterval;
      this._txtAmmo2.setText(String(w2.getAmmo()));
      const projectile = projectileFromWeapon(w2);
      projectile.setDirection(Directions.D_UP);
      projectile.setHorizontalPosition(HP_RIGHT);
      this._projectiles.push(projectile);
      playGeoscapeSound(w2.getRules().getSound());
    }
  }

  ufoFireWeapon(): void {
    const fireCountdown = Math.max(1, this._ufo.getRules().getWeaponReload() - 2 * difficultyCoefficient(this.game().getSavedGame()));
    this._ufo.setFireCountdown(RNG.generate(0, fireCountdown) + fireCountdown);
    this.setStatus("STR_UFO_RETURN_FIRE");
    const projectile = new CraftWeaponProjectile();
    projectile.setType(CraftWeaponProjectileType.CWPT_PLASMA_BEAM);
    projectile.setAccuracy(60);
    projectile.setDamage(this._ufo.getRules().getWeaponPower());
    projectile.setDirection(Directions.D_DOWN);
    projectile.setHorizontalPosition(HP_CENTER);
    projectile.setPosition(this._currentDist - Math.trunc(this._ufo.getRules().getRadius() / 2));
    this._projectiles.push(projectile);
    playGeoscapeSound(0);
  }

  minimumDistance(): void {
    let max = 0;
    for (const weapon of this._craft.getWeapons()) {
      if (!weapon) {
        continue;
      }
      if (weapon.getRules().getRange() > max && weapon.getAmmo() > 0) {
        max = weapon.getRules().getRange();
      }
    }
    this._targetDist = max === 0 ? STANDOFF_DIST : max * 8;
  }

  maximumDistance(): void {
    let min = 1000;
    for (const weapon of this._craft.getWeapons()) {
      if (!weapon) {
        continue;
      }
      if (weapon.getRules().getRange() < min && weapon.getAmmo() > 0) {
        min = weapon.getRules().getRange();
      }
    }
    this._targetDist = min === 1000 ? STANDOFF_DIST : min * 8;
  }

  setStatus(status: string): void {
    this._txtStatus.setText(String(this.tr(status)));
    this._timeout = 50;
  }

  btnMinimizeClick(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      if (this._currentDist >= STANDOFF_DIST) {
        this.setMinimized(true);
      } else {
        this.setStatus("STR_MINIMISE_AT_STANDOFF_RANGE_ONLY");
      }
    }
  }

  btnStandoffPress(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      this._end = false;
      this.setStatus("STR_STANDOFF");
      this._targetDist = STANDOFF_DIST;
    }
  }

  btnCautiousPress(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      this._end = false;
      this.setStatus("STR_CAUTIOUS_ATTACK");
      const w1 = this._craft.getWeapons()[0];
      const w2 = this._craft.getWeapons()[1];
      if (this._craft.getRules().getWeapons() > 0 && w1) {
        this._w1FireInterval = w1.getRules().getCautiousReload();
      }
      if (this._craft.getRules().getWeapons() > 1 && w2) {
        this._w2FireInterval = w2.getRules().getCautiousReload();
      }
      this.minimumDistance();
    }
  }

  btnStandardPress(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      this._end = false;
      this.setStatus("STR_STANDARD_ATTACK");
      const w1 = this._craft.getWeapons()[0];
      const w2 = this._craft.getWeapons()[1];
      if (this._craft.getRules().getWeapons() > 0 && w1) {
        this._w1FireInterval = w1.getRules().getStandardReload();
      }
      if (this._craft.getRules().getWeapons() > 1 && w2) {
        this._w2FireInterval = w2.getRules().getStandardReload();
      }
      this.maximumDistance();
    }
  }

  btnAggressivePress(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      this._end = false;
      this.setStatus("STR_AGGRESSIVE_ATTACK");
      const w1 = this._craft.getWeapons()[0];
      const w2 = this._craft.getWeapons()[1];
      if (this._craft.getRules().getWeapons() > 0 && w1) {
        this._w1FireInterval = w1.getRules().getAggressiveReload();
      }
      if (this._craft.getRules().getWeapons() > 1 && w2) {
        this._w2FireInterval = w2.getRules().getAggressiveReload();
      }
      this._targetDist = 64;
    }
  }

  btnDisengagePress(_action?: Action): void {
    if (!this._ufo.isCrashed() && !craftDestroyed(this._craft) && !this._ufoBreakingOff) {
      this._end = true;
      this.setStatus("STR_DISENGAGING");
      this._targetDist = 800;
    }
  }

  btnUfoClick(_action?: Action): void {
    this._preview.setVisible(true);
    this._btnStandoff.setVisible(false);
    this._btnCautious.setVisible(false);
    this._btnStandard.setVisible(false);
    this._btnAggressive.setVisible(false);
    this._btnDisengage.setVisible(false);
    this._btnUfo.setVisible(false);
    this._btnMinimize.setVisible(false);
    this._weapon1.setVisible(false);
    this._weapon2.setVisible(false);
  }

  previewClick(_action?: Action): void {
    this._preview.setVisible(false);
    this._btnStandoff.setVisible(true);
    this._btnCautious.setVisible(true);
    this._btnStandard.setVisible(true);
    this._btnAggressive.setVisible(true);
    this._btnDisengage.setVisible(true);
    this._btnUfo.setVisible(true);
    this._btnMinimize.setVisible(true);
    this._weapon1.setVisible(true);
    this._weapon2.setVisible(true);
  }

  drawUfo(): void {
    if (this._ufoSize < 0 || this._ufo.isDestroyed()) {
      return;
    }
    const currentUfoXposition = Math.trunc(this._battle.getWidth() / 2) - 6;
    const currentUfoYposition = this._battle.getHeight() - Math.trunc(this._currentDist / 8) - 6;
    for (let y = 0; y < 13; ++y) {
      for (let x = 0; x < 13; ++x) {
        let pixelOffset = this.ufoBlobPixel(this._ufoSize + this._ufo.getHitFrame(), x, y);
        if (pixelOffset === 0) {
          continue;
        }
        if (this._ufo.isCrashed() || this._ufo.getHitFrame() > 0) {
          pixelOffset *= 2;
        }
        const radarPixelColor = this._window.getPixel(currentUfoXposition + x + 3, currentUfoYposition + y + 3);
        const color = Math.max(this._colors[ColorNames.BLOB_MIN], radarPixelColor - pixelOffset);
        this._battle.setPixel(currentUfoXposition + x, currentUfoYposition + y, color);
      }
    }
  }

  drawProjectile(projectile: CraftWeaponProjectile): void {
    let xPos = Math.trunc(this._battle.getWidth() / 2) + projectile.getHorizontalPosition();
    if (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_MISSILE) {
      xPos -= 1;
      const yPos = this._battle.getHeight() - Math.trunc(projectile.getPosition() / 8);
      for (let x = 0; x < 3; ++x) {
        for (let y = 0; y < 6; ++y) {
          const pixelOffset = DogfightState._projectileBlobs[projectile.getType()]?.[y]?.[x] || 0;
          if (pixelOffset === 0) {
            continue;
          }
          const radarPixelColor = this._window.getPixel(xPos + x + 3, yPos + y + 3);
          const color = Math.max(this._colors[ColorNames.BLOB_MIN], radarPixelColor - pixelOffset);
          this._battle.setPixel(xPos + x, yPos + y, color);
        }
      }
    } else if (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_BEAM) {
      const yStart = this._battle.getHeight() - 2;
      const yEnd = this._battle.getHeight() - Math.trunc(this._currentDist / 8);
      const pixelOffset = projectile.getState();
      for (let y = yStart; y > yEnd; --y) {
        const radarPixelColor = this._window.getPixel(xPos + 3, y + 3);
        const color = Math.max(this._colors[ColorNames.BLOB_MIN], radarPixelColor - pixelOffset);
        this._battle.setPixel(xPos, y, color);
      }
    }
  }

  weapon1Click(_action?: Action): void {
    this._weapon1Enabled = !this._weapon1Enabled;
    this.recolor(0, this._weapon1Enabled);
  }

  weapon2Click(_action?: Action): void {
    this._weapon2Enabled = !this._weapon2Enabled;
    this.recolor(1, this._weapon2Enabled);
  }

  recolor(weaponNo: number, currentState: boolean): void {
    let weapon: InteractiveSurface | null = null;
    let ammo: Text | null = null;
    let range: Surface | null = null;
    if (weaponNo === 0) {
      weapon = this._weapon1;
      ammo = this._txtAmmo1;
      range = this._range1;
    } else if (weaponNo === 1) {
      weapon = this._weapon2;
      ammo = this._txtAmmo2;
      range = this._range2;
    } else {
      return;
    }

    if (currentState) {
      weapon.offset(-this._colors[ColorNames.DISABLED_WEAPON]);
      ammo.offset(-this._colors[ColorNames.DISABLED_AMMO]);
      range.offset(-this._colors[ColorNames.DISABLED_RANGE]);
    } else {
      weapon.offset(this._colors[ColorNames.DISABLED_WEAPON]);
      ammo.offset(this._colors[ColorNames.DISABLED_AMMO]);
      range.offset(this._colors[ColorNames.DISABLED_RANGE]);
    }
  }

  isMinimized(): boolean {
    return this._minimized;
  }

  setMinimized(minimized: boolean): void {
    this._minimized = minimized;
    this._btnMinimizedIcon.setVisible(minimized);
    this._txtInterceptionNumber.setVisible(minimized);

    this._window.setVisible(!minimized);
    this._btnStandoff.setVisible(!minimized);
    this._btnCautious.setVisible(!minimized);
    this._btnStandard.setVisible(!minimized);
    this._btnAggressive.setVisible(!minimized);
    this._btnDisengage.setVisible(!minimized);
    this._btnUfo.setVisible(!minimized);
    this._btnMinimize.setVisible(!minimized);
    this._battle.setVisible(!minimized);
    this._weapon1.setVisible(!minimized);
    this._range1.setVisible(!minimized);
    this._weapon2.setVisible(!minimized);
    this._range2.setVisible(!minimized);
    this._damage.setVisible(!minimized);
    this._txtAmmo1.setVisible(!minimized);
    this._txtAmmo2.setVisible(!minimized);
    this._txtDistance.setVisible(!minimized);
    this._txtStatus.setVisible(!minimized);
    this._preview.setVisible(false);
  }

  btnMinimizedIconClick(_action?: Action): void {
    if (isWaterOnlyCraft(this._craft) && this._ufo.getAltitudeInt() > this._craft.getRules().getMaxAltitude()) {
      this.dogfightErrorBoundary("STR_UNABLE_TO_ENGAGE_DEPTH");
      this.setWaitForAltitude(true);
    } else if (isWaterOnlyCraft(this._craft) && !this._state.getGlobe().insideLand(this._craft.getLongitude(), this._craft.getLatitude())) {
      this.dogfightErrorBoundary("STR_UNABLE_TO_ENGAGE_AIRBORNE");
      this.setWaitForPoly(true);
    } else {
      this.setMinimized(false);
    }
  }

  setInterceptionNumber(number: number): void {
    this._interceptionNumber = number;
  }

  setInterceptionsCount(count: number): void {
    this._interceptionsCount = count;
    this.calculateWindowPosition();
    this.moveWindow();
  }

  calculateWindowPosition(): void {
    this._minimizedIconX = 5;
    this._minimizedIconY = (5 * this._interceptionNumber) + (16 * (this._interceptionNumber - 1));

    if (this._interceptionsCount === 1) {
      this._x = 80;
      this._y = 52;
    } else if (this._interceptionsCount === 2) {
      if (this._interceptionNumber === 1) {
        this._x = 80;
        this._y = 0;
      } else {
        this._x = 80;
        this._y = 200 - this._window.getHeight();
      }
    } else if (this._interceptionsCount === 3) {
      if (this._interceptionNumber === 1) {
        this._x = 80;
        this._y = 0;
      } else if (this._interceptionNumber === 2) {
        this._x = 0;
        this._y = 200 - this._window.getHeight();
      } else {
        this._x = 320 - this._window.getWidth();
        this._y = 200 - this._window.getHeight();
      }
    } else {
      if (this._interceptionNumber === 1) {
        this._x = 0;
        this._y = 0;
      } else if (this._interceptionNumber === 2) {
        this._x = 320 - this._window.getWidth();
        this._y = 0;
      } else if (this._interceptionNumber === 3) {
        this._x = 0;
        this._y = 200 - this._window.getHeight();
      } else {
        this._x = 320 - this._window.getWidth();
        this._y = 200 - this._window.getHeight();
      }
    }
    this._x += this.game().getScreen().getDX();
    this._y += this.game().getScreen().getDY();
  }

  moveWindow(): void {
    const x = this._window.getX() - this._x;
    const y = this._window.getY() - this._y;
    for (const surface of this._surfaces) {
      surface.setX(surface.getX() - x);
      surface.setY(surface.getY() - y);
    }
    this._btnMinimizedIcon.setX(this._minimizedIconX);
    this._btnMinimizedIcon.setY(this._minimizedIconY);
    this._txtInterceptionNumber.setX(this._minimizedIconX + 18);
    this._txtInterceptionNumber.setY(this._minimizedIconY + 6);
  }

  dogfightEnded(): boolean {
    return this._endDogfight;
  }

  getUfo(): Ufo {
    return this._ufo;
  }

  getCraft(): Craft {
    return this._craft;
  }

  getInterceptionNumber(): number {
    return this._interceptionNumber;
  }

  setWaitForPoly(wait: boolean): void {
    this._waitForPoly = wait;
  }

  getWaitForPoly(): boolean {
    return this._waitForPoly;
  }

  setWaitForAltitude(wait: boolean): void {
    this._waitForAltitude = wait;
  }

  getWaitForAltitude(): boolean {
    return this._waitForAltitude;
  }

  private setupGraphics(): void {
    const dogfightInterface = this.game().getMod()?.getInterface("dogfight");
    let graphic = this.game().getMod()?.getSurface("INTERWIN.DAT") || null;
    if (graphic) {
      graphic.setX(0);
      graphic.setY(0);
      graphic.getCrop().x = 0;
      graphic.getCrop().y = 0;
      graphic.getCrop().w = this._window.getWidth();
      graphic.getCrop().h = this._window.getHeight();
      this._window.drawRect(graphic.getCrop(), 15);
      graphic.blit(this._window);
    } else {
      this._window.drawRect(0, 0, this._window.getWidth(), this._window.getHeight(), 15);
    }

    this._preview.drawRect(0, 0, this._preview.getWidth(), this._preview.getHeight(), 15);
    if (graphic && dogfightInterface) {
      const previewTop = dogfightInterface.getElement("previewTop");
      const previewBot = dogfightInterface.getElement("previewBot");
      const previewMid = dogfightInterface.getElement("previewMid");
      if (previewTop) {
        graphic.getCrop().y = previewTop.y;
        graphic.getCrop().h = previewTop.h;
        graphic.blit(this._preview);
      }
      if (previewBot) {
        graphic.setY(this._window.getHeight() - previewBot.h);
        graphic.getCrop().y = previewBot.y;
        graphic.getCrop().h = previewBot.h;
        graphic.blit(this._preview);
      }
      if (this._ufo.getRules().getModSprite()) {
        graphic = this.game().getMod()?.getSurface(this._ufo.getRules().getModSprite()) || graphic;
      } else if (previewMid) {
        graphic.getCrop().y = previewMid.y + previewMid.h * this._ufo.getRules().getSprite();
        graphic.getCrop().h = previewMid.h;
      }
      if (previewTop) {
        graphic.setX(previewTop.x);
        graphic.setY(previewTop.h);
      }
      graphic.blit(this._preview);
    }
    this._preview.setVisible(false);
  }

  private setupButtonsAndText(): void {
    this._preview.onMouseClick(this.previewClick.bind(this));
    this._btnMinimize.onMouseClick(this.btnMinimizeClick.bind(this));

    this._btnStandoff.copy(this._window);
    this._btnStandoff.setGroup(this._mode);
    this._btnStandoff.onMousePress(this.btnStandoffPress.bind(this));

    this._btnCautious.copy(this._window);
    this._btnCautious.setGroup(this._mode);
    this._btnCautious.onMousePress(this.btnCautiousPress.bind(this));

    this._btnStandard.copy(this._window);
    this._btnStandard.setGroup(this._mode);
    this._btnStandard.onMousePress(this.btnStandardPress.bind(this));

    this._btnAggressive.copy(this._window);
    this._btnAggressive.setGroup(this._mode);
    this._btnAggressive.onMousePress(this.btnAggressivePress.bind(this));

    this._btnDisengage.copy(this._window);
    this._btnDisengage.onMousePress(this.btnDisengagePress.bind(this));
    this._btnDisengage.setGroup(this._mode);

    this._btnUfo.copy(this._window);
    this._btnUfo.onMouseClick(this.btnUfoClick.bind(this));

    this._txtDistance.setText("640");
    this._txtStatus.setText(String(this.tr("STR_STANDOFF")));
  }

  private setupInterceptionNumber(): void {
    const set = this.game().getMod()?.getSurfaceSet("INTICON.PCK");
    const frame = set?.getFrame(this._craft.getRules().getSprite());
    if (frame) {
      frame.setX(0);
      frame.setY(0);
      frame.blit(this._btnMinimizedIcon);
    }
    this._btnMinimizedIcon.onMouseClick(this.btnMinimizedIconClick.bind(this));
    this._btnMinimizedIcon.setVisible(false);

    if (getInterceptionOrder(this._craft) === 0) {
      let maxInterceptionOrder = 0;
      for (const base of this.game().getSavedGame()?.getBases() || []) {
        for (const craft of base.getCrafts()) {
          if (getInterceptionOrder(craft) > maxInterceptionOrder) {
            maxInterceptionOrder = getInterceptionOrder(craft);
          }
        }
      }
      setInterceptionOrder(this._craft, maxInterceptionOrder + 1);
    }
    this._txtInterceptionNumber.setText(String(getInterceptionOrder(this._craft)));
    this._txtInterceptionNumber.setVisible(false);
  }

  private setupColors(): void {
    const dogfightInterface = this.game().getMod()?.getInterface("dogfight");
    const color = (id: string, fallback: number) => dogfightInterface?.getElement(id)?.color ?? fallback;
    const color2 = (id: string, fallback: number) => dogfightInterface?.getElement(id)?.color2 ?? fallback;
    this._colors[ColorNames.CRAFT_MIN] = color("craftRange", 32);
    this._colors[ColorNames.CRAFT_MAX] = color2("craftRange", 40);
    this._colors[ColorNames.RADAR_MIN] = color("radarRange", 16);
    this._colors[ColorNames.RADAR_MAX] = color2("radarRange", 24);
    this._colors[ColorNames.DAMAGE_MIN] = color("damageRange", 48);
    this._colors[ColorNames.DAMAGE_MAX] = color2("damageRange", 56);
    this._colors[ColorNames.BLOB_MIN] = color("radarDetail", 8);
    this._colors[ColorNames.RANGE_METER] = color2("radarDetail", 12);
    this._colors[ColorNames.DISABLED_WEAPON] = color("disabledWeapon", 16);
    this._colors[ColorNames.DISABLED_RANGE] = color2("disabledWeapon", 16);
    this._colors[ColorNames.DISABLED_AMMO] = color("disabledAmmo", 16);
  }

  private setupWeapons(): void {
    const set = this.game().getMod()?.getSurfaceSet("INTICON.PCK");
    for (let i = 0; i < this._craft.getRules().getWeapons(); ++i) {
      const weapon = this._craft.getWeapons()[i];
      if (!weapon) {
        continue;
      }

      const surface = i === 0 ? this._weapon1 : this._weapon2;
      const range = i === 0 ? this._range1 : this._range2;
      const ammo = i === 0 ? this._txtAmmo1 : this._txtAmmo2;
      const x1 = i === 0 ? 2 : 0;
      const x2 = i === 0 ? 0 : 18;

      const frame = set?.getFrame(weapon.getRules().getSprite() + 5);
      if (frame) {
        frame.setX(0);
        frame.setY(0);
        frame.blit(surface);
      }

      ammo.setText(String(weapon.getAmmo()));

      const color = this._colors[ColorNames.RANGE_METER];
      const rangeY = range.getHeight() - weapon.getRules().getRange();
      const connectY = 57;
      for (let x = x1; x <= x1 + 18; x += 2) {
        range.setPixel(x, rangeY, color);
      }
      const minY = Math.min(rangeY, connectY);
      const maxY = Math.max(rangeY, connectY);
      for (let y = minY; y <= maxY; ++y) {
        range.setPixel(x1 + x2, y, color);
      }
      for (let x = x2; x <= x2 + 2; ++x) {
        range.setPixel(x, connectY, color);
      }
    }

    if (!(this._craft.getRules().getWeapons() > 0 && this._craft.getWeapons()[0])) {
      this._weapon1.setVisible(false);
      this._range1.setVisible(false);
      this._txtAmmo1.setVisible(false);
    }
    if (!(this._craft.getRules().getWeapons() > 1 && this._craft.getWeapons()[1])) {
      this._weapon2.setVisible(false);
      this._range2.setVisible(false);
      this._txtAmmo2.setVisible(false);
    }

    this._weapon1.onMouseClick(this.weapon1Click.bind(this));
    this._weapon2.onMouseClick(this.weapon2Click.bind(this));
  }

  private setupDamageIndicator(): void {
    const frame = this.game().getMod()?.getSurfaceSet("INTICON.PCK")?.getFrame(this._craft.getRules().getSprite() + 11);
    if (frame) {
      frame.setX(0);
      frame.setY(0);
      frame.blit(this._damage);
    }
    this._craftDamageAnimTimer.onTimer(this.animateCraftDamage.bind(this));

    const x = Math.trunc(this._damage.getWidth() / 2);
    for (let y = 0; y < this._damage.getHeight(); ++y) {
      const pixelColor = this._damage.getPixel(x, y);
      if (pixelColor >= this._colors[ColorNames.CRAFT_MIN] && pixelColor < this._colors[ColorNames.CRAFT_MAX]) {
        ++this._craftHeight;
      }
    }
    this.drawCraftDamage();
  }

  private setupInitialCounters(): void {
    if (!this._ufo.getEscapeCountdown()) {
      this._ufo.setFireCountdown(0);
      const breakOffTime = this._ufo.getRules().getBreakOffTime();
      const escapeCountdown = breakOffTime + RNG.generate(0, breakOffTime) - 30 * difficultyCoefficient(this.game().getSavedGame());
      this._ufo.setEscapeCountdown(Math.max(1, escapeCountdown));
    }

    const w1 = this._craft.getWeapons()[0];
    const w2 = this._craft.getWeapons()[1];
    if (this._craft.getRules().getWeapons() > 0 && w1) {
      this._w1FireInterval = w1.getRules().getStandardReload();
    }
    if (this._craft.getRules().getWeapons() > 1 && w2) {
      this._w2FireInterval = w2.getRules().getStandardReload();
    }

    const ufoSize = this._ufo.getRules().getSize();
    if (ufoSize === "STR_VERY_SMALL") {
      this._ufoSize = 0;
    } else if (ufoSize === "STR_SMALL") {
      this._ufoSize = 1;
    } else if (ufoSize === "STR_MEDIUM_UC") {
      this._ufoSize = 2;
    } else if (ufoSize === "STR_LARGE") {
      this._ufoSize = 3;
    } else {
      this._ufoSize = 4;
    }
  }

  private updateDistanceAndProjectiles(): boolean {
    let projectileInFlight = false;
    let distanceChange = 0;

    if (!this._ufoBreakingOff) {
      if (this._currentDist < this._targetDist && !this._ufo.isCrashed() && !craftDestroyed(this._craft)) {
        distanceChange = 4;
        if (this._currentDist + distanceChange > this._targetDist) {
          distanceChange = this._targetDist - this._currentDist;
        }
      } else if (this._currentDist > this._targetDist && !this._ufo.isCrashed() && !craftDestroyed(this._craft)) {
        distanceChange = -2;
      }

      for (const projectile of this._projectiles) {
        if (projectile.getGlobalType() !== CraftWeaponProjectileGlobalType.CWPGT_BEAM && projectile.getDirection() === Directions.D_UP) {
          projectile.setPosition(projectile.getPosition() + distanceChange);
        }
      }
    } else {
      distanceChange = 4;
    }

    this._currentDist += distanceChange;
    this._txtDistance.setText(String(this._currentDist));

    for (const projectile of this._projectiles) {
      projectile.move();
      if (projectile.getDirection() === Directions.D_UP) {
        if (((projectile.getPosition() >= this._currentDist) || (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_BEAM && projectile.toBeRemoved())) && !this._ufo.isCrashed() && !projectile.getMissed()) {
          const hitChance = (projectile.getAccuracy() * (100 + 300 / (5 - this._ufoSize)) + 100) / 200;
          if (RNG.percent(hitChance)) {
            const damage = RNG.generate(Math.trunc(projectile.getDamage() / 2), projectile.getDamage());
            this._ufo.setDamage(this._ufo.getDamage() + damage);
            if (this._ufo.isCrashed()) {
              this._ufo.setShotDownByCraftId(getCraftUniqueId(this._craft));
              this._ufo.setSpeed(0);
              this._ufo.setDestination(null);
              this._ufoBreakingOff = false;
              this._end = false;
            }
            if (this._ufo.getHitFrame() === 0) {
              this._animatingHit = true;
              this._ufo.setHitFrame(3);
            }
            this.setStatus("STR_UFO_HIT");
            playGeoscapeSound(0);
            projectile.remove();
          } else if (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_BEAM) {
            projectile.remove();
          } else {
            projectile.setMissed(true);
          }
        }
        if (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_MISSILE && Math.trunc(projectile.getPosition() / 8) >= projectile.getRange()) {
          projectile.remove();
        } else if (!this._ufo.isCrashed()) {
          projectileInFlight = true;
        }
      } else if (projectile.getDirection() === Directions.D_DOWN) {
        if (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_MISSILE || (projectile.getGlobalType() === CraftWeaponProjectileGlobalType.CWPGT_BEAM && projectile.toBeRemoved())) {
          if (RNG.percent(projectile.getAccuracy())) {
            const damage = RNG.generate(0, this._ufo.getRules().getWeaponPower());
            if (damage) {
              this._craft.setDamage(this._craft.getDamage() + damage);
              this.drawCraftDamage();
              this.setStatus("STR_INTERCEPTOR_DAMAGED");
              playGeoscapeSound(0);
              if (this._mode.value === this._btnCautious && this._craft.getDamagePercentage() >= 50) {
                this._targetDist = STANDOFF_DIST;
              }
            }
          }
          projectile.remove();
        }
      }
    }

    this._projectiles = this._projectiles.filter(projectile => !projectile.toBeRemoved() && !(projectile.getMissed() && projectile.getPosition() <= 0));
    return projectileInFlight;
  }

  private handleWeaponFire(projectileInFlight: boolean): void {
    for (let i = 0; i < this._craft.getRules().getWeapons(); ++i) {
      const weapon = this._craft.getWeapons()[i];
      if (!weapon) {
        continue;
      }
      const wTimer = i === 0 ? this._w1FireCountdown : this._w2FireCountdown;
      if (wTimer === 0 && this._currentDist <= weapon.getRules().getRange() * 8 && weapon.getAmmo() > 0 && this._mode.value !== this._btnStandoff && this._mode.value !== this._btnDisengage && !this._ufo.isCrashed() && !craftDestroyed(this._craft)) {
        if (i === 0 && this._weapon1Enabled) {
          this.fireWeapon1();
          projectileInFlight = true;
        } else if (i !== 0 && this._weapon2Enabled) {
          this.fireWeapon2();
          projectileInFlight = true;
        }
      } else if (wTimer > 0) {
        if (i === 0) {
          --this._w1FireCountdown;
        } else {
          --this._w2FireCountdown;
        }
      }

      if (weapon.getAmmo() === 0 && !projectileInFlight && !craftDestroyed(this._craft)) {
        if (this._mode.value === this._btnCautious) {
          this.minimumDistance();
        } else if (this._mode.value === this._btnStandard) {
          this.maximumDistance();
        }
      }
    }
  }

  private handleUfoFire(): void {
    if (this._currentDist <= this._ufo.getRules().getWeaponRange() * 8 && !this._ufo.isCrashed() && !craftDestroyed(this._craft)) {
      if (this._ufo.getShootingAt() === 0) {
        this._ufo.setShootingAt(this._interceptionNumber);
      }
      if (this._ufo.getShootingAt() === this._interceptionNumber && this._ufo.getFireCountdown() === 0) {
        this.ufoFireWeapon();
      }
    } else if (this._ufo.getShootingAt() === this._interceptionNumber) {
      this._ufo.setShootingAt(0);
    }
  }

  private handleDestruction(finalRun: boolean): boolean {
    if (craftDestroyed(this._craft)) {
      this.setStatus("STR_INTERCEPTOR_DESTROYED");
      this._timeout += 30;
      playGeoscapeSound(0);
      finalRun = true;
      this._destroyCraft = true;
      this._ufo.setShootingAt(0);
    }

    if (this._ufo.isCrashed()) {
      const mission = this._ufo.getMission() as AlienMissionBoundary | null;
      mission?.ufoShotDown?.(this._ufo);

      if (this._ufo.isDestroyed()) {
        if (this._ufo.getShotDownByCraftId() === getCraftUniqueId(this._craft)) {
          this.addXcomActivity(this._ufo.getRules().getScore() * 2);
          this.setStatus("STR_UFO_DESTROYED");
          playGeoscapeSound(0);
        }
        this._destroyUfo = true;
      } else {
        if (this._ufo.getShotDownByCraftId() === getCraftUniqueId(this._craft)) {
          this.setStatus("STR_UFO_CRASH_LANDS");
          playGeoscapeSound(0);
          this.addXcomActivity(this._ufo.getRules().getScore());
        }
        if (!this._state.getGlobe().insideLand(this._ufo.getLongitude(), this._ufo.getLatitude())) {
          this._ufo.setStatus(UfoStatus.DESTROYED);
          this._destroyUfo = true;
        } else {
          this._ufo.setSecondsRemaining(RNG.generate(24, 96) * 3600);
          this._ufo.setAltitude("STR_GROUND");
          if (this._ufo.getCrashId() === 0) {
            this._ufo.setCrashId(this.game().getSavedGame()?.getId("STR_CRASH_SITE") || 0);
          }
        }
      }

      this._timeout += 30;
      if (this._ufo.getShotDownByCraftId() !== getCraftUniqueId(this._craft)) {
        this._timeout += 50;
        this._ufo.setHitFrame(3);
      }
      finalRun = true;

      if (this._ufo.getStatus() === UfoStatus.LANDED) {
        this._timeout += 30;
        finalRun = true;
        this._ufo.setShootingAt(0);
      }
    }
    return finalRun;
  }

  private addXcomActivity(score: number): void {
    const save = this.game().getSavedGame();
    for (const country of save?.getCountries() || []) {
      if (country.getRules().insideCountry(this._ufo.getLongitude(), this._ufo.getLatitude())) {
        country.addActivityXcom(score);
        break;
      }
    }
    for (const region of save?.getRegions() || []) {
      if (region.getRules().insideRegion(this._ufo.getLongitude(), this._ufo.getLatitude())) {
        region.addActivityXcom(score);
        break;
      }
    }
  }

  private endDogfight(): void {
    if (this._endDogfight) {
      return;
    }
    setCraftInDogfight(this._craft, false);
    setInterceptionOrder(this._craft, 0);
    this._ufo.setInterceptionProcessed(false);
    this._endDogfight = true;
  }

  private dogfightErrorBoundary(message: string): void {
    void (this._state as GeoscapeDogfightBoundary).popup;
    console.log(`DogfightErrorState boundary: ${String(this.tr(message))}`);
  }

  private ufoBlobPixel(sizeFrame: number, x: number, y: number): number {
    const radius = Math.max(2, Math.min(6, 3 + sizeFrame));
    const dx = x - 6;
    const dy = y - 6;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) {
      return 0;
    }
    return Math.max(1, Math.min(5, Math.ceil((radius - distance + 1) * 5 / (radius + 1))));
  }
}
