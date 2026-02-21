
import type { BaseSnapshot, CampaignSnapshot, Country, Region } from "../data/types";
import type { TacticalOutcome } from "../battlescape/TacticalSimulation";
import { translate } from "../ruleset/RulesetLoader";
import type { LoadedRuleset, SoldierRule } from "../ruleset/types";

interface ActiveResearchProject {
  id: string;
  cost: number;
  progress: number;
  assignedScientists: number;
}

interface ActiveManufactureProject {
  id: string;
  category: string;
  requiredTime: number;
  progressTime: number;
  assignedEngineers: number;
  targetUnits: number;
  producedUnits: number;
  unitCost: number;
  workshopSpace: number;
  requiredItems: Record<string, number>;
  reservedItems: Record<string, number>;
  status: "running" | "blocked-funds" | "blocked-items";
}

interface GeoscapeContact {
  id: string;
  type: string;
  size: "small" | "medium" | "large";
  headingDeg: number;
  speed: number;
  x: number;
  y: number;
  detected: boolean;
  status: "flying" | "landed" | "escaping";
  ttlHours: number;
}

interface InterceptorState {
  id: string;
  label: string;
  speed: number;
  fuelPct: number;
  damagePct: number;
  x: number;
  y: number;
  status: "ready" | "intercepting" | "returning" | "rearming";
  targetContactId: string | null;
}

interface GeoscapeMission {
  id: string;
  type: "ufo-landed" | "terror-site" | "alien-base";
  regionId: string;
  x: number;
  y: number;
  ttlHours: number;
  status: "active" | "resolved" | "expired";
  sourceContactId: string | null;
}

interface TransferOrder {
  id: string;
  kind: "scientist" | "engineer" | "soldier" | "item";
  itemId?: string;
  label: string;
  quantity: number;
  etaHours: number;
}

interface FacilityConstructionOrder {
  id: string;
  type: string;
  x: number;
  y: number;
  size: number;
  paid: number;
  monthlyCost: number;
  remainingHours: number;
  totalHours: number;
}

interface PendingGroundCombat {
  missionId: string;
  regionId: string;
  missionType: GeoscapeMission["type"] | "final-assault";
  craftKey: string;
}

interface StrategicOutcomeAlert {
  kind: "victory" | "defeat";
  title: string;
  detail: string;
}

interface MonthlyReport {
  monthIso: string;
  income: number;
  maintenance: number;
  salaries: number;
  scoreBonus: number;
  net: number;
  fundsAfter: number;
  rating: string;
  countryChanges: Array<{
    id: string;
    label: string;
    fundingBefore: number;
    fundingAfter: number;
    delta: number;
    satisfaction: number;
    pact: boolean;
  }>;
}

interface PersistedCampaign {
  version: 1;
  elapsedMinutes: number;
  lastProcessedMonth: number;
  funds: number;
  countries: Array<{ id: string; funding: number; satisfaction: number; pact: boolean }>;
  knownResearch: string[];
  activeResearch: ActiveResearchProject[];
  activeManufacture: ActiveManufactureProject[];
  baseRoster?: BaseSnapshot["roster"];
  baseCraftLoadout?: BaseSnapshot["craftLoadout"];
  baseStores: Array<{ id: string; quantity: number; unitCost: number }>;
  baseFacilities: Array<{ type: string; x: number; y: number; size: number }>;
  facilityQueue: FacilityConstructionOrder[];
  pendingGroundCombat: PendingGroundCombat | null;
  groundCombatReady: boolean;
  strategicVictoryReady: boolean;
  pendingStrategicOutcome: StrategicOutcomeAlert | null;
  deficitMonths: number;
  campaignLocked: boolean;
  contacts: GeoscapeContact[];
  interceptors: InterceptorState[];
  missions: GeoscapeMission[];
  transfers: TransferOrder[];
  geoscapeEvents: string[];
  geoscapeScore: number;
  contactCounter: number;
  missionCounter: number;
  transferCounter: number;
  spawnAccumulatorHours: number;
  monthlyReports: MonthlyReport[];
  stats?: CampaignStats;
  featuredMarketItemId: string;
  currentSaveSlot: number;
}

interface PersistedEnvelope {
  version: 1;
  savedAtIso: string;
  inGameDateIso: string;
  funds: number;
  data: PersistedCampaign;
}

export interface SaveSlotInfo {
  slot: number;
  savedAtIso: string;
  inGameDateIso: string;
  funds: number;
}

export interface ResearchTopicDetails {
  id: string;
  label: string;
  cost: number;
  points: number;
  requires: Array<{ id: string; label: string; known: boolean }>;
  needItem: boolean;
}

export interface ManufactureTopicDetails {
  id: string;
  label: string;
  category: string;
  time: number;
  cost: number;
  space: number;
  requires: Array<{ id: string; label: string; known: boolean }>;
  requiredItems: Array<{ id: string; label: string; quantity: number; inStore: number }>;
}

export interface MissionDebriefingSoldier {
  name: string;
  status: "active" | "wounded" | "kia";
  rankBefore: string;
  rankAfter: string;
  killsGained: number;
  statGain: {
    reactions: number;
    firing: number;
    throwing: number;
    tu: number;
    stamina: number;
    strength: number;
  };
}

export interface MissionDebriefingReport {
  missionLabel: string;
  success: boolean;
  aborted: boolean;
  lootCredits: number;
  scoreDelta: number;
  kia: number;
  wounded: number;
  promoted: number;
  soldiers: MissionDebriefingSoldier[];
}

interface CampaignStats {
  daysElapsed: number;
  ufoDetected: number;
  ufoDowned: number;
  interceptorSorties: number;
  interceptorDamaged: number;
  missionsLaunched: number;
  groundWins: number;
  groundLosses: number;
  groundAborts: number;
  soldiersKia: number;
  soldiersWounded: number;
  promotions: number;
  lootCredits: number;
}

export interface StrategicStatus {
  finalAssaultUnlocked: boolean;
  finalAssaultLaunchable: boolean;
  deficitMonths: number;
  pactCount: number;
  totalCountries: number;
}

export interface CampaignStatisticsSnapshot {
  daysElapsed: number;
  ufoDetected: number;
  ufoDowned: number;
  interceptorSorties: number;
  interceptorDamaged: number;
  missionsLaunched: number;
  groundWins: number;
  groundLosses: number;
  groundAborts: number;
  soldiersKia: number;
  soldiersWounded: number;
  promotions: number;
  lootCredits: number;
}

export type { StrategicOutcomeAlert };

export class CampaignModel {
  static readonly STORAGE_KEY_PREFIX = "openxcom-web-ts-campaign-v1";
  static readonly SLOT_COUNT = 3;
  static readonly AUTOSAVE_SLOT = 0;

  private readonly startTimeUtcMs: number;
  private elapsedMinutes = 0;
  private lastProcessedMonth = 1;
  private timeCompression = 1;

  private funds = 6_000_000;
  private readonly countries: Country[];
  private readonly regions: Region[];
  private readonly bases: BaseSnapshot[];

  private readonly gameId: LoadedRuleset["gameId"];
  private readonly language: LoadedRuleset["language"];
  private readonly researchRules: LoadedRuleset["research"];
  private readonly manufactureRules: LoadedRuleset["manufacture"];
  private readonly craftRulesByType: Map<string, NonNullable<LoadedRuleset["crafts"][number]>>;
  private readonly facilityRulesByType: Map<string, NonNullable<LoadedRuleset["facilities"][number]>>;
  private readonly facilityBuildCostByType: Map<string, number>;
  private readonly facilityMonthlyCostByType: Map<string, number>;
  private readonly facilitySizeByType: Map<string, number>;
  private readonly itemSizeByType: Map<string, number>;
  private readonly itemBuyCostByType: Map<string, number>;
  private readonly itemSellCostByType: Map<string, number>;
  private readonly marketItems: Array<{ id: string; label: string; buyCost: number; sellCost: number; size: number }>;
  private readonly soldierRule: SoldierRule | null;
  private readonly soldierSalary: number;
  private readonly scientistSalary = 30_000;
  private readonly engineerSalary = 25_000;
  private maintenanceMonthly = 0;

  private notices: string[] = [];
  private currentSaveSlot = 1;
  private autosaveHoursAccumulator = 0;

  private readonly knownResearch = new Set<string>();
  private activeResearch: ActiveResearchProject[] = [];
  private activeManufacture: ActiveManufactureProject[] = [];

  private contacts: GeoscapeContact[] = [];
  private interceptors: InterceptorState[] = [];
  private missions: GeoscapeMission[] = [];
  private transfers: TransferOrder[] = [];
  private geoscapeEvents: string[] = [];
  private geoscapeScore = 0;
  private contactCounter = 1;
  private missionCounter = 1;
  private transferCounter = 1;
  private facilityCounter = 1;
  private spawnAccumulatorHours = 0;
  private facilityQueue: FacilityConstructionOrder[] = [];
  private pendingGroundCombat: PendingGroundCombat | null = null;
  private groundCombatReady = false;
  private strategicVictoryReady = false;
  private pendingStrategicOutcome: StrategicOutcomeAlert | null = null;
  private deficitMonths = 0;
  private campaignLocked = false;

  private monthlyReports: MonthlyReport[] = [];
  private pendingCouncilReport: MonthlyReport | null = null;
  private featuredMarketItemId = "";
  private lastDebriefingReport: MissionDebriefingReport | null = null;
  private stats: CampaignStats = {
    daysElapsed: 0,
    ufoDetected: 0,
    ufoDowned: 0,
    interceptorSorties: 0,
    interceptorDamaged: 0,
    missionsLaunched: 0,
    groundWins: 0,
    groundLosses: 0,
    groundAborts: 0,
    soldiersKia: 0,
    soldiersWounded: 0,
    promotions: 0,
    lootCredits: 0
  };

