export type TacticalActionMode = "move" | "snap" | "auto" | "smoke";

export interface TacticalRosterUnit {
  name: string;
  rank: string;
  tu: number;
  stamina: number;
  health: number;
  bravery: number;
  morale: number;
  reactions: number;
  firing: number;
  throwing: number;
  strength: number;
}

type Faction = "xcom" | "alien";
type MissionState = "ongoing" | "xcom-victory" | "xcom-defeat" | "aborted";
type Terrain = "ground" | "cover" | "wall";

interface Tile {
  terrain: Terrain;
  smoke: number;
}

interface Unit {
  id: string;
  name: string;
  rank: string;
  faction: Faction;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tu: number;
  maxTu: number;
  stamina: number;
  bravery: number;
  morale: number;
  panicked: boolean;
  reactions: number;
  firing: number;
  throwing: number;
  strength: number;
  kneeling: boolean;
  alive: boolean;
  kills: number;
}

interface UnitView {
  id: string;
  name: string;
  rank: string;
  faction: Faction;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tu: number;
  maxTu: number;
  morale: number;
  panicked: boolean;
  kneeling: boolean;
  alive: boolean;
  selected: boolean;
}

interface TileView {
  x: number;
  y: number;
  terrain: Terrain;
  smoke: number;
}

export interface TacticalView {
  width: number;
  height: number;
  turn: Faction;
  turnNumber: number;
  state: MissionState;
  selectedUnitId: string | null;
  mode: TacticalActionMode;
  units: UnitView[];
  tiles: TileView[];
  log: string[];
  objective: string;
  xcomAlive: number;
  alienAlive: number;
}

export interface TacticalOutcomeSoldier {
  name: string;
  alive: boolean;
  finalHealth: number;
  kills: number;
  rankUp: boolean;
  braveryGain: number;
  moraleFinal: number;
  reactionsGain: number;
  firingGain: number;
  throwingGain: number;
  tuGain: number;
  staminaGain: number;
  strengthGain: number;
}

export interface TacticalOutcome {
  success: boolean;
  aborted: boolean;
  score: number;
  lootCredits: number;
  soldiers: TacticalOutcomeSoldier[];
}

const RANK_ORDER = ["Rookie", "Squaddie", "Sergeant", "Captain", "Colonel", "Commander"];

export class TacticalSimulation {
  private readonly width = 14;
  private readonly height = 10;
  private readonly tiles: Tile[];
  private readonly units: Unit[];
  private readonly rosterNames: string[];

  private mode: TacticalActionMode = "move";
  private turn: Faction = "xcom";
  private turnNumber = 1;
  private selectedUnitId: string | null = null;
  private state: MissionState = "ongoing";
  private readonly log: string[] = [];

  constructor(roster: TacticalRosterUnit[]) {
    this.tiles = this.buildTiles();
    this.units = [];

    const deployed = roster.slice(0, 8);
    this.rosterNames = deployed.map((s) => s.name);
    this.spawnXcom(deployed);
    this.spawnAliens(Math.max(4, Math.min(8, Math.floor(deployed.length * 0.8) + 3)));

    this.selectedUnitId = this.getXcomUnits()[0]?.id ?? null;
    this.logEvent(`Deployment complete: ${deployed.length} soldiers.`);
  }

  setMode(mode: TacticalActionMode): void {
    this.mode = mode;
  }

  getMode(): TacticalActionMode {
    return this.mode;
  }

  getView(): TacticalView {
    const objective = this.state === "ongoing"
      ? "Eliminate all hostiles"
      : this.state === "xcom-victory"
        ? "Mission success"
        : this.state === "xcom-defeat"
          ? "Mission failed"
          : "Operation aborted";

    return {
      width: this.width,
      height: this.height,
      turn: this.turn,
      turnNumber: this.turnNumber,
      state: this.state,
      selectedUnitId: this.selectedUnitId,
      mode: this.mode,
      units: this.units.filter((u) => u.alive).map((u) => ({
        id: u.id,
        name: u.name,
        rank: u.rank,
        faction: u.faction,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
        tu: u.tu,
        maxTu: u.maxTu,
        morale: u.morale,
        panicked: u.panicked,
        kneeling: u.kneeling,
        alive: u.alive,
        selected: u.id === this.selectedUnitId
      })),
      tiles: this.tiles.map((t, i) => ({
        x: i % this.width,
        y: Math.floor(i / this.width),
        terrain: t.terrain,
        smoke: t.smoke
      })),
      log: this.log.slice(-8),
      objective,
      xcomAlive: this.getAliveCount("xcom"),
      alienAlive: this.getAliveCount("alien")
    };
  }

