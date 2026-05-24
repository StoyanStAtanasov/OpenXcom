import { Craft } from "./Craft.ts";
import { TransferType, type Transfer } from "./Transfer.ts";
import { RNG } from "../Engine/RNG.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { BaseFacility } from "./BaseFacility.ts";
import { ItemContainer } from "./ItemContainer.ts";
import type { Soldier } from "./Soldier.ts";
import type { CoordinateTarget } from "./Target.ts";
import { Ufo } from "./Ufo.ts";
import type { ResearchProject } from "./ResearchProject.ts";

const BASE_SIZE = 6;

type ResearchProjectLike = {
  getRules: () => { needItem?: () => boolean; destroyItem?: () => boolean; getName?: () => string };
  getAssigned: () => number;
  setAssigned: (assigned: number) => void;
  isFinished: () => boolean;
};

type ProductionRulesLike = {
  getRequiredSpace?: () => number;
  getCategory?: () => string;
};

type ProductionLike = {
  getRules: () => ProductionRulesLike | unknown;
  getAssignedEngineers?: () => number;
  setAssignedEngineers?: (assigned: number) => void;
  getAmountTotal?: () => number;
  getAmountProduced?: () => number;
};

type GridCell = {
  facility: BaseFacility;
  connected: boolean;
};

function areSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * Math.max(1.0, Math.abs(left), Math.abs(right));
}

function clampAcos(value: number): number {
  return Math.acos(Math.max(-1, Math.min(1, value)));
}

export class Base {
  private _lon = 0;
  private _lat = 0;
  private _name = "";
  private _mod: Mod | null = null;
  private _crafts: Craft[] = [];
  private _facilities: BaseFacility[] = [];
  private _transfers: Transfer[] = [];
  private _soldiers: Soldier[] = [];
  private _research: ResearchProjectLike[] = [];
  private _productions: ProductionLike[] = [];
  private _defenses: BaseFacility[] = [];
  private _vehicles: unknown[] = [];
  private _items = new ItemContainer();
  private _scientists = 0;
  private _engineers = 0;

  constructor(mod: Mod | null = null) {
    this._mod = mod;
  }

  setMod(mod: Mod | null): void {
    this._mod = mod;
  }

  getMod(): Mod | null {
    return this._mod;
  }

  setLongitude(lon: number): void {
    this._lon = lon;
  }

  setLatitude(lat: number): void {
    this._lat = lat;
  }

  getLongitude(): number {
    return this._lon;
  }

  getLatitude(): number {
    return this._lat;
  }

  setName(name: string): void {
    this._name = name;
  }

  getName(): string {
    return this._name;
  }

  getCrafts(): Craft[] {
    return this._crafts;
  }

  getFacilities(): BaseFacility[] {
    return this._facilities;
  }

  getTransfers(): Transfer[] {
    return this._transfers;
  }

  getSoldiers(): Soldier[] {
    return this._soldiers;
  }

  getResearch(): ResearchProjectLike[] {
    return this._research;
  }

  addResearch(project: ResearchProject): void {
    this._research.push(project);
  }

  removeResearch(project: ResearchProjectLike): void {
    this._scientists += project.getAssigned();
    const index = this._research.indexOf(project);
    if (index !== -1) {
      this._research.splice(index, 1);
    }

    const ruleResearch = project.getRules();
    if (!project.isFinished() && ruleResearch.needItem?.() && ruleResearch.destroyItem?.()) {
      const name = ruleResearch.getName?.() || "";
      if (name.length > 0) {
        this.getStorageItems().addItem(name, 1);
      }
    }
  }

  getProductions(): ProductionLike[] {
    return this._productions;
  }

  setupDefenses(): void {
    this._defenses = [];
    for (const facility of this._facilities) {
      if (facility.getBuildTime() === 0 && facility.getRules().getDefenseValue() > 0) {
        this._defenses.push(facility);
      }
    }
    this._vehicles = [];
  }

  getDefenses(): BaseFacility[] {
    return this._defenses;
  }

  getVehicles(): unknown[] {
    return this._vehicles;
  }

  cleanupDefenses(_reclaimItems: boolean): void {
    this._defenses = [];
    this._vehicles = [];
  }

  addProduction(production: ProductionLike): void {
    this._productions.push(production);
  }

  removeProduction(production: ProductionLike): void {
    this._engineers += production.getAssignedEngineers?.() || 0;
    const index = this._productions.indexOf(production);
    if (index !== -1) {
      this._productions.splice(index, 1);
    }
  }

