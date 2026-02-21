export interface Region {
  id: string;
  label: string;
  weight: number;
  monthlyCost: number;
}

export interface Country {
  id: string;
  label: string;
  funding: number;
  cap: number;
  satisfaction: number;
  pact: boolean;
}

export interface BaseSnapshot {
  name: string;
  scientists: number;
  engineers: number;
  soldiers: number;
  roster: Array<{
    name: string;
    gender: "male" | "female";
    rank: string;
    tu: number;
    stamina: number;
    maxHealth: number;
    health: number;
    bravery: number;
    morale: number;
    woundHours: number;
    missions: number;
    kills: number;
    craftAssignment: string | null;
    reactions: number;
    firing: number;
    throwing: number;
    strength: number;
  }>;
  capacity: {
    personnel: number;
    labs: number;
    workshops: number;
    storage: number;
    hangars: number;
    alienContainment: number;
  };
  usage: {
    personnel: number;
    labs: number;
    workshops: number;
    storage: number;
    hangars: number;
    alienContainment: number;
  };
  crafts: number;
  craftLoadout: Array<{
    key: string;
    id: string;
    label: string;
    status: string;
    fuel: number;
    damage: number;
    etaHours: number;
    rearmHours: number;
    soldierSlots: number;
    assignedSoldiers: number;
    weapons: Array<{ id: string; label: string; ammo: number }>;
    items: Array<{ id: string; label: string; quantity: number }>;
  }>;
  stores: Array<{ id: string; label: string; quantity: number; unitCost: number }>;
  transfers: Array<{
    id: string;
    kind: "scientist" | "engineer" | "soldier" | "item";
    label: string;
    quantity: number;
    etaHours: number;
  }>;
  market: {
    items: Array<{ id: string; label: string; buyCost: number; sellCost: number; size: number }>;
    featuredItemId: string;
  };
  facilities: Array<{ id: string; type: string; label: string; x: number; y: number; size: number }>;
  facilityConstruction: {
    available: Array<{ type: string; label: string; size: number; buildCost: number; buildHours: number; monthlyCost: number }>;
    queue: Array<{ id: string; label: string; x: number; y: number; size: number; etaHours: number; totalHours: number; paid: number }>;
  };
  research: {
    known: Array<{ id: string; label: string }>;
    available: Array<{ id: string; label: string; cost: number; points: number }>;
    lockedPreview: Array<{ id: string; label: string; missing: number }>;
    active: Array<{
      id: string;
      label: string;
      cost: number;
      progress: number;
      assignedScientists: number;
      etaHours: number | null;
    }>;
    freeScientists: number;
  };
  manufacture: {
    available: Array<{ id: string; label: string; category: string; time: number; cost: number; space: number }>;
    lockedPreview: Array<{ id: string; label: string; missing: number }>;
    active: Array<{
      id: string;
      label: string;
      category: string;
      requiredTime: number;
      progressTime: number;
      assignedEngineers: number;
      etaHours: number | null;
      targetUnits: number;
      producedUnits: number;
      unitCost: number;
      workshopSpace: number;
      status: "running" | "blocked-funds" | "blocked-items";
    }>;
    freeEngineers: number;
    usedWorkshopSpace: number;
  };
  notices: string[];
}

export interface CampaignSnapshot {
  dateIsoUtc: string;
  funds: number;
  monthlyIncome: number;
  countries: Country[];
  regions: Region[];
  bases: BaseSnapshot[];
  geoscape: {
    score: number;
    contacts: Array<{
      id: string;
      type: string;
      size: "small" | "medium" | "large";
      headingDeg: number;
      speed: number;
      x: number;
      y: number;
      detected: boolean;
      status: "flying" | "landed" | "escaping";
    }>;
    interceptors: Array<{
      id: string;
      label: string;
      speed: number;
      fuelPct: number;
      damagePct: number;
      x: number;
      y: number;
      status: "ready" | "intercepting" | "returning" | "rearming";
      targetContactId: string | null;
    }>;
    missions: Array<{
      id: string;
      type: "ufo-landed" | "terror-site" | "alien-base";
      regionId: string;
      regionLabel: string;
      x: number;
      y: number;
      ttlHours: number;
      status: "active" | "resolved" | "expired";
      sourceContactId: string | null;
    }>;
    events: string[];
  };
  economy: {
    monthlyReports: Array<{
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
    }>;
    projected: {
      income: number;
      maintenance: number;
      salaries: number;
      scoreBonus: number;
      net: number;
    };
  };
}