  constructor(ruleset: LoadedRuleset) {
    const orderedCountries = this.orderRulesByIndex(ruleset.countries, ruleset.mergeMeta?.tableIndexes.countries, (rule) => rule.type);
    const orderedRegions = this.orderRulesByIndex(ruleset.regions, ruleset.mergeMeta?.tableIndexes.regions, (rule) => rule.type);
    const orderedFacilities = this.orderRulesByIndex(ruleset.facilities, ruleset.mergeMeta?.tableIndexes.facilities, (rule) => rule.type);
    const orderedCrafts = this.orderRulesByIndex(ruleset.crafts, ruleset.mergeMeta?.tableIndexes.crafts, (rule) => rule.type);
    const orderedItems = this.orderRulesByIndex(ruleset.items, ruleset.mergeMeta?.tableIndexes.items, (rule) => rule.type);
    const orderedResearch = this.orderRulesByIndex(ruleset.research, ruleset.mergeMeta?.tableIndexes.research, (rule) => rule.name);
    const orderedManufacture = this.orderRulesByIndex(ruleset.manufacture, ruleset.mergeMeta?.tableIndexes.manufacture, (rule) => rule.name);
    const orderedSoldiers = this.orderRulesByIndex(ruleset.soldiers, ruleset.mergeMeta?.tableIndexes.soldiers, (rule) => rule.type);

    this.gameId = ruleset.gameId;
    this.language = ruleset.language;
    this.researchRules = orderedResearch;
    this.manufactureRules = orderedManufacture;
    this.craftRulesByType = new Map(orderedCrafts.map((rule) => [rule.type, rule]));
    this.facilityRulesByType = new Map(orderedFacilities.map((rule) => [rule.type, rule]));
    this.facilityBuildCostByType = new Map(orderedFacilities.map((rule) => [rule.type, rule.buildCost ?? 0]));
    this.facilityMonthlyCostByType = new Map(orderedFacilities.map((rule) => [rule.type, rule.monthlyCost ?? 0]));
    this.facilitySizeByType = new Map(orderedFacilities.map((rule) => [rule.type, rule.size ?? 1]));
    this.itemSizeByType = new Map(orderedItems.map((rule) => [rule.type, rule.size ?? 0]));
    this.itemBuyCostByType = new Map(orderedItems.map((rule) => [rule.type, rule.costBuy ?? 0]));
    this.itemSellCostByType = new Map(orderedItems.map((rule) => [rule.type, rule.costSell ?? 0]));
    this.marketItems = orderedItems
      .filter((item) => (item.costBuy ?? 0) > 0 || (item.costSell ?? 0) > 0)
      .slice(0, 128)
      .map((item) => ({
        id: item.type,
        label: translate(ruleset.language, item.type),
        buyCost: item.costBuy ?? 0,
        sellCost: item.costSell ?? 0,
        size: item.size ?? 0
    }));
    this.featuredMarketItemId = this.marketItems[0]?.id ?? "";

    this.soldierRule = orderedSoldiers[0] ?? null;
    this.soldierSalary = this.soldierRule?.costSalary ?? 20_000;

    this.startTimeUtcMs = Date.UTC(1999, 0, 1, 0, 0, 0, 0);
    this.lastProcessedMonth = this.getDate().getUTCMonth() + 1;

    const baseCapacity = this.computeBaseCapacity(ruleset.startingBase.facilities.map((f) => f.type), this.facilityRulesByType);
    const soldierRoster = this.generateSoldiers(ruleset, ruleset.startingBase.randomSoldiers);

    this.countries = orderedCountries.map((country) => ({
      id: country.type,
      label: translate(ruleset.language, country.type),
      funding: country.fundingBase * 1000,
      cap: country.fundingCap * 1000,
      satisfaction: 55 + Math.floor(Math.random() * 21),
      pact: false
    }));

    this.regions = orderedRegions.map((region) => ({
      id: region.type,
      label: translate(ruleset.language, region.type),
      monthlyCost: region.cost,
      weight: region.regionWeight
    }));

    const base: BaseSnapshot = {
      name: "XCOM HQ",
      scientists: ruleset.startingBase.scientists,
      engineers: ruleset.startingBase.engineers,
      soldiers: soldierRoster.length,
      roster: soldierRoster,
      capacity: baseCapacity,
      usage: {
        personnel: 0,
        labs: 0,
        workshops: 0,
        storage: 0,
        hangars: 0,
        alienContainment: 0
      },
      crafts: ruleset.startingBase.crafts.length,
      craftLoadout: ruleset.startingBase.crafts.map((craft, index) => {
        const craftRule = this.craftRulesByType.get(craft.type);
        const soldierSlots = Math.max(4, craftRule?.soldiers ?? (craft.type === "STR_SKYRANGER" ? 14 : 8));
        return {
          key: `${craft.type}#${index + 1}`,
          id: craft.type,
          label: translate(ruleset.language, craft.type),
          status: craft.status ?? "STR_READY",
          fuel: craft.fuel,
          damage: craft.damage,
          etaHours: 0,
          rearmHours: 0,
          soldierSlots,
          assignedSoldiers: 0,
          weapons: (craft.weapons ?? []).map((weapon) => ({
            id: weapon.type,
            label: translate(ruleset.language, weapon.type),
            ammo: weapon.ammo
          })),
          items: Object.entries(craft.items ?? {}).map(([id, quantity]) => ({
            id,
            label: translate(ruleset.language, id),
            quantity
          }))
        };
      }),
      stores: Object.entries(ruleset.startingBase.items ?? {}).map(([id, quantity]) => ({
        id,
        label: translate(ruleset.language, id),
        quantity,
        unitCost: this.itemBuyCostByType.get(id) ?? 0
      })),
      transfers: [],
      market: {
        items: this.marketItems,
        featuredItemId: this.featuredMarketItemId
      },
      facilities: ruleset.startingBase.facilities.map((facility) => ({
        id: `${facility.type}-${facility.x}-${facility.y}`,
        type: facility.type,
        label: translate(ruleset.language, facility.type),
        x: facility.x,
        y: facility.y,
        size: this.facilitySizeByType.get(facility.type) ?? 1
      })),
      facilityConstruction: {
        available: [],
        queue: []
      },
      research: {
        known: [],
        available: [],
        lockedPreview: [],
        active: [],
        freeScientists: ruleset.startingBase.scientists
      },
      manufacture: {
        available: [],
        lockedPreview: [],
        active: [],
        freeEngineers: ruleset.startingBase.engineers,
        usedWorkshopSpace: 0
      },
      notices: []
    };

    const primaryTransport = this.selectPrimaryTransport(base);
    if (primaryTransport) {
      for (const soldier of base.roster.slice(0, primaryTransport.soldierSlots)) {
        soldier.craftAssignment = primaryTransport.key;
      }
    }

    this.bases = [base];

    this.interceptors = this.selectInterceptorCrafts(base).map((craft, index) => ({
        id: `INT-${index + 1}`,
        label: craft.label,
        speed: 2.0,
        fuelPct: Math.max(10, Math.min(100, Math.round((craft.fuel / 1000) * 100))),
        damagePct: 0,
        x: 0.52,
        y: 0.42,
        status: "ready" as const,
        targetContactId: null
      }));

    this.recomputeMaintenance(base);
    this.refreshBaseComputedState(base);
    this.funds -= this.maintenanceMonthly;
  }

  static hasSavedCampaign(gameId: LoadedRuleset["gameId"], slot?: number): boolean {
    if (typeof localStorage === "undefined") return false;
    if (typeof slot === "number") return localStorage.getItem(CampaignModel.slotKey(gameId, slot)) !== null;
    for (let i = 1; i <= CampaignModel.SLOT_COUNT; i += 1) {
      if (localStorage.getItem(CampaignModel.slotKey(gameId, i)) !== null) return true;
    }
    return localStorage.getItem(CampaignModel.slotKey(gameId, CampaignModel.AUTOSAVE_SLOT)) !== null;
  }