  onTileClicked(x: number, y: number): void {
    if (this.state !== "ongoing" || this.turn !== "xcom") return;

    const clicked = this.getUnitAt(x, y);
    if (clicked && clicked.faction === "xcom") {
      this.selectedUnitId = clicked.id;
      this.logEvent(`Selected ${clicked.name}.`);
      return;
    }

    const selected = this.getSelectedXcomUnit();
    if (!selected) return;
    if (selected.panicked) {
      this.logEvent(`${selected.name} is panicking and cannot obey orders.`);
      return;
    }

    if (this.mode === "move") {
      this.moveUnit(selected, x, y);
      return;
    }

    if (this.mode === "smoke") {
      this.throwSmoke(selected, x, y);
      return;
    }

    if (!clicked || clicked.faction !== "alien") {
      this.logEvent("Target an alien unit.");
      return;
    }

    this.attackUnit(selected, clicked, this.mode === "snap" ? "snap" : "auto");
  }

  cycleSelectedUnit(): void {
    if (this.turn !== "xcom" || this.state !== "ongoing") return;
    const xcom = this.getXcomUnits().filter((u) => u.alive && !u.panicked);
    if (xcom.length === 0) return;

    const current = this.selectedUnitId ? xcom.findIndex((u) => u.id === this.selectedUnitId) : -1;
    const next = xcom[(current + 1) % xcom.length];
    this.selectedUnitId = next.id;
    this.logEvent(`Selected ${next.name}.`);
  }

  kneelSelected(): void {
    const selected = this.getSelectedXcomUnit();
    if (!selected || this.turn !== "xcom" || this.state !== "ongoing") return;
    if (selected.tu < 4) {
      this.logEvent(`${selected.name} lacks TUs to kneel.`);
      return;
    }
    selected.tu -= 4;
    selected.kneeling = !selected.kneeling;
    this.logEvent(`${selected.name} ${selected.kneeling ? "kneels" : "stands"}.`);
  }

  endTurn(): void {
    if (this.state !== "ongoing" || this.turn !== "xcom") return;
    this.turn = "alien";
    this.logEvent("Alien turn begins.");
    this.runAlienTurn();
    if (this.state !== "ongoing") return;

    this.turn = "xcom";
    this.turnNumber += 1;
    this.refreshTurnUnits("xcom");
    this.decaySmoke();
    this.logEvent("XCOM turn begins.");
  }

  abortMission(): void {
    if (this.state !== "ongoing") return;
    this.state = "aborted";
    this.logEvent("Mission aborted.");
  }

  buildOutcome(): TacticalOutcome {
    const success = this.state === "xcom-victory";
    const aborted = this.state === "aborted";

    const soldiers: TacticalOutcomeSoldier[] = this.rosterNames.map((name) => {
      const unit = this.units.find((u) => u.name === name && u.faction === "xcom");
      if (!unit || !unit.alive) {
        return {
          name,
          alive: false,
          finalHealth: 0,
          kills: 0,
          rankUp: false,
          braveryGain: 0,
          moraleFinal: 0,
          reactionsGain: 0,
          firingGain: 0,
          throwingGain: 0,
          tuGain: 0,
          staminaGain: 0,
          strengthGain: 0
        };
      }

      const promotionRoll = unit.kills >= 2 || (success && unit.kills >= 1);
      return {
        name,
        alive: true,
        finalHealth: Math.max(1, unit.hp),
        kills: unit.kills,
        rankUp: promotionRoll,
        braveryGain: unit.kills > 0 ? 1 : 0,
        moraleFinal: unit.morale,
        reactionsGain: Math.min(3, Math.floor(unit.kills / 2) + 1),
        firingGain: Math.min(5, unit.kills + 1),
        throwingGain: this.mode === "smoke" ? 2 : 1,
        tuGain: success ? 1 : 0,
        staminaGain: success ? 1 : 0,
        strengthGain: unit.kills > 0 ? 1 : 0
      };
    });

    const aliensDown = this.units.filter((u) => u.faction === "alien" && !u.alive).length;
    const xcomDown = this.units.filter((u) => u.faction === "xcom" && !u.alive).length;

    return {
      success,
      aborted,
      score: success ? 300 + aliensDown * 25 - xcomDown * 40 : -150 - xcomDown * 40,
      lootCredits: success ? 60_000 + aliensDown * 9_000 : 0,
      soldiers
    };
  }