  getItems(): ItemContainer {
    return this._items;
  }

  getStorageItems(): ItemContainer {
    return this._items;
  }

  getScientists(): number {
    return this._scientists;
  }

  setScientists(scientists: number): void {
    this._scientists = scientists;
  }

  getEngineers(): number {
    return this._engineers;
  }

  setEngineers(engineers: number): void {
    this._engineers = engineers;
  }

  getTotalSoldiers(): number {
    let total = this._soldiers.length;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_SOLDIER) {
        total += transfer.getQuantity();
      }
    }
    return total;
  }

  getAvailableSoldiers(checkCombatReadiness = false): number {
    let total = 0;
    for (const soldier of this._soldiers) {
      const craft = soldier.getCraft();
      if (!checkCombatReadiness && craft === null) {
        ++total;
      } else if (checkCombatReadiness && ((craft !== null && craft.getStatus() !== "STR_OUT") || (craft === null && soldier.getWoundRecovery() === 0))) {
        ++total;
      }
    }
    return total;
  }

  getAvailableScientists(): number {
    return this.getScientists();
  }

  getTotalScientists(): number {
    let total = this._scientists;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_SCIENTIST) {
        total += transfer.getQuantity();
      }
    }
    for (const research of this._research) {
      total += research.getAssigned?.() || 0;
    }
    return total;
  }

  getAvailableEngineers(): number {
    return this.getEngineers();
  }

  getTotalEngineers(): number {
    let total = this._engineers;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_ENGINEER) {
        total += transfer.getQuantity();
      }
    }
    for (const production of this._productions) {
      total += production.getAssignedEngineers?.() || 0;
    }
    return total;
  }

  getUsedQuarters(): number {
    return this.getTotalSoldiers() + this.getTotalScientists() + this.getTotalEngineers();
  }

  getAvailableQuarters(): number {
    return this.getBuiltFacilityTotal(rules => rules.getPersonnel());
  }

  getUsedStores(): number {
    let total = this._items.getTotalSize(this._mod);
    for (const craft of this._crafts) {
      total += craft.getItems().getTotalSize(this._mod);
    }
    if (this._mod) {
      for (const transfer of this._transfers) {
        if (transfer.getType() === TransferType.TRANSFER_ITEM) {
          total += transfer.getQuantity() * (this._mod.getItem(transfer.getItems(), true)?.getSize() || 0);
        } else if (transfer.getType() === TransferType.TRANSFER_CRAFT) {
          total += transfer.getCraft()?.getItems().getTotalSize(this._mod) || 0;
        }
      }
    }
    return total;
  }

  storesOverfull(offset = 0.0): boolean {
    const capacity = this.getAvailableStores() * 100;
    const used = (this.getUsedStores() + offset) * 100;
    return Math.trunc(used) > capacity;
  }

  getAvailableStores(): number {
    return this.getBuiltFacilityTotal(rules => rules.getStorage());
  }

  getUsedLaboratories(): number {
    let usedLabSpace = 0;
    for (const research of this._research) {
      usedLabSpace += research.getAssigned?.() || 0;
    }
    return usedLabSpace;
  }

  getAvailableLaboratories(): number {
    return this.getBuiltFacilityTotal(rules => rules.getLaboratories());
  }

  getUsedWorkshops(): number {
    let usedWorkshop = 0;
    for (const production of this._productions) {
      const rules = production.getRules() as ProductionRulesLike;
      usedWorkshop += (production.getAssignedEngineers?.() || 0) + (rules.getRequiredSpace?.() || 0);
    }
    return usedWorkshop;
  }

  getAvailableWorkshops(): number {
    return this.getBuiltFacilityTotal(rules => rules.getWorkshops());
  }

  getUsedHangars(): number {
    let total = this._crafts.length;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_CRAFT) {
        total += transfer.getQuantity();
      }
    }
    for (const production of this._productions) {
      const rules = production.getRules() as ProductionRulesLike;
      if (rules.getCategory?.() === "STR_CRAFT") {
        total += (production.getAmountTotal?.() || 0) - (production.getAmountProduced?.() || 0);
      }
    }
    return total;
  }

  getCraftCount(craft: string): number {
    let total = 0;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_CRAFT && transfer.getCraft()?.getRules().getType() === craft) {
        ++total;
      }
    }
    for (const baseCraft of this._crafts) {
      if (baseCraft.getRules().getType() === craft) {
        ++total;
      }
    }
    return total;
  }

  getAvailableHangars(): number {
    return this.getBuiltFacilityTotal(rules => rules.getCrafts());
  }

  getFreeLaboratories(): number {
    return this.getAvailableLaboratories() - this.getUsedLaboratories();
  }

  getFreeWorkshops(): number {
    return this.getAvailableWorkshops() - this.getUsedWorkshops();
  }

  getAllocatedScientists(): number {
    let total = 0;
    for (const research of this._research) {
      total += research.getAssigned?.() || 0;
    }
    return total;
  }

  getAllocatedEngineers(): number {
    let total = 0;
    for (const production of this._productions) {
      total += production.getAssignedEngineers?.() || 0;
    }
    return total;
  }

  getAvailablePsiLabs(): number {
    return this.getBuiltFacilityTotal(rules => rules.getPsiLaboratories());
  }

  getUsedPsiLabs(): number {
    let total = 0;
    for (const soldier of this._soldiers) {
      if (soldier.isInPsiTraining()) {
        ++total;
      }
    }
    return total;
  }

  getFreePsiLabs(): number {
    return this.getAvailablePsiLabs() - this.getUsedPsiLabs();
  }

  getUsedContainment(): number {
    let total = 0;
    if (this._mod) {
      for (const [id, qty] of this._items.getContents()) {
        if (this._mod.getItem(id, true)?.isAlien()) {
          total += qty;
        }
      }
      for (const research of this._research) {
        const rules = research.getRules() as { needItem?: () => boolean; getName?: () => string };
        const name = rules.getName?.();
        if (rules.needItem?.() && name && this._mod.getUnit(name)) {
          ++total;
        }
      }
    }
    return total;
  }

  getAvailableContainment(): number {
    return this.getBuiltFacilityTotal(rules => rules.getAliens());
  }

  getFreeContainment(): number {
    return this.getAvailableContainment() - this.getUsedContainment();
  }

  getDefenseValue(): number {
    return this.getBuiltFacilityTotal(rules => rules.getDefenseValue());
  }

  getShortRangeDetection(): number {
    let total = 0;
    const minRadarRange = this._mod?.getMinRadarRange() || this.getLocalMinRadarRange();
    if (minRadarRange === 0) {
      return 0;
    }
    for (const facility of this._facilities) {
      if (facility.getRules().getRadarRange() === minRadarRange && facility.getBuildTime() === 0) {
        ++total;
      }
    }
    return total;
  }

  getLongRangeDetection(): number {
    let total = 0;
    const minRadarRange = this._mod?.getMinRadarRange() || this.getLocalMinRadarRange();
    for (const facility of this._facilities) {
      if (facility.getRules().getRadarRange() > minRadarRange && facility.getBuildTime() === 0) {
        ++total;
      }
    }
    return total;
  }

  detect(target: CoordinateTarget): number {
    let chance = 0;
    const distance = this.getDistance(target) * 60.0 * (180.0 / Math.PI);
    for (const facility of this._facilities) {
      const rules = facility.getRules();
      if (rules.getRadarRange() >= distance && facility.getBuildTime() === 0) {
        const radarChance = rules.getRadarChance();
        if (rules.isHyper()) {
          if (radarChance === 100 || RNG.percent(radarChance)) {
            return 2;
          }
        } else {
          chance += radarChance;
        }
      }
    }
    if (chance === 0) {
      return 0;
    }
    if (target instanceof Ufo) {
      chance = Math.trunc(chance * (100 + target.getVisibility()) / 100);
    }
    return RNG.percent(chance) ? 1 : 0;
  }

  insideRadarRange(target: CoordinateTarget): number {
    let insideRange = false;
    const distance = this.getDistance(target) * 60.0 * (180.0 / Math.PI);
    for (const facility of this._facilities) {
      const rules = facility.getRules();
      if (rules.getRadarRange() >= distance && facility.getBuildTime() === 0) {
        if (rules.isHyper()) {
          return 2;
        }
        insideRange = true;
      }
    }
    return insideRange ? 1 : 0;
  }

  getGravShields(): number {
    let total = 0;
    for (const facility of this._facilities) {
      if (facility.getBuildTime() === 0 && facility.getRules().isGrav()) {
        ++total;
      }
    }
    return total;
  }

  getCraftMaintenance(): number {
    let total = 0;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_CRAFT) {
        total += transfer.getCraft()?.getRules().getRentCost() || 0;
      }
    }
    for (const craft of this._crafts) {
      total += craft.getRules().getRentCost();
    }
    return total;
  }

  getSoldierCount(soldier: string): number {
    let total = 0;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_SOLDIER && transfer.getSoldier()?.getRules().getType() === soldier) {
        ++total;
      }
    }
    for (const baseSoldier of this._soldiers) {
      if (baseSoldier.getRules().getType() === soldier) {
        ++total;
      }
    }
    return total;
  }

  getPersonnelMaintenance(): number {
    let total = 0;
    for (const transfer of this._transfers) {
      if (transfer.getType() === TransferType.TRANSFER_SOLDIER) {
        total += transfer.getSoldier()?.getRules().getSalaryCost() || 0;
      }
    }
    for (const soldier of this._soldiers) {
      total += soldier.getRules().getSalaryCost();
    }
    total += this.getTotalEngineers() * (this._mod?.getEngineerCost() || 0);
    total += this.getTotalScientists() * (this._mod?.getScientistCost() || 0);
    return total;
  }

  getFacilityMaintenance(): number {
    return this.getBuiltFacilityTotal(rules => rules.getMonthlyCost());
  }

  getMonthlyMaintenace(): number {
    return this.getCraftMaintenance() + this.getPersonnelMaintenance() + this.getFacilityMaintenance();
  }

  destroyDisconnectedFacilities(): void {
    const disconnected = this.getDisconnectedFacilities(null);
    for (let i = disconnected.length - 1; i >= 0; --i) {
      this.destroyFacility(disconnected[i]);
    }
  }

  getDisconnectedFacilities(remove: BaseFacility | null = null): BaseFacility[] {
    const result: BaseFacility[] = [];

    if (remove && remove.getRules().isLift()) {
      for (const facility of this._facilities) {
        if (facility !== remove) {
          result.push(facility);
        }
      }
      return result;
    }

    const facilitiesConnStates: GridCell[] = [];
    const grid: Array<Array<GridCell | null>> = Array.from({ length: BASE_SIZE }, () => Array<GridCell | null>(BASE_SIZE).fill(null));
    let lift: BaseFacility | null = null;

    for (const facility of this._facilities) {
      if (facility === remove) {
        continue;
      }
      if (facility.getRules().isLift()) {
        lift = facility;
      }
      for (let x = 0; x !== facility.getRules().getSize(); ++x) {
        for (let y = 0; y !== facility.getRules().getSize(); ++y) {
          const gridX = facility.getX() + x;
          const gridY = facility.getY() + y;
          if (gridX < 0 || gridX >= BASE_SIZE || gridY < 0 || gridY >= BASE_SIZE) {
            continue;
          }
          const cell = { facility, connected: false };
          facilitiesConnStates.push(cell);
          grid[gridX][gridY] = cell;
        }
      }
    }

    if (!lift) {
      return result;
    }

    const stack: Array<[number, number]> = [[lift.getX(), lift.getY()]];
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const cell = x >= 0 && x < BASE_SIZE && y >= 0 && y < BASE_SIZE ? grid[x][y] : null;
      if (!cell || cell.connected) {
        continue;
      }
      cell.connected = true;
      const facility = cell.facility;
      const neighborLeft = x - 1 >= 0 ? grid[x - 1][y]?.facility || null : null;
      const neighborRight = x + 1 < BASE_SIZE ? grid[x + 1][y]?.facility || null : null;
      const neighborTop = y - 1 >= 0 ? grid[x][y - 1]?.facility || null : null;
      const neighborBottom = y + 1 < BASE_SIZE ? grid[x][y + 1]?.facility || null : null;

      if (this.canFloodTo(facility, neighborLeft)) stack.push([x - 1, y]);
      if (this.canFloodTo(facility, neighborRight)) stack.push([x + 1, y]);
      if (this.canFloodTo(facility, neighborTop)) stack.push([x, y - 1]);
      if (this.canFloodTo(facility, neighborBottom)) stack.push([x, y + 1]);
    }

    let lastFacility: BaseFacility | null = null;
    for (const cell of facilitiesConnStates) {
      if (cell.facility !== lastFacility && !cell.connected) {
        result.push(cell.facility);
      }
      lastFacility = cell.facility;
    }

    return result;
  }

  destroyFacility(facility: BaseFacility): void {
    const index = this._facilities.indexOf(facility);
    if (index === -1) {
      return;
    }

    if (facility.getRules().getCrafts() > 0) {
      const craft = facility.getCraft();
      if (craft) {
        for (const soldier of this._soldiers) {
          if (soldier.getCraft() === craft) {
            soldier.setCraft(null);
          }
        }
        for (const [id, qty] of [...craft.getItems().getContents()]) {
          this._items.addItem(id, qty);
          craft.getItems().removeItem(id, qty);
        }
        const craftIndex = this._crafts.indexOf(craft);
        if (craftIndex !== -1) {
          this._crafts.splice(craftIndex, 1);
        }
      } else {
        for (let i = 0; i < this._productions.length; ++i) {
          const production = this._productions[i];
          const rules = production.getRules() as ProductionRulesLike;
          if (this.getAvailableHangars() - this.getUsedHangars() - facility.getRules().getCrafts() < 0 && rules.getCategory?.() === "STR_CRAFT") {
            this._engineers += production.getAssignedEngineers?.() || 0;
            this._productions.splice(i, 1);
            break;
          }
        }
      }
    }

    if (facility.getRules().getPsiLaboratories() > 0) {
      let toRemove = facility.getRules().getPsiLaboratories() - this.getFreePsiLabs();
      for (const soldier of this._soldiers) {
        if (toRemove <= 0) {
          break;
        }
        if (soldier.isInPsiTraining()) {
          soldier.setPsiTraining(false);
          --toRemove;
        }
      }
    }

    if (facility.getRules().getLaboratories()) {
      let toRemove = facility.getRules().getLaboratories() - this.getFreeLaboratories();
      for (const research of this._research) {
        if (toRemove <= 0) {
          break;
        }
        const assigned = research.getAssigned?.() || 0;
        if (assigned >= toRemove) {
          research.setAssigned?.(assigned - toRemove);
          this._scientists += toRemove;
          break;
        }
        toRemove -= assigned;
        this._scientists += assigned;
        research.setAssigned?.(0);
      }
    }

    if (facility.getRules().getWorkshops()) {
      let toRemove = facility.getRules().getWorkshops() - this.getFreeWorkshops();
      for (let i = 0; i < this._productions.length && toRemove > 0;) {
        const production = this._productions[i];
        const assigned = production.getAssignedEngineers?.() || 0;
        if (assigned > toRemove) {
          production.setAssignedEngineers?.(assigned - toRemove);
          this._engineers += toRemove;
          break;
        }
        toRemove -= assigned;
        this._engineers += assigned;
        this._productions.splice(i, 1);
      }
    }

    this._facilities.splice(index, 1);
  }

  removeCraft(craft: Craft, unload = false): number {
    if (unload) {
      (craft as Craft & { unload?: (mod: Mod | null) => void }).unload?.(this._mod);
    }
    for (const facility of this._facilities) {
      if (facility.getCraft() === craft) {
        facility.setCraft(null);
        break;
      }
    }
    const index = this._crafts.indexOf(craft);
    if (index !== -1) {
      this._crafts.splice(index, 1);
    }
    return index;
  }

  private getDistance(target: CoordinateTarget): number {
    const lon = target.getLongitude();
    const lat = target.getLatitude();
    if (areSame(lon, this._lon) && areSame(lat, this._lat)) {
      return 0.0;
    }
    return clampAcos(Math.cos(this._lat) * Math.cos(lat) * Math.cos(lon - this._lon) + Math.sin(this._lat) * Math.sin(lat));
  }

  private getBuiltFacilityTotal(getter: (rules: RuleBaseFacility) => number): number {
    let total = 0;
    for (const facility of this._facilities) {
      if (facility.getBuildTime() === 0) {
        total += getter(facility.getRules());
      }
    }
    return total;
  }

  private canFloodTo(facility: BaseFacility, neighbor: BaseFacility | null): boolean {
    return facility.getBuildTime() === 0 ||
      (neighbor !== null && (neighbor === facility || neighbor.getBuildTime() > neighbor.getRules().getBuildTime()));
  }

  private getLocalMinRadarRange(): number {
    let minRadarRange = 0;
    for (const facility of this._facilities) {
      const radarRange = facility.getRules().getRadarRange();
      if (radarRange > 0 && (minRadarRange === 0 || minRadarRange > radarRange)) {
        minRadarRange = radarRange;
      }
    }
    return minRadarRange;
  }
}