  static listSaveSlots(gameId: LoadedRuleset["gameId"]): SaveSlotInfo[] {
    if (typeof localStorage === "undefined") return [];
    const slots: SaveSlotInfo[] = [];
    for (let i = 0; i <= CampaignModel.SLOT_COUNT; i += 1) {
      const raw = localStorage.getItem(CampaignModel.slotKey(gameId, i));
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as PersistedEnvelope | PersistedCampaign;
        if (parsed.version !== 1) continue;
        const envelope = "data" in parsed ? parsed : {
          version: 1 as const,
          savedAtIso: new Date(0).toISOString(),
          inGameDateIso: new Date(0).toISOString(),
          funds: parsed.funds,
          data: parsed
        };
        slots.push({
          slot: i,
          savedAtIso: envelope.savedAtIso,
          inGameDateIso: envelope.inGameDateIso,
          funds: envelope.funds
        });
      } catch {
        // ignore
      }
    }
    return slots.sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));
  }

  static loadFromStorage(ruleset: LoadedRuleset, slot?: number): CampaignModel | null {
    if (typeof localStorage === "undefined") return null;
    const chosenSlot = typeof slot === "number"
      ? slot
      : (CampaignModel.listSaveSlots(ruleset.gameId)[0]?.slot ?? CampaignModel.AUTOSAVE_SLOT);
    const raw = localStorage.getItem(CampaignModel.slotKey(ruleset.gameId, chosenSlot));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as PersistedEnvelope | PersistedCampaign;
      if (parsed.version !== 1) return null;
      const envelope = "data" in parsed ? parsed : {
        version: 1 as const,
        savedAtIso: new Date(0).toISOString(),
        inGameDateIso: new Date(0).toISOString(),
        funds: parsed.funds,
        data: parsed
      };
      const campaign = new CampaignModel(ruleset);
      campaign.currentSaveSlot = chosenSlot === 0 ? 1 : chosenSlot;
      campaign.applyPersisted(envelope.data);
      return campaign;
    } catch {
      return null;
    }
  }

  setSaveSlot(slot: number): void {
    if (slot < 1 || slot > CampaignModel.SLOT_COUNT) return;
    this.currentSaveSlot = slot;
    this.refreshBaseComputedState(this.bases[0]);
  }

  getSaveSlot(): number {
    return this.currentSaveSlot;
  }

  setFeaturedMarketItem(itemId: string): void {
    if (!this.marketItems.some((item) => item.id === itemId)) return;
    this.featuredMarketItemId = itemId;
    this.refreshBaseComputedState(this.bases[0]);
  }

  saveToStorage(slot = this.currentSaveSlot): void {
    if (typeof localStorage === "undefined") return;

    const payload: PersistedCampaign = {
      version: 1,
      elapsedMinutes: this.elapsedMinutes,
      lastProcessedMonth: this.lastProcessedMonth,
      funds: this.funds,
      countries: this.countries.map((country) => ({
        id: country.id,
        funding: country.funding,
        satisfaction: country.satisfaction,
        pact: country.pact
      })),
      knownResearch: Array.from(this.knownResearch),
      activeResearch: this.activeResearch,
      activeManufacture: this.activeManufacture,
      baseRoster: this.bases[0].roster,
      baseCraftLoadout: this.bases[0].craftLoadout,
      baseStores: this.bases[0].stores.map((item) => ({ id: item.id, quantity: item.quantity, unitCost: item.unitCost })),
      baseFacilities: this.bases[0].facilities.map((facility) => ({
        type: facility.type,
        x: facility.x,
        y: facility.y,
        size: facility.size
      })),
      facilityQueue: this.facilityQueue,
      pendingGroundCombat: this.pendingGroundCombat,
      groundCombatReady: this.groundCombatReady,
      strategicVictoryReady: this.strategicVictoryReady,
      pendingStrategicOutcome: this.pendingStrategicOutcome,
      deficitMonths: this.deficitMonths,
      campaignLocked: this.campaignLocked,
      stats: this.stats,
      contacts: this.contacts,
      interceptors: this.interceptors,
      missions: this.missions,
      transfers: this.transfers,
      geoscapeEvents: this.geoscapeEvents,
      geoscapeScore: this.geoscapeScore,
      contactCounter: this.contactCounter,
      missionCounter: this.missionCounter,
      transferCounter: this.transferCounter,
      spawnAccumulatorHours: this.spawnAccumulatorHours,
      monthlyReports: this.monthlyReports,
      featuredMarketItemId: this.featuredMarketItemId,
      currentSaveSlot: this.currentSaveSlot
    };

    const envelope: PersistedEnvelope = {
      version: 1,
      savedAtIso: new Date().toISOString(),
      inGameDateIso: this.getDate().toISOString(),
      funds: this.funds,
      data: payload
    };
    localStorage.setItem(CampaignModel.slotKey(this.gameId, slot), JSON.stringify(envelope));
    if (slot > 0) this.pushNotice(`Campaign saved to slot ${slot}.`);
  }

  clearSavedCampaign(slot = this.currentSaveSlot): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(CampaignModel.slotKey(this.gameId, slot));
    this.pushNotice(`Save slot ${slot} cleared.`);
  }

  setTimeCompression(speed: number): void {
    this.timeCompression = speed;
  }

  advance(dtMs: number): void {
    if (this.campaignLocked) return;
    const minutesPerSecond = this.timeCompression;
    this.elapsedMinutes += (dtMs / 1000) * minutesPerSecond;
    this.stats.daysElapsed = Math.floor(this.elapsedMinutes / (60 * 24));

    const hoursAdvanced = (dtMs / 1000) * this.timeCompression / 60;
    if (hoursAdvanced > 0) {
      this.advanceGeoscape(hoursAdvanced);
      this.advanceCraftOperations(hoursAdvanced);
      this.advanceTransfers(hoursAdvanced);
      this.advanceWoundRecovery(hoursAdvanced);
      this.advanceFacilityConstruction(hoursAdvanced);
      this.advanceResearch(hoursAdvanced);
      this.advanceManufacture(hoursAdvanced);
      this.refreshBaseComputedState(this.bases[0]);

      this.autosaveHoursAccumulator += hoursAdvanced;
      if (this.autosaveHoursAccumulator >= 24) {
        this.autosaveHoursAccumulator = 0;
        this.saveToStorage(CampaignModel.AUTOSAVE_SLOT);
      }
    }

    this.applyMonthlyTransitions();
  }

  getSnapshot(): CampaignSnapshot {
    const base = this.bases[0];
    const projected = this.computeMonthlyProjection(base);

    return {
      dateIsoUtc: this.getDate().toISOString(),
      funds: this.funds,
      monthlyIncome: this.getMonthlyIncome(),
      countries: this.countries,
      regions: this.regions,
      bases: this.bases,
      geoscape: {
        score: this.geoscapeScore,
        contacts: this.contacts.map((c) => ({
          id: c.id,
          type: c.type,
          size: c.size,
          headingDeg: c.headingDeg,
          speed: c.speed,
          x: c.x,
          y: c.y,
          detected: c.detected,
          status: c.status
        })),
        interceptors: this.interceptors.map((i) => ({
          id: i.id,
          label: i.label,
          speed: i.speed,
          fuelPct: i.fuelPct,
          damagePct: i.damagePct,
          x: i.x,
          y: i.y,
          status: i.status,
          targetContactId: i.targetContactId
        })),
        missions: this.missions.map((m) => ({
          id: m.id,
          type: m.type,
          regionId: m.regionId,
          regionLabel: this.regions.find((r) => r.id === m.regionId)?.label ?? m.regionId,
          x: m.x,
          y: m.y,
          ttlHours: m.ttlHours,
          status: m.status,
          sourceContactId: m.sourceContactId
        })),
        events: this.geoscapeEvents.slice(-10)
      },
      economy: {
        monthlyReports: this.monthlyReports.slice(-6),
        projected
      }
    };
  }

  getGameId(): LoadedRuleset["gameId"] {
    return this.gameId;
  }

  private orderRulesByIndex<T>(
    items: readonly T[],
    index: readonly string[] | undefined,
    getId: (item: T) => string
  ): T[] {
    if (!index || index.length === 0) {
      return [...items];
    }

    const byId = new Map(items.map((item) => [getId(item), item] as const));
    const ordered: T[] = [];
    const seen = new Set<string>();

    for (const id of index) {
      const entry = byId.get(id);
      if (!entry) continue;
      ordered.push(entry);
      seen.add(id);
    }

    for (const item of items) {
      const id = getId(item);
      if (seen.has(id)) continue;
      ordered.push(item);
    }

    return ordered;
  }

  consumeNotices(): string[] {
    const out = [...this.notices];
    this.notices = [];
    this.bases[0].notices = [];
    return out;
  }

  hireScientists(count: number): void {
    this.placeStaffTransfer("scientist", count, 72, this.scientistSalary * 0.5, "Scientists");
  }

  hireEngineers(count: number): void {
    this.placeStaffTransfer("engineer", count, 72, this.engineerSalary * 0.5, "Engineers");
  }

  hireSoldiers(count: number): void {
    const buyCost = this.soldierRule?.costBuy ?? 40_000;
    this.placeStaffTransfer("soldier", count, 48, buyCost, "Soldiers");
  }

  orderItem(itemId: string, count: number): void {
    const quantity = Math.max(1, count);
    const buyCost = this.itemBuyCostByType.get(itemId) ?? 0;
    if (buyCost <= 0) {
      this.pushNotice("Item cannot be purchased.");
      return;
    }
    const total = buyCost * quantity;
    if (this.funds < total) {
      this.pushNotice("Insufficient funds for order.");
      return;
    }

    this.funds -= total;
    this.transfers.push({
      id: `TR-${this.transferCounter++}`,
      kind: "item",
      itemId,
      label: translate(this.language, itemId),
      quantity,
      etaHours: 48
    });
    this.pushNotice(`Ordered ${quantity} x ${translate(this.language, itemId)}.`);
    this.refreshBaseComputedState(this.bases[0]);
  }

  sellItem(itemId: string, count: number): void {
    const base = this.bases[0];
    const store = base.stores.find((item) => item.id === itemId);
    if (!store) {
      this.pushNotice("No such item in stores.");
      return;
    }
    const quantity = Math.min(store.quantity, Math.max(1, count));
    if (quantity <= 0) return;

    const sell = this.itemSellCostByType.get(itemId) ?? Math.floor((store.unitCost || 0) * 0.5);
    this.funds += sell * quantity;
    store.quantity -= quantity;
    if (store.quantity <= 0) {
      base.stores = base.stores.filter((item) => item.id !== itemId);
    }
    this.pushNotice(`Sold ${quantity} x ${translate(this.language, itemId)}.`);
    this.refreshBaseComputedState(base);
  }

  cancelTransfer(transferId: string): void {
    const before = this.transfers.length;
    this.transfers = this.transfers.filter((transfer) => transfer.id !== transferId);
    if (before !== this.transfers.length) {
      this.pushNotice(`Transfer ${transferId} canceled.`);
      this.refreshBaseComputedState(this.bases[0]);
    }
  }

  transferStoreItemToCraft(craftKey: string, itemId: string, count: number): void {
    const base = this.bases[0];
    const craft = base.craftLoadout.find((entry) => entry.key === craftKey);
    if (!craft) return;
    if (["STR_OUTBOUND", "STR_ON_MISSION", "STR_RETURNING"].includes(craft.status)) {
      this.pushNotice("Craft is unavailable for loadout changes.");
      return;
    }

    const store = base.stores.find((entry) => entry.id === itemId);
    if (!store || store.quantity <= 0) {
      this.pushNotice("No such item in base stores.");
      return;
    }

    const quantity = Math.min(store.quantity, Math.max(1, count));
    store.quantity -= quantity;
    if (store.quantity <= 0) {
      base.stores = base.stores.filter((entry) => entry.id !== itemId);
    }

    const craftItem = craft.items.find((entry) => entry.id === itemId);
    if (craftItem) craftItem.quantity += quantity;
    else {
      craft.items.push({
        id: itemId,
        label: translate(this.language, itemId),
        quantity
      });
    }
    this.pushNotice(`Loaded ${quantity} x ${translate(this.language, itemId)} to ${craft.label}.`);
    this.refreshBaseComputedState(base);
  }

  transferCraftItemToStore(craftKey: string, itemId: string, count: number): void {
    const base = this.bases[0];
    const craft = base.craftLoadout.find((entry) => entry.key === craftKey);
    if (!craft) return;
    if (["STR_OUTBOUND", "STR_ON_MISSION", "STR_RETURNING"].includes(craft.status)) {
      this.pushNotice("Craft is unavailable for loadout changes.");
      return;
    }

    const craftItem = craft.items.find((entry) => entry.id === itemId);
    if (!craftItem || craftItem.quantity <= 0) {
      this.pushNotice("Craft does not carry that item.");
      return;
    }

    const quantity = Math.min(craftItem.quantity, Math.max(1, count));
    craftItem.quantity -= quantity;
    if (craftItem.quantity <= 0) {
      craft.items = craft.items.filter((entry) => entry.id !== itemId);
    }

    const store = base.stores.find((entry) => entry.id === itemId);
    if (store) store.quantity += quantity;
    else {
      base.stores.push({
        id: itemId,
        label: translate(this.language, itemId),
        quantity,
        unitCost: this.itemBuyCostByType.get(itemId) ?? 0
      });
    }
    this.pushNotice(`Unloaded ${quantity} x ${translate(this.language, itemId)} from ${craft.label}.`);
    this.refreshBaseComputedState(base);
  }

  startFacilityConstruction(type: string): boolean {
    const base = this.bases[0];
    const rule = this.facilityRulesByType.get(type);
    if (!rule) {
      this.pushNotice("Unknown facility.");
      return false;
    }

    const size = rule.size ?? 1;
    const buildCost = this.facilityBuildCostByType.get(type) ?? 0;
    const monthlyCost = this.facilityMonthlyCostByType.get(type) ?? 0;
    const buildHours = this.estimateFacilityBuildHours(rule);

    if (buildCost <= 0 || buildHours <= 0) {
      this.pushNotice("Facility cannot be built.");
      return false;
    }
    if (this.funds < buildCost) {
      this.pushNotice("Insufficient funds for facility.");
      return false;
    }

    const slot = this.findFreeFacilitySlot(base, size);
    if (!slot) {
      this.pushNotice("No free base grid space.");
      return false;
    }

    this.funds -= buildCost;
    this.facilityQueue.push({
      id: `FC-${this.facilityCounter++}`,
      type,
      x: slot.x,
      y: slot.y,
      size,
      paid: buildCost,
      monthlyCost,
      remainingHours: buildHours,
      totalHours: buildHours
    });
    this.pushNotice(`Construction started: ${translate(this.language, type)}.`);
    this.refreshBaseComputedState(base);
    return true;
  }

  cancelFacilityConstruction(orderId: string): void {
    const base = this.bases[0];
    const index = this.facilityQueue.findIndex((entry) => entry.id === orderId);
    if (index < 0) return;

    const order = this.facilityQueue[index];
    const progress = 1 - order.remainingHours / Math.max(1, order.totalHours);
    const refund = Math.round(order.paid * Math.max(0.25, 0.8 - progress * 0.5));
    this.funds += refund;
    this.facilityQueue.splice(index, 1);
    this.pushNotice(`Construction canceled: ${translate(this.language, order.type)}.`);
    this.refreshBaseComputedState(base);
  }

  cycleSoldierCraftAssignment(soldierName: string): void {
    const base = this.bases[0];
    const soldier = base.roster.find((entry) => entry.name === soldierName);
    if (!soldier) return;
    if (soldier.woundHours > 0) {
      this.pushNotice("Wounded soldiers cannot be assigned.");
      return;
    }

    const craftKeys = base.craftLoadout.map((craft) => craft.key);
    if (craftKeys.length === 0) {
      soldier.craftAssignment = null;
      this.refreshBaseComputedState(base);
      return;
    }

    const currentIndex = soldier.craftAssignment ? craftKeys.findIndex((key) => key === soldier.craftAssignment) : -1;
    for (let offset = 1; offset <= craftKeys.length + 1; offset += 1) {
      const nextIndex = currentIndex + offset;
      if (nextIndex >= craftKeys.length) {
        soldier.craftAssignment = null;
        this.refreshBaseComputedState(base);
        return;
      }

      const craft = base.craftLoadout[nextIndex];
      if (!craft) continue;
      const assigned = base.roster.filter((entry) => entry.craftAssignment === craft.key && entry.name !== soldier.name).length;
      if (assigned < craft.soldierSlots) {
        soldier.craftAssignment = craft.key;
        this.refreshBaseComputedState(base);
        return;
      }
    }
  }

  getBattleDeployment(maxSoldiers = 8): BaseSnapshot["roster"] {
    const base = this.bases[0];
    const healthy = base.roster.filter((soldier) => soldier.woundHours <= 0);
    const missionCraftKey = this.pendingGroundCombat?.craftKey ?? null;
    const assigned = missionCraftKey
      ? healthy.filter((soldier) => soldier.craftAssignment === missionCraftKey)
      : healthy.filter((soldier) => soldier.craftAssignment !== null);
    const primaryPool = assigned.length > 0 ? assigned : healthy;
    return primaryPool.slice(0, Math.max(1, maxSoldiers));
  }

  startResearch(topicId: string): boolean {
    if (this.knownResearch.has(topicId)) return false;
    if (this.activeResearch.some((p) => p.id === topicId)) return false;

    const rule = this.researchRules.find((r) => r.name === topicId);
    if (!rule) return false;

    const missing = (rule.requires ?? []).filter((dep) => !this.knownResearch.has(dep));
    if ((rule.needItem ?? false) || missing.length > 0) return false;

    this.activeResearch.push({
      id: topicId,
      cost: rule.cost,
      progress: 0,
      assignedScientists: 0
    });

    this.refreshBaseComputedState(this.bases[0]);
    return true;
  }

  adjustResearchScientists(topicId: string, delta: number): void {
    const project = this.activeResearch.find((p) => p.id === topicId);
    if (!project) return;

    const base = this.bases[0];
    const currentlyAssigned = this.activeResearch.reduce((sum, p) => sum + p.assignedScientists, 0);
    const freeScientists = Math.max(0, base.scientists - currentlyAssigned);
    const freeLabs = Math.max(0, base.capacity.labs - currentlyAssigned);
    const free = Math.min(freeScientists, freeLabs);

    if (delta > 0) {
      const add = Math.min(delta, free);
      project.assignedScientists += add;
    } else if (delta < 0) {
      project.assignedScientists = Math.max(0, project.assignedScientists + delta);
    }

    this.refreshBaseComputedState(base);
  }

  cancelResearch(topicId: string): void {
    const before = this.activeResearch.length;
    this.activeResearch = this.activeResearch.filter((p) => p.id !== topicId);
    if (before !== this.activeResearch.length) {
      this.pushNotice(`Research canceled: ${translate(this.language, topicId)}.`);
      this.refreshBaseComputedState(this.bases[0]);
    }
  }

  startManufacture(projectId: string): boolean {
    const rule = this.manufactureRules.find((m) => m.name === projectId);
    if (!rule) return false;

    const missing = (rule.requires ?? []).filter((dep) => !this.knownResearch.has(dep));
    if (missing.length > 0) return false;
    if (this.activeManufacture.some((p) => p.id === projectId)) return false;

    const usedSpace = this.activeManufacture.reduce((sum, p) => sum + p.workshopSpace, 0);
    const freeSpace = Math.max(0, this.bases[0].capacity.workshops - usedSpace);
    if (rule.space > freeSpace) {
      this.pushNotice("Not enough free workshop space.");
      return false;
    }

    const reserve = this.reserveItemsForUnits(this.bases[0], rule.requiredItems ?? {}, 1);
    if (!reserve.ok) {
      this.pushNotice(`Cannot start manufacture: missing ${translate(this.language, reserve.missingItemId ?? "STR_ITEM")}.`);
      return false;
    }

    this.activeManufacture.push({
      id: projectId,
      category: rule.category,
      requiredTime: rule.time,
      progressTime: 0,
      assignedEngineers: 0,
      targetUnits: 1,
      producedUnits: 0,
      unitCost: rule.cost,
      workshopSpace: rule.space,
      requiredItems: { ...(rule.requiredItems ?? {}) },
      reservedItems: reserve.reservedItems,
      status: "running"
    });

    this.refreshBaseComputedState(this.bases[0]);
    return true;
  }

  adjustManufactureEngineers(projectId: string, delta: number): void {
    const project = this.activeManufacture.find((p) => p.id === projectId);
    if (!project) return;

    const base = this.bases[0];
    const currentlyAssigned = this.activeManufacture.reduce((sum, p) => sum + p.assignedEngineers, 0);
    const free = Math.max(0, base.engineers - currentlyAssigned);

    if (delta > 0) {
      const add = Math.min(delta, free);
      project.assignedEngineers = Math.min(project.workshopSpace, project.assignedEngineers + add);
    } else if (delta < 0) {
      project.assignedEngineers = Math.max(0, project.assignedEngineers + delta);
    }

    this.refreshBaseComputedState(base);
  }

  adjustManufactureTarget(projectId: string, delta: number): void {
    const project = this.activeManufacture.find((p) => p.id === projectId);
    if (!project || delta === 0) return;

    const base = this.bases[0];
    if (delta > 0) {
      const reserve = this.reserveItemsForUnits(base, project.requiredItems, delta);
      if (!reserve.ok) {
        this.pushNotice(`Cannot increase target: missing ${translate(this.language, reserve.missingItemId ?? "STR_ITEM")}.`);
        return;
      }
      project.targetUnits += delta;
      for (const [id, qty] of Object.entries(reserve.reservedItems)) {
        project.reservedItems[id] = (project.reservedItems[id] ?? 0) + qty;
      }
    } else {
      const maxDecrease = project.targetUnits - (project.producedUnits + 1);
      const actualDecrease = Math.min(Math.abs(delta), Math.max(0, maxDecrease));
      if (actualDecrease <= 0) return;
      this.releaseItemsForUnits(base, project.requiredItems, actualDecrease, project.reservedItems);
      project.targetUnits -= actualDecrease;
    }

    this.refreshBaseComputedState(base);
  }

  cancelManufacture(projectId: string): void {
    const base = this.bases[0];
    const project = this.activeManufacture.find((p) => p.id === projectId);
    if (!project) return;
    this.releaseRemainingReserved(base, project.reservedItems);
    this.activeManufacture = this.activeManufacture.filter((p) => p.id !== projectId);
    this.pushNotice(`Manufacture canceled: ${translate(this.language, projectId)}.`);
    this.refreshBaseComputedState(base);
  }

  getResearchTopicDetails(topicId: string): ResearchTopicDetails | null {
    const rule = this.researchRules.find((r) => r.name === topicId);
    if (!rule) return null;
    return {
      id: rule.name,
      label: translate(this.language, rule.name),
      cost: rule.cost,
      points: rule.points,
      needItem: rule.needItem ?? false,
      requires: (rule.requires ?? []).map((id) => ({
        id,
        label: translate(this.language, id),
        known: this.knownResearch.has(id)
      }))
    };
  }

  getManufactureTopicDetails(topicId: string): ManufactureTopicDetails | null {
    const rule = this.manufactureRules.find((m) => m.name === topicId);
    if (!rule) return null;
    const base = this.bases[0];
    return {
      id: rule.name,
      label: translate(this.language, rule.name),
      category: translate(this.language, rule.category),
      time: rule.time,
      cost: rule.cost,
      space: rule.space,
      requires: (rule.requires ?? []).map((id) => ({
        id,
        label: translate(this.language, id),
        known: this.knownResearch.has(id)
      })),
      requiredItems: Object.entries(rule.requiredItems ?? {}).map(([id, quantity]) => ({
        id,
        label: translate(this.language, id),
        quantity,
        inStore: base.stores.find((store) => store.id === id)?.quantity ?? 0
      }))
    };
  }

  issueIntercept(contactId: string, interceptorId?: string): boolean {
    if (this.campaignLocked) return false;
    const contact = this.contacts.find((c) => c.id === contactId && c.detected);
    if (!contact) return false;

    const interceptor = interceptorId
      ? this.interceptors.find((i) => i.id === interceptorId)
      : this.interceptors.find((i) => i.status === "ready");
    if (!interceptor) {
      this.pushNotice("No interceptor available.");
      return false;
    }
    if (interceptor.status !== "ready") {
      this.pushNotice("Interceptor not ready.");
      return false;
    }
    if (interceptor.fuelPct < 10) {
      this.pushNotice("Interceptor fuel too low.");
      return false;
    }
    if (interceptor.damagePct >= 65) {
      this.pushNotice("Interceptor too damaged.");
      return false;
    }

    interceptor.status = "intercepting";
    interceptor.targetContactId = contact.id;
    this.stats.interceptorSorties += 1;
    this.pushGeoscapeEvent(`Interceptor ${interceptor.id} scrambled for ${contact.id}.`);
    return true;
  }

  recallInterceptor(interceptorId: string): void {
    if (this.campaignLocked) return;
    const interceptor = this.interceptors.find((i) => i.id === interceptorId);
    if (!interceptor) return;
    interceptor.targetContactId = null;
    interceptor.status = "returning";
    this.pushGeoscapeEvent(`Interceptor ${interceptor.id} recalled.`);
  }

  resolveMission(missionId: string, success: boolean): void {
    if (this.campaignLocked) return;
    const mission = this.missions.find((m) => m.id === missionId && m.status === "active");
    if (!mission) return;

    mission.status = "resolved";
    if (success) {
      this.applyRegionalImpact(mission.regionId, 250, -12, `Mission ${mission.id} succeeded.`);
      this.funds += 75_000;
      this.pushGeoscapeEvent(`Mission ${mission.id} resolved successfully.`);
    } else {
      this.applyRegionalImpact(mission.regionId, -180, 10, `Mission ${mission.id} failed.`);
      this.pushGeoscapeEvent(`Mission ${mission.id} failed.`);
    }

    this.missions = this.missions.filter((m) => m.status === "active");
  }

  launchMissionAssault(missionId: string): boolean {
    if (this.campaignLocked) return false;
    if (this.pendingGroundCombat) {
      this.pushNotice("Another ground mission is already in progress.");
      return false;
    }

    const mission = this.missions.find((entry) => entry.id === missionId && entry.status === "active");
    if (!mission) {
      this.pushNotice("Mission no longer available.");
      return false;
    }

    const base = this.bases[0];
    const healthyAssigned = base.roster.filter((soldier) => soldier.woundHours <= 0 && soldier.craftAssignment !== null);
    const readyCraft = base.craftLoadout.find((craft) => {
      if (craft.status !== "STR_READY") return false;
      const assigned = healthyAssigned.filter((soldier) => soldier.craftAssignment === craft.key).length;
      return assigned > 0 && craft.fuel >= 200;
    });
    if (!readyCraft) {
      this.pushNotice("No ready transport with assigned healthy soldiers.");
      return false;
    }

    readyCraft.status = "STR_OUTBOUND";
    readyCraft.etaHours = 4 + Math.random() * 3;
    readyCraft.fuel = Math.max(0, readyCraft.fuel - 180);
    readyCraft.damage = Math.max(0, readyCraft.damage + Math.floor(Math.random() * 4));

    this.pendingGroundCombat = {
      missionId: mission.id,
      regionId: mission.regionId,
      missionType: mission.type,
      craftKey: readyCraft.key
    };
    this.stats.missionsLaunched += 1;
    this.groundCombatReady = false;
    this.pushGeoscapeEvent(`${readyCraft.label} launched for ${mission.id}.`);
    this.refreshBaseComputedState(base);
    return true;
  }

  consumeGroundCombatReady(): boolean {
    if (!this.groundCombatReady) return false;
    this.groundCombatReady = false;
    return true;
  }

  consumeDebriefingReport(): MissionDebriefingReport | null {
    const report = this.lastDebriefingReport;
    this.lastDebriefingReport = null;
    return report;
  }

  consumeCouncilReport(): MonthlyReport | null {
    const report = this.pendingCouncilReport;
    this.pendingCouncilReport = null;
    return report;
  }

  consumeStrategicOutcomeAlert(): StrategicOutcomeAlert | null {
    const alert = this.pendingStrategicOutcome;
    this.pendingStrategicOutcome = null;
    return alert;
  }

  isCampaignLocked(): boolean {
    return this.campaignLocked;
  }

  getStrategicStatus(): StrategicStatus {
    const pactCount = this.countries.filter((country) => country.pact).length;
    return {
      finalAssaultUnlocked: this.strategicVictoryReady,
      finalAssaultLaunchable: this.canLaunchFinalAssault(),
      deficitMonths: this.deficitMonths,
      pactCount,
      totalCountries: this.countries.length
    };
  }

  getStatisticsSnapshot(): CampaignStatisticsSnapshot {
    return { ...this.stats };
  }

  canLaunchFinalAssault(): boolean {
    if (!this.strategicVictoryReady) return false;
    if (this.pendingGroundCombat) return false;
    const base = this.bases[0];
    const healthyAssigned = base.roster.filter((soldier) => soldier.woundHours <= 0 && soldier.craftAssignment !== null);
    return base.craftLoadout.some((craft) => {
      if (craft.status !== "STR_READY") return false;
      const assigned = healthyAssigned.filter((soldier) => soldier.craftAssignment === craft.key).length;
      return assigned >= 4 && craft.fuel >= 240;
    });
  }

  launchFinalAssault(): boolean {
    if (this.campaignLocked) return false;
    if (!this.strategicVictoryReady) {
      this.pushNotice("Final assault research not complete.");
      return false;
    }
    if (this.pendingGroundCombat) {
      this.pushNotice("Another mission is already in progress.");
      return false;
    }

    const base = this.bases[0];
    const healthyAssigned = base.roster.filter((soldier) => soldier.woundHours <= 0 && soldier.craftAssignment !== null);
    const craft = base.craftLoadout.find((entry) => {
      if (entry.status !== "STR_READY") return false;
      const assigned = healthyAssigned.filter((soldier) => soldier.craftAssignment === entry.key).length;
      return assigned >= 4 && entry.fuel >= 240;
    });
    if (!craft) {
      this.pushNotice("Need a ready craft with at least 4 assigned healthy soldiers.");
      return false;
    }

    craft.status = "STR_OUTBOUND";
    craft.etaHours = 7 + Math.random() * 3;
    craft.fuel = Math.max(0, craft.fuel - 220);
    this.pendingGroundCombat = {
      missionId: "FINAL-1",
      regionId: this.regions[0]?.id ?? "STR_EUROPE",
      missionType: "final-assault",
      craftKey: craft.key
    };
    this.stats.missionsLaunched += 1;
    this.groundCombatReady = false;
    this.pushGeoscapeEvent(`${craft.label} launched on final assault.`);
    return true;
  }

  private resolveAirCombat(interceptor: InterceptorState, target: GeoscapeContact): void {
    const sizeFactor = target.size === "small" ? 0.85 : target.size === "medium" ? 1.0 : 1.2;
    const fuelFactor = Math.max(0.35, interceptor.fuelPct / 100);
    const damagePenalty = 1 - interceptor.damagePct / 140;
    const winChance = Math.max(0.18, Math.min(0.88, 0.56 * fuelFactor * damagePenalty / sizeFactor));
    const roll = Math.random();

    const region = this.selectRegionForCoordinate(target.x, target.y);
    if (roll < winChance) {
      target.status = "escaping";
      interceptor.damagePct = Math.min(100, interceptor.damagePct + Math.random() * 9);
      this.stats.ufoDowned += 1;
      this.applyRegionalImpact(region.id, 130, -8, `UFO ${target.id} downed.`);
      this.pushGeoscapeEvent(`${interceptor.id} shot down ${target.id}.`);
      if (Math.random() < 0.65) {
        this.spawnCrashMission(target, region.id);
      }
      return;
    }

    if (roll < winChance + 0.24) {
      interceptor.damagePct = Math.min(100, interceptor.damagePct + 12 + Math.random() * 14);
      target.headingDeg = (target.headingDeg + 65 + Math.random() * 110) % 360;
      this.pushGeoscapeEvent(`${interceptor.id} disengaged from ${target.id}.`);
      return;
    }

    interceptor.damagePct = Math.min(100, interceptor.damagePct + 28 + Math.random() * 22);
    this.stats.interceptorDamaged += 1;
    interceptor.fuelPct = Math.max(0, interceptor.fuelPct - 20);
    this.applyRegionalImpact(region.id, -70, 6, `${interceptor.id} damaged by ${target.id}.`);
    this.pushGeoscapeEvent(`${interceptor.id} took heavy damage from ${target.id}.`);
  }

  private applyRegionalImpact(regionId: string, scoreDelta: number, tensionDelta: number, reason: string): void {
    this.geoscapeScore += scoreDelta;

    for (const country of this.countries) {
      const affinity = this.regionAffinity(country.id, regionId);
      if (affinity <= 0.08) continue;

      const drift = Math.round(tensionDelta * affinity);
      country.satisfaction = this.clampStat(country.satisfaction - drift, 0, 100);

      if (!country.pact && country.satisfaction <= 14 && Math.random() < 0.25) {
        country.pact = true;
        country.funding = 0;
        this.pushGeoscapeEvent(`${country.label} signed a secret pact.`);
      }
    }

    const phrase = scoreDelta >= 0 ? "Positive" : "Negative";
    this.pushNotice(`${phrase} regional impact: ${reason}`);
  }

  applyBattlescapeOutcome(outcome: TacticalOutcome): void {
    const base = this.bases[0];
    if (!base) return;

    let kia = 0;
    let promoted = 0;
    let wounded = 0;
    const soldierReports: MissionDebriefingSoldier[] = [];
    let missionLabel = "Ground Operation";

    for (const soldierResult of outcome.soldiers) {
      const index = base.roster.findIndex((soldier) => soldier.name === soldierResult.name);
      if (index < 0) continue;

      const soldier = base.roster[index];
      const rankBefore = soldier.rank;
      if (!soldierResult.alive) {
        soldierReports.push({
          name: soldier.name,
          status: "kia",
          rankBefore,
          rankAfter: rankBefore,
          killsGained: soldierResult.kills,
          statGain: {
            reactions: 0,
            firing: 0,
            throwing: 0,
            tu: 0,
            stamina: 0,
            strength: 0
          }
        });
        base.roster.splice(index, 1);
        kia += 1;
        continue;
      }

      soldier.missions += 1;
      soldier.kills += soldierResult.kills;

      soldier.health = this.clampStat(soldierResult.finalHealth, 1, soldier.maxHealth);
      const hpMissing = Math.max(0, soldier.maxHealth - soldier.health);
      soldier.woundHours = Math.max(soldier.woundHours, hpMissing * 16);
      soldier.morale = this.clampStat(soldierResult.moraleFinal, 20, 100);
      soldier.bravery = this.clampStat(soldier.bravery + soldierResult.braveryGain, 10, 100);
      if (soldier.woundHours > 0) {
        wounded += 1;
      }
      soldier.reactions = this.clampStat(soldier.reactions + soldierResult.reactionsGain, 20, 120);
      soldier.firing = this.clampStat(soldier.firing + soldierResult.firingGain, 20, 120);
      soldier.throwing = this.clampStat(soldier.throwing + soldierResult.throwingGain, 20, 120);
      soldier.tu = this.clampStat(soldier.tu + soldierResult.tuGain, 35, 90);
      soldier.stamina = this.clampStat(soldier.stamina + soldierResult.staminaGain, 35, 120);
      soldier.strength = this.clampStat(soldier.strength + soldierResult.strengthGain, 20, 80);

      let rankAfter = soldier.rank;
      if (soldierResult.rankUp) {
        const nextRank = this.promoteRank(soldier.rank);
        if (nextRank !== soldier.rank) {
          soldier.rank = nextRank;
          rankAfter = nextRank;
          promoted += 1;
        }
      }

      soldierReports.push({
        name: soldier.name,
        status: soldier.woundHours > 0 ? "wounded" : "active",
        rankBefore,
        rankAfter,
        killsGained: soldierResult.kills,
        statGain: {
          reactions: soldierResult.reactionsGain,
          firing: soldierResult.firingGain,
          throwing: soldierResult.throwingGain,
          tu: soldierResult.tuGain,
          stamina: soldierResult.staminaGain,
          strength: soldierResult.strengthGain
        }
      });
    }

    this.geoscapeScore += outcome.score;
    if (outcome.lootCredits > 0) this.funds += outcome.lootCredits;

    if (this.pendingGroundCombat) {
      const { missionId, regionId, missionType, craftKey } = this.pendingGroundCombat;
      missionLabel = `${missionId} ${missionType}`;
      if (missionType !== "final-assault") {
        const mission = this.missions.find((entry) => entry.id === missionId);
        if (mission) mission.status = "resolved";
      }

      const missionScore = outcome.success ? 220 : -200;
      const tension = outcome.success ? -10 : 12;
      this.applyRegionalImpact(regionId, missionScore, tension, `Ground op ${missionId} (${missionType})`);
      if (missionType !== "final-assault") {
        this.missions = this.missions.filter((entry) => entry.status === "active");
      }

      const craft = base.craftLoadout.find((entry) => entry.key === craftKey);
      if (craft) {
        craft.status = "STR_RETURNING";
        craft.etaHours = 5 + Math.random() * 4;
        craft.damage = Math.min(100, craft.damage + Math.floor(Math.random() * 6));
      }

      if (missionType === "final-assault") {
        if (outcome.success) {
          this.pendingStrategicOutcome = {
            kind: "victory",
            title: "Alien Command Defeated",
            detail: "Cydonia assault succeeded. Earth is secure for now."
          };
          this.campaignLocked = true;
        } else {
          this.pendingStrategicOutcome = {
            kind: "defeat",
            title: "Final Assault Failed",
            detail: "The task force failed to destroy alien command."
          };
          this.campaignLocked = true;
        }
      }
      this.pendingGroundCombat = null;
      this.groundCombatReady = false;
    }

    this.normalizeSoldierAssignments(base);
    base.soldiers = base.roster.length;
    this.refreshBaseComputedState(base);

    this.lastDebriefingReport = {
      missionLabel,
      success: outcome.success,
      aborted: outcome.aborted,
      lootCredits: outcome.lootCredits,
      scoreDelta: outcome.score,
      kia,
      wounded,
      promoted,
      soldiers: soldierReports
    };

    this.stats.soldiersKia += kia;
    this.stats.soldiersWounded += wounded;
    this.stats.promotions += promoted;
    this.stats.lootCredits += outcome.lootCredits;
    if (outcome.aborted) this.stats.groundAborts += 1;
    else if (outcome.success) this.stats.groundWins += 1;
    else this.stats.groundLosses += 1;

    if (outcome.aborted) {
      this.pushNotice(`Operation aborted. KIA ${kia}, wounded ${wounded}.`);
      this.pushGeoscapeEvent("Ground operation aborted.");
      return;
    }

    if (outcome.success) {
      this.pushNotice(`Operation complete. Loot $${outcome.lootCredits.toLocaleString()}, promotions ${promoted}, KIA ${kia}.`);
      this.pushGeoscapeEvent("Ground operation succeeded.");
      return;
    }

    this.pushNotice(`Operation failed. KIA ${kia}, wounded ${wounded}.`);
    this.pushGeoscapeEvent("Ground operation failed.");
  }

  private placeStaffTransfer(kind: "scientist" | "engineer" | "soldier", count: number, etaHours: number, unitCost: number, label: string): void {
    const quantity = Math.max(1, count);
    const total = unitCost * quantity;
    if (this.funds < total) {
      this.pushNotice("Insufficient funds for hiring.");
      return;
    }

    this.funds -= total;
    this.transfers.push({
      id: `TR-${this.transferCounter++}`,
      kind,
      label,
      quantity,
      etaHours
    });
    this.pushNotice(`Hired ${quantity} ${label.toLowerCase()}.`);
    this.refreshBaseComputedState(this.bases[0]);
  }

  private advanceTransfers(hours: number): void {
    const base = this.bases[0];
    const arriving: TransferOrder[] = [];

    for (const transfer of this.transfers) {
      transfer.etaHours -= hours;
      if (transfer.etaHours <= 0) arriving.push(transfer);
    }

    if (arriving.length === 0) return;
    this.transfers = this.transfers.filter((transfer) => transfer.etaHours > 0);

    for (const transfer of arriving) {
      if (transfer.kind === "scientist") {
        base.scientists += transfer.quantity;
      } else if (transfer.kind === "engineer") {
        base.engineers += transfer.quantity;
      } else if (transfer.kind === "soldier") {
        const rookies = this.generateFallbackRookies(transfer.quantity);
        if (rookies.length > 0) {
          base.roster.push(...rookies);
        } else {
          for (let i = 0; i < transfer.quantity; i += 1) {
            base.roster.push({
              name: `Rookie ${base.roster.length + 1}`,
              gender: "male",
              rank: "Rookie",
              tu: 55,
              stamina: 55,
              maxHealth: 32,
              health: 32,
              bravery: 40,
              morale: 100,
              woundHours: 0,
              missions: 0,
              kills: 0,
              craftAssignment: null,
              reactions: 45,
              firing: 55,
              throwing: 60,
              strength: 30
            });
          }
        }
        base.soldiers = base.roster.length;
      } else if (transfer.kind === "item" && transfer.itemId) {
        const store = base.stores.find((item) => item.id === transfer.itemId);
        if (store) {
          store.quantity += transfer.quantity;
        } else {
          base.stores.push({
            id: transfer.itemId,
            label: translate(this.language, transfer.itemId),
            quantity: transfer.quantity,
            unitCost: this.itemBuyCostByType.get(transfer.itemId) ?? 0
          });
        }
      }

      this.pushNotice(`Transfer arrived: ${transfer.quantity} ${transfer.label}.`);
    }

    this.refreshBaseComputedState(base);
  }

  private advanceFacilityConstruction(hours: number): void {
    const base = this.bases[0];
    if (this.facilityQueue.length === 0) return;

    const completed: FacilityConstructionOrder[] = [];
    for (const order of this.facilityQueue) {
      order.remainingHours -= hours;
      if (order.remainingHours <= 0) completed.push(order);
    }
    if (completed.length === 0) return;

    this.facilityQueue = this.facilityQueue.filter((entry) => entry.remainingHours > 0);
    for (const order of completed) {
      base.facilities.push({
        id: `${order.type}-${order.x}-${order.y}-${Date.now().toString(36)}`,
        type: order.type,
        label: translate(this.language, order.type),
        x: order.x,
        y: order.y,
        size: order.size
      });
      this.pushNotice(`Facility completed: ${translate(this.language, order.type)}.`);
    }

    this.recomputeMaintenance(base);
    this.refreshBaseComputedState(base);
  }

  private advanceWoundRecovery(hours: number): void {
    const base = this.bases[0];
    let recovered = 0;
    for (const soldier of base.roster) {
      if (soldier.woundHours <= 0) continue;
      const before = soldier.woundHours;
      soldier.woundHours = Math.max(0, soldier.woundHours - hours);
      const hpRegen = Math.floor((before - soldier.woundHours) / 24);
      if (hpRegen > 0) {
        soldier.health = this.clampStat(soldier.health + hpRegen, 1, soldier.maxHealth);
      }
      if (soldier.woundHours <= 0) {
        soldier.health = soldier.maxHealth;
        recovered += 1;
      }
      soldier.morale = this.clampStat(soldier.morale + Math.floor(hours / 6), 20, 100);
    }
    if (recovered > 0) this.pushNotice(`${recovered} soldier(s) fully recovered.`);
    this.normalizeSoldierAssignments(base);
  }

  private advanceCraftOperations(hours: number): void {
    const base = this.bases[0];
    let changed = false;

    for (const craft of base.craftLoadout) {
      if (craft.status === "STR_OUTBOUND") {
        craft.etaHours = Math.max(0, craft.etaHours - hours);
        changed = true;
        if (craft.etaHours <= 0) {
          craft.status = "STR_ON_MISSION";
          if (this.pendingGroundCombat && this.pendingGroundCombat.craftKey === craft.key) {
            this.groundCombatReady = true;
            this.pushGeoscapeEvent(`${craft.label} reached mission zone.`);
          }
        }
      } else if (craft.status === "STR_RETURNING") {
        craft.etaHours = Math.max(0, craft.etaHours - hours);
        changed = true;
        if (craft.etaHours <= 0) {
          craft.status = "STR_REARMING";
          craft.rearmHours = 14 + craft.damage * 0.7;
          this.pushGeoscapeEvent(`${craft.label} returned to base.`);
        }
      } else if (craft.status === "STR_REARMING") {
        craft.rearmHours = Math.max(0, craft.rearmHours - hours);
        changed = true;
        craft.fuel = Math.min(1000, craft.fuel + Math.floor(hours * 20));
        craft.damage = Math.max(0, craft.damage - Math.floor(hours * 0.6));
        if (craft.rearmHours <= 0) {
          craft.status = "STR_READY";
          craft.damage = Math.max(0, craft.damage);
          this.pushGeoscapeEvent(`${craft.label} is ready.`);
        }
      }
    }

    if (changed) this.refreshBaseComputedState(base);
  }

  private normalizeSoldierAssignments(base: BaseSnapshot): void {
    const validCrafts = new Set(base.craftLoadout.map((craft) => craft.key));
    const counts = new Map<string, number>();
    const slotByCraft = new Map(base.craftLoadout.map((craft) => [craft.key, craft.soldierSlots]));

    for (const soldier of base.roster) {
      if (!soldier.craftAssignment || !validCrafts.has(soldier.craftAssignment) || soldier.woundHours > 0) {
        soldier.craftAssignment = null;
        continue;
      }
      const assigned = counts.get(soldier.craftAssignment) ?? 0;
      const slots = slotByCraft.get(soldier.craftAssignment) ?? 0;
      if (assigned >= slots) {
        soldier.craftAssignment = null;
        continue;
      }
      counts.set(soldier.craftAssignment, assigned + 1);
    }

    for (const craft of base.craftLoadout) {
      craft.assignedSoldiers = counts.get(craft.key) ?? 0;
    }
  }

  private generateFallbackRookies(count: number): BaseSnapshot["roster"] {
    if (!this.soldierRule) {
      const rookies: BaseSnapshot["roster"] = [];
      for (let i = 0; i < count; i += 1) {
        rookies.push({
          name: `Rookie ${100 + i}`,
          gender: "male",
          rank: "Rookie",
          tu: 55,
          stamina: 55,
          maxHealth: 32,
          health: 32,
          bravery: 40,
          morale: 100,
          woundHours: 0,
          missions: 0,
          kills: 0,
          craftAssignment: null,
          reactions: 45,
          firing: 55,
          throwing: 60,
          strength: 30
        });
      }
      return rookies;
    }
    const rulesetLike = {
      soldiers: [this.soldierRule],
      soldierNamePools: []
    } as unknown as LoadedRuleset;
    return this.generateSoldiers(rulesetLike, count);
  }

  private advanceResearch(hours: number): void {
    const dayFraction = hours / 24;
    const completed: string[] = [];

    for (const project of this.activeResearch) {
      if (project.assignedScientists <= 0) continue;
      project.progress += project.assignedScientists * dayFraction;
      if (project.progress >= project.cost) completed.push(project.id);
    }

    if (completed.length > 0) {
      this.activeResearch = this.activeResearch.filter((project) => {
        if (!completed.includes(project.id)) return true;
        this.knownResearch.add(project.id);
        if (this.isEndgameResearchId(project.id)) {
          this.strategicVictoryReady = true;
          this.pushGeoscapeEvent("Final assault research complete.");
        }
        this.pushNotice(`Research completed: ${translate(this.language, project.id)}.`);
        return false;
      });
    }
  }

  private advanceManufacture(hours: number): void {
    const base = this.bases[0];

    for (const project of this.activeManufacture) {
      if (project.assignedEngineers <= 0) continue;
      project.progressTime += project.assignedEngineers * hours;

      while (project.progressTime >= project.requiredTime && project.producedUnits < project.targetUnits) {
        const hasReserved = this.hasReservedItems(project.reservedItems, project.requiredItems);
        if (!hasReserved) {
          project.status = "blocked-items";
          project.progressTime = project.requiredTime - 0.01;
          this.pushNotice(`Manufacture blocked (reserved items depleted): ${translate(this.language, project.id)}`);
          break;
        }
        if (this.funds < project.unitCost) {
          const wasBlocked = project.status === "blocked-funds";
          project.status = "blocked-funds";
          project.progressTime = project.requiredTime - 0.01;
          if (!wasBlocked) this.pushNotice(`Manufacture blocked (insufficient funds): ${translate(this.language, project.id)}`);
          break;
        }

        project.status = "running";
        this.funds -= project.unitCost;
        this.consumeReservedItems(project.reservedItems, project.requiredItems);
        project.progressTime -= project.requiredTime;
        project.producedUnits += 1;

        const store = base.stores.find((item) => item.id === project.id);
        if (store) {
          store.quantity += 1;
        } else {
          base.stores.push({
            id: project.id,
            label: translate(this.language, project.id),
            quantity: 1,
            unitCost: project.unitCost
          });
        }
      }
    }

    const remaining: ActiveManufactureProject[] = [];
    for (const project of this.activeManufacture) {
      if (project.producedUnits < project.targetUnits) {
        remaining.push(project);
      } else {
        this.releaseRemainingReserved(base, project.reservedItems);
        this.pushNotice(`Manufacture completed: ${translate(this.language, project.id)} x${project.targetUnits}.`);
      }
    }
    this.activeManufacture = remaining;
  }

  private advanceGeoscape(hours: number): void {
    this.spawnAccumulatorHours += hours;
    while (this.spawnAccumulatorHours >= 8) {
      this.spawnAccumulatorHours -= 8;
      if (Math.random() < 0.55) this.spawnContact();
    }

    for (const contact of this.contacts) {
      if (contact.status !== "flying") continue;
      const rad = (contact.headingDeg * Math.PI) / 180;
      const distance = (contact.speed * hours) / 100;
      contact.x += Math.cos(rad) * distance;
      contact.y += Math.sin(rad) * distance;
      contact.ttlHours -= hours;

      if (contact.ttlHours < 18 && Math.random() < 0.006 * hours) {
        contact.status = "landed";
        this.spawnMissionFromContact(contact);
      }

      if (contact.x < 0 || contact.x > 1 || contact.y < 0 || contact.y > 1 || contact.ttlHours <= 0) {
        contact.status = "escaping";
      }
    }

    for (const interceptor of this.interceptors) {
      if (interceptor.status === "intercepting" && interceptor.targetContactId) {
        const target = this.contacts.find((c) => c.id === interceptor.targetContactId);
        if (!target || target.status !== "flying") {
          interceptor.targetContactId = null;
          interceptor.status = "returning";
          continue;
        }

        const dx = target.x - interceptor.x;
        const dy = target.y - interceptor.y;
        const dist = Math.hypot(dx, dy);
        const step = (interceptor.speed * hours) / 100;
        if (dist <= step || dist < 0.02) {
          interceptor.x = target.x;
          interceptor.y = target.y;
          this.resolveAirCombat(interceptor, target);
          interceptor.targetContactId = null;
          interceptor.status = "returning";
          interceptor.fuelPct = Math.max(0, interceptor.fuelPct - (8 + interceptor.damagePct * 0.05));
        } else {
          interceptor.x += (dx / dist) * step;
          interceptor.y += (dy / dist) * step;
          interceptor.fuelPct = Math.max(0, interceptor.fuelPct - hours * (0.8 + interceptor.damagePct * 0.01));
          if (interceptor.fuelPct <= 5) {
            interceptor.targetContactId = null;
            interceptor.status = "returning";
            this.pushGeoscapeEvent(`${interceptor.id} aborting intercept: low fuel.`);
          }
        }
      } else if (interceptor.status === "returning") {
        const baseX = 0.52;
        const baseY = 0.42;
        const dx = baseX - interceptor.x;
        const dy = baseY - interceptor.y;
        const dist = Math.hypot(dx, dy);
        const step = (interceptor.speed * hours) / 100;
        if (dist <= step || dist < 0.01) {
          interceptor.x = baseX;
          interceptor.y = baseY;
          interceptor.status = "rearming";
        } else {
          interceptor.x += (dx / dist) * step;
          interceptor.y += (dy / dist) * step;
        }
      } else if (interceptor.status === "rearming") {
        interceptor.fuelPct = Math.min(100, interceptor.fuelPct + hours * 2.5);
        interceptor.damagePct = Math.max(0, interceptor.damagePct - hours * 1.2);
        if (interceptor.fuelPct >= 100 && interceptor.damagePct <= 1) interceptor.status = "ready";
      }
    }

    const removed = this.contacts.filter((c) => c.status === "escaping").map((c) => c.id);
    this.contacts = this.contacts.filter((c) => c.status !== "escaping");
    for (const id of removed.slice(0, 2)) this.pushGeoscapeEvent(`${id} left radar coverage.`);

    for (const mission of this.missions) {
      if (mission.status !== "active") continue;
      mission.ttlHours -= hours;
      if (mission.ttlHours <= 0) mission.status = "expired";
    }

    const expired = this.missions.filter((m) => m.status === "expired");
    for (const mission of expired.slice(0, 2)) {
      this.applyRegionalImpact(mission.regionId, -240, 16, `Mission ${mission.id} expired.`);
      this.pushGeoscapeEvent(`Mission ${mission.id} expired.`);
    }
    this.missions = this.missions.filter((m) => m.status === "active");
  }

  private refreshBaseComputedState(base: BaseSnapshot): void {
    base.soldiers = base.roster.length;
    this.normalizeSoldierAssignments(base);
    base.capacity = this.computeBaseCapacity(base.facilities.map((facility) => facility.type), this.facilityRulesByType);
    base.usage = this.computeBaseUsage(base);
    base.facilityConstruction = {
      available: this.getBuildableFacilities(),
      queue: this.facilityQueue.map((entry) => ({
        id: entry.id,
        label: translate(this.language, entry.type),
        x: entry.x,
        y: entry.y,
        size: entry.size,
        etaHours: Math.max(0, entry.remainingHours),
        totalHours: entry.totalHours,
        paid: entry.paid
      }))
    };
    base.research = this.computeResearchState(base);
    base.manufacture = this.computeManufactureState(base);
    base.transfers = this.transfers.map((transfer) => ({
      id: transfer.id,
      kind: transfer.kind,
      label: transfer.label,
      quantity: transfer.quantity,
      etaHours: Math.max(0, transfer.etaHours)
    }));
    base.market = {
      items: this.marketItems,
      featuredItemId: this.featuredMarketItemId
    };
    base.notices = [...this.notices];
  }

  private promoteRank(rank: string): string {
    const order = ["Rookie", "Squaddie", "Sergeant", "Captain", "Colonel", "Commander"];
    const index = order.findIndex((entry) => entry === rank);
    if (index < 0) return "Squaddie";
    return order[Math.min(order.length - 1, index + 1)];
  }

  private clampStat(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.floor(value)));
  }

  private applyPersisted(payload: PersistedCampaign): void {
    this.elapsedMinutes = Math.max(0, payload.elapsedMinutes);
    this.lastProcessedMonth = Math.max(1, payload.lastProcessedMonth);
    this.funds = payload.funds;

    const countryById = new Map(payload.countries.map((c) => [c.id, c]));
    for (const country of this.countries) {
      const restored = countryById.get(country.id);
      if (!restored) continue;
      country.funding = restored.funding;
      country.satisfaction = this.clampStat(restored.satisfaction ?? country.satisfaction, 0, 100);
      country.pact = Boolean(restored.pact);
    }

    this.knownResearch.clear();
    for (const id of payload.knownResearch) this.knownResearch.add(id);
    if (!this.strategicVictoryReady) {
      this.strategicVictoryReady = Array.from(this.knownResearch).some((id) => this.isEndgameResearchId(id));
    }

    this.activeResearch = payload.activeResearch.map((p) => ({ ...p }));
    this.activeManufacture = payload.activeManufacture.map((p) => ({
      ...p,
      requiredItems: p.requiredItems ?? {},
      reservedItems: p.reservedItems ?? {},
      status: p.status ?? "running"
    }));

    this.contacts = payload.contacts ?? [];
    this.interceptors = (payload.interceptors ?? this.interceptors).map((interceptor) => ({
      ...interceptor,
      damagePct: interceptor.damagePct ?? 0
    }));
    this.missions = payload.missions ?? [];
    this.transfers = payload.transfers ?? [];
    this.geoscapeEvents = payload.geoscapeEvents ?? [];
    this.geoscapeScore = payload.geoscapeScore ?? 0;
    this.contactCounter = payload.contactCounter ?? this.contactCounter;
    this.missionCounter = payload.missionCounter ?? this.missionCounter;
    this.transferCounter = payload.transferCounter ?? this.transferCounter;
    this.spawnAccumulatorHours = payload.spawnAccumulatorHours ?? 0;
    this.pendingCouncilReport = null;
    this.lastDebriefingReport = null;
    this.monthlyReports = (payload.monthlyReports ?? []).map((report) => ({
      ...report,
      rating: report.rating ?? "Average",
      countryChanges: report.countryChanges ?? []
    }));
    this.featuredMarketItemId = payload.featuredMarketItemId || this.featuredMarketItemId;
    this.currentSaveSlot = payload.currentSaveSlot || this.currentSaveSlot;

    const base = this.bases[0];
    if (payload.baseRoster?.length) {
      base.roster = payload.baseRoster.map((soldier) => ({
        ...soldier,
        maxHealth: soldier.maxHealth ?? Math.max(20, soldier.health),
        bravery: soldier.bravery ?? 40,
        morale: soldier.morale ?? 100,
        woundHours: soldier.woundHours ?? 0,
        missions: soldier.missions ?? 0,
        kills: soldier.kills ?? 0,
        craftAssignment: soldier.craftAssignment ?? null
      }));
      base.soldiers = base.roster.length;
    }
    if (payload.baseCraftLoadout?.length) {
      base.craftLoadout = payload.baseCraftLoadout.map((craft, index) => ({
        ...craft,
        key: craft.key ?? `${craft.id}#${index + 1}`,
        soldierSlots: craft.soldierSlots ?? Math.max(4, this.craftRulesByType.get(craft.id)?.soldiers ?? 8),
        assignedSoldiers: 0,
        etaHours: craft.etaHours ?? 0,
        rearmHours: craft.rearmHours ?? 0
      }));
      base.crafts = base.craftLoadout.length;
    }
    base.facilities = (payload.baseFacilities ?? base.facilities).map((facility, index) => ({
      id: `${facility.type}-${facility.x}-${facility.y}-${index}`,
      type: facility.type,
      label: translate(this.language, facility.type),
      x: facility.x,
      y: facility.y,
      size: facility.size || this.facilitySizeByType.get(facility.type) || 1
    }));
    base.stores = payload.baseStores.map((store) => ({
      id: store.id,
      label: translate(this.language, store.id),
      quantity: store.quantity,
      unitCost: store.unitCost || this.itemBuyCostByType.get(store.id) || 0
    }));
    this.facilityQueue = (payload.facilityQueue ?? []).map((entry) => ({ ...entry }));
    this.pendingGroundCombat = payload.pendingGroundCombat ?? null;
    this.groundCombatReady = Boolean(payload.groundCombatReady);
    this.strategicVictoryReady = Boolean(payload.strategicVictoryReady);
    this.pendingStrategicOutcome = payload.pendingStrategicOutcome ?? null;
    this.deficitMonths = payload.deficitMonths ?? 0;
    this.campaignLocked = Boolean(payload.campaignLocked);
    this.stats = {
      ...this.stats,
      ...(payload.stats ?? {})
    };
    this.facilityCounter = this.facilityQueue.reduce((max, entry) => {
      const value = Number(entry.id.replace("FC-", ""));
      return Number.isFinite(value) ? Math.max(max, value + 1) : max;
    }, this.facilityCounter);

    this.recomputeMaintenance(base);
    this.refreshBaseComputedState(base);
    this.pushNotice("Campaign loaded from save.");
  }

  private computeBaseUsage(base: BaseSnapshot): BaseSnapshot["usage"] {
    let storageUsed = 0;
    for (const item of base.stores) {
      storageUsed += (this.itemSizeByType.get(item.id) ?? 0) * item.quantity;
    }
    for (const craft of base.craftLoadout) {
      for (const item of craft.items) {
        storageUsed += (this.itemSizeByType.get(item.id) ?? 0) * item.quantity;
      }
    }

    const assignedScientists = this.activeResearch.reduce((sum, p) => sum + p.assignedScientists, 0);
    const usedWorkshopSpace = this.activeManufacture.reduce((sum, p) => sum + p.workshopSpace, 0);

    return {
      personnel: base.roster.length + base.scientists + base.engineers,
      labs: assignedScientists,
      workshops: usedWorkshopSpace,
      storage: Math.ceil(storageUsed),
      hangars: base.crafts,
      alienContainment: 0
    };
  }

  private computeResearchState(base: BaseSnapshot): BaseSnapshot["research"] {
    const assignedScientists = this.activeResearch.reduce((sum, p) => sum + p.assignedScientists, 0);

    const known = Array.from(this.knownResearch)
      .slice(0, 12)
      .map((id) => ({ id, label: translate(this.language, id) }));

    const available = this.researchRules
      .filter((rule) => !this.knownResearch.has(rule.name))
      .filter((rule) => !this.activeResearch.some((p) => p.id === rule.name))
      .filter((rule) => !(rule.needItem ?? false))
      .filter((rule) => (rule.requires ?? []).every((req) => this.knownResearch.has(req)))
      .slice(0, 12)
      .map((rule) => ({
        id: rule.name,
        label: translate(this.language, rule.name),
        cost: rule.cost,
        points: rule.points
      }));

    const lockedPreview = this.researchRules
      .filter((rule) => !this.knownResearch.has(rule.name))
      .map((rule) => ({
        id: rule.name,
        label: translate(this.language, rule.name),
        missing: (rule.requires ?? []).filter((req) => !this.knownResearch.has(req)).length + ((rule.needItem ?? false) ? 1 : 0)
      }))
      .filter((entry) => entry.missing > 0)
      .sort((a, b) => a.missing - b.missing)
      .slice(0, 8);

    const active = this.activeResearch.map((project) => ({
      id: project.id,
      label: translate(this.language, project.id),
      cost: project.cost,
      progress: project.progress,
      assignedScientists: project.assignedScientists,
      etaHours: project.assignedScientists > 0 ? Math.max(0, ((project.cost - project.progress) / project.assignedScientists) * 24) : null
    }));

    return {
      known,
      available,
      lockedPreview,
      active,
      freeScientists: Math.max(0, Math.min(base.scientists, base.capacity.labs) - assignedScientists)
    };
  }

  private computeManufactureState(base: BaseSnapshot): BaseSnapshot["manufacture"] {
    const assignedEngineers = this.activeManufacture.reduce((sum, p) => sum + p.assignedEngineers, 0);
    const usedWorkshopSpace = this.activeManufacture.reduce((sum, p) => sum + p.workshopSpace, 0);

    const available = this.manufactureRules
      .filter((rule) => (rule.requires ?? []).every((req) => this.knownResearch.has(req)))
      .slice(0, 16)
      .map((rule) => ({
        id: rule.name,
        label: translate(this.language, rule.name),
        category: translate(this.language, rule.category),
        time: rule.time,
        cost: rule.cost,
        space: rule.space
      }));

    const lockedPreview = this.manufactureRules
      .map((rule) => ({
        id: rule.name,
        label: translate(this.language, rule.name),
        missing: (rule.requires ?? []).filter((req) => !this.knownResearch.has(req)).length
      }))
      .filter((entry) => entry.missing > 0)
      .sort((a, b) => a.missing - b.missing)
      .slice(0, 8);

    const active = this.activeManufacture.map((project) => ({
      id: project.id,
      label: translate(this.language, project.id),
      category: translate(this.language, project.category),
      requiredTime: project.requiredTime,
      progressTime: project.progressTime,
      assignedEngineers: project.assignedEngineers,
      etaHours: project.assignedEngineers > 0 ? Math.max(0, (project.requiredTime - project.progressTime) / project.assignedEngineers) : null,
      targetUnits: project.targetUnits,
      producedUnits: project.producedUnits,
      unitCost: project.unitCost,
      workshopSpace: project.workshopSpace,
      status: project.status
    }));

    return {
      available,
      lockedPreview,
      active,
      freeEngineers: Math.max(0, base.engineers - assignedEngineers),
      usedWorkshopSpace
    };
  }

  private reserveItemsForUnits(
    base: BaseSnapshot,
    requiredItems: Record<string, number>,
    units: number
  ): { ok: boolean; missingItemId?: string; reservedItems: Record<string, number> } {
    const reserved: Record<string, number> = {};
    for (const [itemId, qty] of Object.entries(requiredItems)) {
      const needed = qty * units;
      const store = base.stores.find((item) => item.id === itemId);
      if (!store || store.quantity < needed) {
        for (const [rollbackId, rollbackQty] of Object.entries(reserved)) {
          const rollbackStore = base.stores.find((item) => item.id === rollbackId);
          if (rollbackStore) rollbackStore.quantity += rollbackQty;
        }
        return { ok: false, missingItemId: itemId, reservedItems: {} };
      }
      store.quantity -= needed;
      reserved[itemId] = needed;
    }
    base.stores = base.stores.filter((item) => item.quantity > 0);
    return { ok: true, reservedItems: reserved };
  }

  private releaseItemsForUnits(base: BaseSnapshot, requiredItems: Record<string, number>, units: number, reservedItems: Record<string, number>): void {
    for (const [itemId, qtyPerUnit] of Object.entries(requiredItems)) {
      const toRelease = qtyPerUnit * units;
      const availableReserved = reservedItems[itemId] ?? 0;
      const actualRelease = Math.min(availableReserved, toRelease);
      if (actualRelease <= 0) continue;
      reservedItems[itemId] = availableReserved - actualRelease;
      const store = base.stores.find((item) => item.id === itemId);
      if (store) {
        store.quantity += actualRelease;
      } else {
        base.stores.push({
          id: itemId,
          label: translate(this.language, itemId),
          quantity: actualRelease,
          unitCost: this.itemBuyCostByType.get(itemId) ?? 0
        });
      }
    }
  }

  private hasReservedItems(reservedItems: Record<string, number>, requiredItems: Record<string, number>): boolean {
    for (const [itemId, qtyPerUnit] of Object.entries(requiredItems)) {
      if ((reservedItems[itemId] ?? 0) < qtyPerUnit) return false;
    }
    return true;
  }

  private consumeReservedItems(reservedItems: Record<string, number>, requiredItems: Record<string, number>): void {
    for (const [itemId, qtyPerUnit] of Object.entries(requiredItems)) {
      reservedItems[itemId] = Math.max(0, (reservedItems[itemId] ?? 0) - qtyPerUnit);
    }
  }

  private releaseRemainingReserved(base: BaseSnapshot, reservedItems: Record<string, number>): void {
    for (const [itemId, qty] of Object.entries(reservedItems)) {
      if (qty <= 0) continue;
      const store = base.stores.find((item) => item.id === itemId);
      if (store) {
        store.quantity += qty;
      } else {
        base.stores.push({
          id: itemId,
          label: translate(this.language, itemId),
          quantity: qty,
          unitCost: this.itemBuyCostByType.get(itemId) ?? 0
        });
      }
    }
  }

  private getBuildableFacilities(): BaseSnapshot["facilityConstruction"]["available"] {
    return Array.from(this.facilityRulesByType.values())
      .filter((rule) => (rule.buildCost ?? 0) > 0)
      .slice(0, 16)
      .map((rule) => ({
        type: rule.type,
        label: translate(this.language, rule.type),
        size: rule.size ?? 1,
        buildCost: rule.buildCost ?? 0,
        buildHours: this.estimateFacilityBuildHours(rule),
        monthlyCost: rule.monthlyCost ?? 0
      }));
  }

  private estimateFacilityBuildHours(rule: NonNullable<LoadedRuleset["facilities"][number]>): number {
    const size = Math.max(1, rule.size ?? 1);
    const cost = Math.max(50_000, rule.buildCost ?? 0);
    const baseDays = Math.max(6, Math.round(cost / 180_000));
    return baseDays * 24 * size;
  }

  private findFreeFacilitySlot(base: BaseSnapshot, size: number): { x: number; y: number } | null {
    for (let y = 0; y <= 6 - size; y += 1) {
      for (let x = 0; x <= 6 - size; x += 1) {
        if (this.canPlaceFacility(base, x, y, size)) return { x, y };
      }
    }
    return null;
  }

  private canPlaceFacility(base: BaseSnapshot, x: number, y: number, size: number): boolean {
    if (x < 0 || y < 0 || x + size > 6 || y + size > 6) return false;
    for (const facility of base.facilities) {
      if (this.rectsOverlap(x, y, size, facility.x, facility.y, facility.size)) return false;
    }
    for (const queued of this.facilityQueue) {
      if (this.rectsOverlap(x, y, size, queued.x, queued.y, queued.size)) return false;
    }
    return true;
  }

  private rectsOverlap(x1: number, y1: number, s1: number, x2: number, y2: number, s2: number): boolean {
    return x1 < x2 + s2 && x1 + s1 > x2 && y1 < y2 + s2 && y1 + s1 > y2;
  }

  private recomputeMaintenance(base: BaseSnapshot): void {
    this.maintenanceMonthly = base.facilities.reduce((sum, facility) => sum + (this.facilityMonthlyCostByType.get(facility.type) ?? 0), 0);
  }

  private spawnContact(): void {
    const types = ["STR_SMALL_SCOUT", "STR_MEDIUM_SCOUT", "STR_TERROR_SHIP"];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = type === "STR_SMALL_SCOUT" ? "small" : type === "STR_MEDIUM_SCOUT" ? "medium" : "large";
    const headingDeg = Math.floor(Math.random() * 360);
    const speed = size === "small" ? 2.3 : size === "medium" ? 1.8 : 1.4;

    const spawnEdge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (spawnEdge === 0) { x = 0; y = Math.random(); }
    if (spawnEdge === 1) { x = 1; y = Math.random(); }
    if (spawnEdge === 2) { x = Math.random(); y = 0; }
    if (spawnEdge === 3) { x = Math.random(); y = 1; }

    const contact: GeoscapeContact = {
      id: `UFO-${this.contactCounter++}`,
      type,
      size,
      headingDeg,
      speed,
      x,
      y,
      detected: Math.random() < 0.85,
      status: "flying",
      ttlHours: 24 + Math.random() * 48
    };
    this.contacts.push(contact);
    this.stats.ufoDetected += 1;
    if (contact.detected) this.pushGeoscapeEvent(`Detected ${translate(this.language, type)} (${contact.id}).`);
    if (Math.random() < 0.08) this.spawnAdHocMission();
  }

  private spawnMissionFromContact(contact: GeoscapeContact): void {
    const region = this.selectRegionForCoordinate(contact.x, contact.y);
    const mission: GeoscapeMission = {
      id: `MIS-${this.missionCounter++}`,
      type: "ufo-landed",
      regionId: region.id,
      x: contact.x,
      y: contact.y,
      ttlHours: 18 + Math.random() * 18,
      status: "active",
      sourceContactId: contact.id
    };
    this.missions.push(mission);
    this.pushGeoscapeEvent(`Landed UFO mission detected in ${region.label} (${mission.id}).`);
  }

  private spawnCrashMission(contact: GeoscapeContact, regionId: string): void {
    const mission: GeoscapeMission = {
      id: `MIS-${this.missionCounter++}`,
      type: "ufo-landed",
      regionId,
      x: contact.x,
      y: contact.y,
      ttlHours: 10 + Math.random() * 12,
      status: "active",
      sourceContactId: contact.id
    };
    this.missions.push(mission);
    this.pushGeoscapeEvent(`Crash site established (${mission.id}).`);
  }

  private spawnAdHocMission(): void {
    if (this.regions.length === 0) return;
    const region = this.regions[Math.floor(Math.random() * this.regions.length)];
    const missionType: GeoscapeMission["type"] = Math.random() < 0.75 ? "terror-site" : "alien-base";
    const mission: GeoscapeMission = {
      id: `MIS-${this.missionCounter++}`,
      type: missionType,
      regionId: region.id,
      x: Math.random(),
      y: Math.random(),
      ttlHours: missionType === "terror-site" ? 20 : 72,
      status: "active",
      sourceContactId: null
    };
    this.missions.push(mission);
    this.pushGeoscapeEvent(`New mission reported in ${region.label} (${mission.id}).`);
  }

  private regionAffinity(countryId: string, regionId: string): number {
    const value = this.hashToUnit(`${countryId}|${regionId}`);
    if (value < 0.35) return 0.05 + value * 0.2;
    if (value < 0.7) return 0.35 + (value - 0.35) * 1.1;
    return 0.15 + (1 - value) * 0.5;
  }

  private computeBaseCapacity(
    facilityTypes: string[],
    facilityByType: Map<string, NonNullable<LoadedRuleset["facilities"][number]>>
  ): BaseSnapshot["capacity"] {
    const capacity: BaseSnapshot["capacity"] = {
      personnel: 0,
      labs: 0,
      workshops: 0,
      storage: 0,
      hangars: 0,
      alienContainment: 0
    };

    for (const type of facilityTypes) {
      const rule = facilityByType.get(type);
      if (!rule) continue;
      capacity.personnel += rule.personnel ?? 0;
      capacity.labs += rule.labs ?? 0;
      capacity.workshops += rule.workshops ?? 0;
      capacity.storage += rule.storage ?? 0;
      capacity.hangars += rule.crafts ?? 0;
      capacity.alienContainment += rule.aliens ?? 0;
    }
    return capacity;
  }

  private generateSoldiers(ruleset: LoadedRuleset, count: number): BaseSnapshot["roster"] {
    const soldierRule = ruleset.soldiers?.[0] ?? this.soldierRule;
    if (!soldierRule) return [];
    const pools = ruleset.soldierNamePools?.length ? ruleset.soldierNamePools : [];

    const roster: BaseSnapshot["roster"] = [];
    for (let i = 0; i < count; i += 1) {
      const femaleFrequency = soldierRule.femaleFrequency ?? 25;
      const isFemale = Math.random() * 100 < femaleFrequency;
      const name = this.generateSoldierName(pools, isFemale, i + 1);
      roster.push({
        name,
        gender: isFemale ? "female" : "male",
        rank: "Rookie",
        tu: this.randomStat(soldierRule.minStats.tu, soldierRule.maxStats.tu),
        stamina: this.randomStat(soldierRule.minStats.stamina, soldierRule.maxStats.stamina),
        maxHealth: this.randomStat(soldierRule.minStats.health, soldierRule.maxStats.health),
        health: 0,
        bravery: this.randomStat(soldierRule.minStats.bravery, soldierRule.maxStats.bravery),
        morale: 100,
        woundHours: 0,
        missions: 0,
        kills: 0,
        craftAssignment: null,
        reactions: this.randomStat(soldierRule.minStats.reactions, soldierRule.maxStats.reactions),
        firing: this.randomStat(soldierRule.minStats.firing, soldierRule.maxStats.firing),
        throwing: this.randomStat(soldierRule.minStats.throwing, soldierRule.maxStats.throwing),
        strength: this.randomStat(soldierRule.minStats.strength, soldierRule.maxStats.strength)
      });
      roster[roster.length - 1].health = roster[roster.length - 1].maxHealth;
    }
    return roster;
  }

  private generateSoldierName(pools: LoadedRuleset["soldierNamePools"], female: boolean, fallbackIndex: number): string {
    const pool = pools[Math.floor(Math.random() * Math.max(1, pools.length))] ?? {};
    const firstNames = female ? (pool.femaleFirst ?? pool.maleFirst ?? []) : (pool.maleFirst ?? pool.femaleFirst ?? []);
    const lastNames = female ? (pool.femaleLast ?? pool.maleLast ?? []) : (pool.maleLast ?? pool.femaleLast ?? []);
    const first = firstNames.length > 0 ? firstNames[Math.floor(Math.random() * firstNames.length)] : "Rookie";
    const last = lastNames.length > 0 ? lastNames[Math.floor(Math.random() * lastNames.length)] : `${100 + fallbackIndex}`;
    return `${first} ${last}`;
  }

  private randomStat(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  private getDate(): Date {
    return new Date(this.startTimeUtcMs + this.elapsedMinutes * 60 * 1000);
  }

  private getMonthlyIncome(): number {
    return this.countries.reduce((sum, country) => sum + country.funding, 0);
  }

  private computeMonthlyProjection(base: BaseSnapshot): CampaignSnapshot["economy"]["projected"] {
    const income = this.getMonthlyIncome();
    const maintenance = this.maintenanceMonthly;
    const salaries = base.soldiers * this.soldierSalary + base.scientists * this.scientistSalary + base.engineers * this.engineerSalary;
    const scoreBonus = Math.round(Math.max(-500_000, Math.min(500_000, this.geoscapeScore * 120)));
    return { income, maintenance, salaries, scoreBonus, net: income - maintenance - salaries + scoreBonus };
  }

  private applyMonthlyTransitions(): void {
    const month = this.getDate().getUTCMonth() + 1;
    if (month === this.lastProcessedMonth) return;

    this.lastProcessedMonth = month;
    const base = this.bases[0];
    const fundingBeforeById = new Map(this.countries.map((country) => [country.id, country.funding]));
    for (const country of this.countries) {
      if (country.pact) {
        country.funding = 0;
      } else if (country.satisfaction < 28 && Math.random() < 0.08) {
        country.pact = true;
        country.funding = 0;
        this.pushGeoscapeEvent(`${country.label} withdrew support.`);
      }
    }

    const projected = this.computeMonthlyProjection(base);
    this.funds += projected.net;
    this.randomizeFunding();

    const countryChanges = this.countries
      .map((country) => {
        const fundingBefore = fundingBeforeById.get(country.id) ?? country.funding;
        const fundingAfter = country.funding;
        return {
          id: country.id,
          label: country.label,
          fundingBefore,
          fundingAfter,
          delta: fundingAfter - fundingBefore,
          satisfaction: country.satisfaction,
          pact: country.pact
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const report: MonthlyReport = {
      monthIso: this.getDate().toISOString().slice(0, 7),
      income: projected.income,
      maintenance: projected.maintenance,
      salaries: projected.salaries,
      scoreBonus: projected.scoreBonus,
      net: projected.net,
      fundsAfter: this.funds,
      rating: this.getCouncilRating(this.geoscapeScore, countryChanges.filter((entry) => entry.pact).length),
      countryChanges
    };
    this.monthlyReports.push(report);
    if (this.monthlyReports.length > 12) this.monthlyReports = this.monthlyReports.slice(this.monthlyReports.length - 12);
    this.pendingCouncilReport = report;

    if (this.funds < 0) this.deficitMonths += 1;
    else this.deficitMonths = 0;

    const pactCount = this.countries.filter((country) => country.pact).length;
    if (!this.pendingStrategicOutcome && (pactCount >= Math.ceil(this.countries.length * 0.6) || this.deficitMonths >= 2)) {
      this.pendingStrategicOutcome = {
        kind: "defeat",
        title: "XCOM Council Terminated",
        detail: pactCount >= Math.ceil(this.countries.length * 0.6)
          ? "Too many nations signed pacts with the aliens."
          : "Council funding collapsed after repeated deficits."
      };
      this.campaignLocked = true;
    }

    this.geoscapeScore = Math.round(this.geoscapeScore * 0.7);
    this.saveToStorage(CampaignModel.AUTOSAVE_SLOT);
    this.pushNotice("Autosaved at month rollover.");
  }

  private getCouncilRating(score: number, pactCount: number): string {
    const adjusted = score - pactCount * 250;
    if (adjusted >= 600) return "Excellent";
    if (adjusted >= 220) return "Good";
    if (adjusted >= -120) return "Average";
    if (adjusted >= -420) return "Poor";
    return "Terrible";
  }

  private randomizeFunding(): void {
    const scoreFactor = Math.max(-0.12, Math.min(0.12, this.geoscapeScore / 10_000));
    for (const country of this.countries) {
      if (country.pact) {
        country.funding = 0;
        country.satisfaction = Math.max(0, country.satisfaction - 1);
        continue;
      }

      const satisfactionFactor = (country.satisfaction - 50) / 350;
      const drift = 1 + (Math.random() * 0.08 - 0.04) + scoreFactor;
      country.funding = Math.max(20_000, Math.min(country.cap, Math.round(country.funding * (drift + satisfactionFactor))));
      country.satisfaction = this.clampStat(country.satisfaction + Math.round(scoreFactor * 20 + (Math.random() * 6 - 3)), 0, 100);
    }
  }

  private pushNotice(message: string): void {
    this.notices.push(message);
    if (this.notices.length > 8) this.notices = this.notices.slice(this.notices.length - 8);
  }

  private pushGeoscapeEvent(message: string): void {
    this.geoscapeEvents.push(message);
    if (this.geoscapeEvents.length > 24) this.geoscapeEvents = this.geoscapeEvents.slice(this.geoscapeEvents.length - 24);
  }

  private selectRegionForCoordinate(x: number, y: number): Region {
    if (this.regions.length === 0) return { id: "STR_NORTH_AMERICA", label: "North America", monthlyCost: 0, weight: 1 };
    const index = Math.floor(((x * 0.65 + y * 0.35) % 1) * this.regions.length);
    return this.regions[Math.max(0, Math.min(this.regions.length - 1, index))];
  }

  private hashToUnit(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 10_000) / 10_000;
  }

  private isEndgameResearchId(id: string): boolean {
    const normalized = id.toUpperCase();
    return normalized.includes("CYDONIA") || normalized.includes("TLETH") || normalized.includes("FINAL");
  }

  private selectPrimaryTransport(base: BaseSnapshot): BaseSnapshot["craftLoadout"][number] | undefined {
    const sorted = [...base.craftLoadout].sort((a, b) => b.soldierSlots - a.soldierSlots);
    return sorted[0];
  }

  private selectInterceptorCrafts(base: BaseSnapshot): BaseSnapshot["craftLoadout"] {
    return base.craftLoadout.filter((craft) => {
      const rule = this.craftRulesByType.get(craft.id);
      const weaponSlots = rule?.weapons ?? craft.weapons.length;
      const soldiers = rule?.soldiers ?? craft.soldierSlots;
      return weaponSlots > 0 && soldiers <= 8;
    });
  }

  private static slotKey(gameId: LoadedRuleset["gameId"], slot: number): string {
    return `${CampaignModel.STORAGE_KEY_PREFIX}-${gameId}-slot-${slot}`;
  }
}