  private buildTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let terrain: Terrain = "ground";

        if (x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1) terrain = "wall";
        else if ((x * 31 + y * 17) % 13 === 0) terrain = "cover";
        else if ((x * 11 + y * 19) % 41 === 0) terrain = "wall";

        if (x <= 2 && y >= 2 && y <= 7) terrain = "ground";
        if (x >= this.width - 3 && y >= 2 && y <= 7) terrain = "ground";

        tiles.push({ terrain, smoke: 0 });
      }
    }
    return tiles;
  }

  private spawnXcom(roster: TacticalRosterUnit[]): void {
    roster.forEach((soldier, i) => {
      const y = 2 + (i % 6);
      const x = 1 + Math.floor(i / 6);
      this.units.push({
        id: `X-${i + 1}`,
        name: soldier.name,
        rank: soldier.rank,
        faction: "xcom",
        x,
        y,
        hp: soldier.health,
        maxHp: soldier.health,
        tu: soldier.tu,
        maxTu: soldier.tu,
        stamina: soldier.stamina,
        bravery: soldier.bravery,
        morale: soldier.morale,
        panicked: false,
        reactions: soldier.reactions,
        firing: soldier.firing,
        throwing: soldier.throwing,
        strength: soldier.strength,
        kneeling: false,
        alive: true,
        kills: 0
      });
    });
  }

  private spawnAliens(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const y = 2 + (i % 6);
      const x = this.width - 2 - Math.floor(i / 6);
      this.units.push({
        id: `A-${i + 1}`,
        name: `Sectoid ${i + 1}`,
        rank: "Alien",
        faction: "alien",
        x,
        y,
        hp: 28 + (i % 3) * 4,
        maxHp: 28 + (i % 3) * 4,
        tu: 52,
        maxTu: 52,
        stamina: 60,
        bravery: 40 + (i % 3) * 8,
        morale: 100,
        panicked: false,
        reactions: 48,
        firing: 52,
        throwing: 40,
        strength: 28,
        kneeling: false,
        alive: true,
        kills: 0
      });
    }
  }

  private runAlienTurn(): void {
    this.refreshTurnUnits("alien");
    for (const alien of this.getAlienUnits().filter((u) => u.alive)) {
      if (this.state !== "ongoing") break;
      if (alien.panicked) continue;

      const target = this.pickVisibleTarget(alien, "xcom");
      if (target && alien.tu >= 16) {
        this.attackUnit(alien, target, "snap");
        continue;
      }

      const nearest = this.findNearestEnemy(alien, "xcom");
      if (!nearest) continue;

      const step = this.findStepToward(alien.x, alien.y, nearest.x, nearest.y);
      if (step && alien.tu >= 8) {
        this.moveTo(alien, step.x, step.y, 8);
      }

      const maybeShot = this.pickVisibleTarget(alien, "xcom");
      if (maybeShot && alien.tu >= 16) this.attackUnit(alien, maybeShot, "snap");
    }
  }

  private moveUnit(unit: Unit, targetX: number, targetY: number): void {
    if (!this.isInside(targetX, targetY)) return;
    const tile = this.getTile(targetX, targetY);
    if (!tile || tile.terrain === "wall") {
      this.logEvent("Cannot move into that tile.");
      return;
    }

    const path = this.findPath(unit.x, unit.y, targetX, targetY);
    if (path.length === 0) {
      this.logEvent("No path to destination.");
      return;
    }

    const moveCost = path.length * 4;
    if (unit.tu < moveCost) {
      this.logEvent(`${unit.name} lacks TUs (${moveCost} needed).`);
      return;
    }

    unit.tu -= moveCost;
    unit.x = targetX;
    unit.y = targetY;
    unit.kneeling = false;
    this.logEvent(`${unit.name} moves (${moveCost} TU).`);
    this.checkReactionFire(unit);
  }

  private throwSmoke(unit: Unit, x: number, y: number): void {
    if (unit.tu < 18) {
      this.logEvent(`${unit.name} lacks TUs for smoke.`);
      return;
    }
    if (!this.isInside(x, y)) return;

    const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y);
    const maxRange = 3 + Math.floor(unit.strength / 12);
    if (distance > maxRange) {
      this.logEvent("Target out of throwing range.");
      return;
    }

    unit.tu -= 18;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const tx = x + ox;
        const ty = y + oy;
        const tile = this.getTile(tx, ty);
        if (!tile || tile.terrain === "wall") continue;
        tile.smoke = Math.max(tile.smoke, 3);
      }
    }

    this.logEvent(`${unit.name} deploys smoke.`);
  }

  private attackUnit(attacker: Unit, defender: Unit, mode: "snap" | "auto"): void {
    const tuCost = mode === "snap" ? 16 : 28;
    if (attacker.tu < tuCost) {
      this.logEvent(`${attacker.name} lacks TUs to fire.`);
      return;
    }

    if (!this.hasLineOfSight(attacker.x, attacker.y, defender.x, defender.y)) {
      this.logEvent("No line of fire.");
      return;
    }

    attacker.tu -= tuCost;

    const range = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    const baseAccuracy = attacker.firing + (mode === "auto" ? -8 : 5) + (attacker.kneeling ? 8 : 0) - range * 4;
    const smokePenalty = this.getTile(defender.x, defender.y)?.smoke ? 15 : 0;
    const hitChance = Math.max(8, Math.min(95, baseAccuracy - smokePenalty));

    const roll = Math.random() * 100;
    if (roll >= hitChance) {
      this.logEvent(`${attacker.name} misses ${defender.name}.`);
      return;
    }

    const damage = 18 + Math.floor(Math.random() * 16) + Math.floor(attacker.strength / 8);
    defender.hp -= damage;

    if (defender.hp <= 0) {
      defender.alive = false;
      defender.hp = 0;
      defender.panicked = false;
      attacker.kills += 1;
      this.logEvent(`${attacker.name} kills ${defender.name}.`);
      this.applyMoraleShock(defender.faction, 24);
      this.applyMoraleRecovery(attacker.faction, 8);
      if (this.selectedUnitId === defender.id) this.selectedUnitId = this.getXcomUnits().find((u) => u.alive)?.id ?? null;
      this.checkMissionState();
      return;
    }

    this.logEvent(`${attacker.name} hits ${defender.name} for ${damage}.`);
  }

  private checkReactionFire(mover: Unit): void {
    if (mover.faction !== "xcom") return;
    const shooters = this.getAlienUnits().filter((a) => a.alive && a.tu >= 20 && this.hasLineOfSight(a.x, a.y, mover.x, mover.y));
    for (const alien of shooters.slice(0, 2)) {
      this.attackUnit(alien, mover, "snap");
      if (!mover.alive) break;
    }
  }

  private checkMissionState(): void {
    if (this.getAliveCount("alien") === 0) {
      this.state = "xcom-victory";
      this.logEvent("All hostiles eliminated.");
      return;
    }

    if (this.getAliveCount("xcom") === 0) {
      this.state = "xcom-defeat";
      this.logEvent("XCOM squad neutralized.");
    }
  }

  private refreshTurnUnits(faction: Faction): void {
    for (const unit of this.units) {
      if (!unit.alive || unit.faction !== faction) continue;
      unit.tu = unit.maxTu;
      if (unit.stamina > 30) unit.stamina -= 1;
      unit.panicked = false;
      const recovery = Math.max(2, Math.floor(unit.bravery / 20));
      unit.morale = Math.min(100, unit.morale + recovery);
      const panicThreshold = Math.max(18, 60 - Math.floor(unit.bravery / 2));
      if (unit.morale < panicThreshold && Math.random() < 0.45) {
        unit.panicked = true;
        unit.tu = Math.floor(unit.maxTu * 0.35);
        this.logEvent(`${unit.name} panics!`);
      }
    }
  }

  private applyMoraleShock(faction: Faction, amount: number): void {
    for (const unit of this.units) {
      if (!unit.alive || unit.faction !== faction) continue;
      const resisted = Math.floor(unit.bravery / 10);
      unit.morale = Math.max(0, unit.morale - Math.max(4, amount - resisted));
    }
  }

  private applyMoraleRecovery(faction: Faction, amount: number): void {
    for (const unit of this.units) {
      if (!unit.alive || unit.faction !== faction) continue;
      unit.morale = Math.min(100, unit.morale + amount);
    }
  }

  private decaySmoke(): void {
    for (const tile of this.tiles) {
      tile.smoke = Math.max(0, tile.smoke - 1);
    }
  }

  private findPath(startX: number, startY: number, targetX: number, targetY: number): Array<{ x: number; y: number }> {
    const startKey = `${startX},${startY}`;
    const targetKey = `${targetX},${targetY}`;
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const visited = new Set<string>([startKey]);
    const previous = new Map<string, string>();

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) break;
      const key = `${node.x},${node.y}`;
      if (key === targetKey) break;

      for (const neighbor of this.neighbors(node.x, node.y)) {
        const nKey = `${neighbor.x},${neighbor.y}`;
        if (visited.has(nKey)) continue;
        const tile = this.getTile(neighbor.x, neighbor.y);
        if (!tile || tile.terrain === "wall") continue;
        const occupied = this.getUnitAt(neighbor.x, neighbor.y);
        if (occupied && !(neighbor.x === targetX && neighbor.y === targetY)) continue;
        visited.add(nKey);
        previous.set(nKey, key);
        queue.push(neighbor);
      }
    }

    if (!visited.has(targetKey)) return [];

    const path: Array<{ x: number; y: number }> = [];
    let cursor = targetKey;
    while (cursor !== startKey) {
      const [xS, yS] = cursor.split(",");
      path.push({ x: Number(xS), y: Number(yS) });
      const prev = previous.get(cursor);
      if (!prev) break;
      cursor = prev;
    }
    path.reverse();
    return path;
  }

  private findNearestEnemy(unit: Unit, enemyFaction: Faction): Unit | null {
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of this.units) {
      if (!enemy.alive || enemy.faction !== enemyFaction) continue;
      const dist = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
      if (dist < bestDistance) {
        best = enemy;
        bestDistance = dist;
      }
    }

    return best;
  }

  private findStepToward(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } | null {
    const options = this.neighbors(fromX, fromY)
      .filter((n) => {
        const tile = this.getTile(n.x, n.y);
        if (!tile || tile.terrain === "wall") return false;
        return !this.getUnitAt(n.x, n.y);
      })
      .sort((a, b) => {
        const da = Math.abs(a.x - toX) + Math.abs(a.y - toY);
        const db = Math.abs(b.x - toX) + Math.abs(b.y - toY);
        return da - db;
      });

    return options[0] ?? null;
  }

  private moveTo(unit: Unit, x: number, y: number, tuCost: number): void {
    unit.tu -= tuCost;
    unit.x = x;
    unit.y = y;
    unit.kneeling = false;
    this.logEvent(`${unit.name} advances.`);
  }

  private pickVisibleTarget(viewer: Unit, faction: Faction): Unit | null {
    const candidates = this.units.filter((u) => u.alive && u.faction === faction && this.hasLineOfSight(viewer.x, viewer.y, u.x, u.y));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const da = Math.abs(a.x - viewer.x) + Math.abs(a.y - viewer.y);
      const db = Math.abs(b.x - viewer.x) + Math.abs(b.y - viewer.y);
      return da - db;
    });
    return candidates[0] ?? null;
  }

  private hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (!(x === x1 && y === y1)) {
      const tile = this.getTile(x, y);
      if (tile && tile.terrain === "wall" && !(x === x0 && y === y0)) return false;
      if (tile && tile.smoke > 1 && !(x === x0 && y === y0)) {
        if (Math.random() < 0.2) return false;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return true;
  }

  private getTile(x: number, y: number): Tile | null {
    if (!this.isInside(x, y)) return null;
    return this.tiles[y * this.width + x] ?? null;
  }

  private getUnitAt(x: number, y: number): Unit | null {
    return this.units.find((u) => u.alive && u.x === x && u.y === y) ?? null;
  }

  private getSelectedXcomUnit(): Unit | null {
    if (!this.selectedUnitId) return null;
    const unit = this.units.find((u) => u.id === this.selectedUnitId && u.alive);
    if (!unit || unit.faction !== "xcom") return null;
    return unit;
  }

  private getXcomUnits(): Unit[] {
    return this.units.filter((u) => u.faction === "xcom");
  }

  private getAlienUnits(): Unit[] {
    return this.units.filter((u) => u.faction === "alien");
  }

  private getAliveCount(faction: Faction): number {
    return this.units.filter((u) => u.faction === faction && u.alive).length;
  }

  private neighbors(x: number, y: number): Array<{ x: number; y: number }> {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ].filter((n) => this.isInside(n.x, n.y));
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private logEvent(message: string): void {
    this.log.push(message);
    if (this.log.length > 80) this.log.shift();
  }
}

export const promoteRank = (rank: string): string => {
  const idx = RANK_ORDER.findIndex((r) => r === rank);
  if (idx < 0) return "Squaddie";
  return RANK_ORDER[Math.min(RANK_ORDER.length - 1, idx + 1)];
};
