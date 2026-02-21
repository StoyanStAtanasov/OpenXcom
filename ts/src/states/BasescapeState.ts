import { CampaignModel } from "../campaign/CampaignModel";
import type { Renderer } from "../engine/Renderer";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiState } from "../interface/UiState";
import { BattlescapeState } from "./BattlescapeState";
import { GeoscapeState } from "./GeoscapeState";

type PanelMode = "base" | "rnd" | "logistics";

export class BasescapeState implements GameState {
  readonly id = "basescape";
  private readonly campaign: CampaignModel;
  private readonly geoscapeState: GeoscapeState;
  private readonly ui = new UiState();
  private panelMode: PanelMode = "base";

  private selectedSoldier = 0;
  private selectedCraftIndex = 0;
  private selectedResearchTopicId = "";
  private selectedManufactureTopicId = "";

  constructor(campaign: CampaignModel, geoscapeState: GeoscapeState) {
    this.campaign = campaign;
    this.geoscapeState = geoscapeState;
  }

  enter(ctx: StateContext): void {
    void ctx.game.getRenderer().setPalettePack(this.campaign.getGameId() === "xcom1" ? "ufo" : "tftd");
    const { width } = ctx.game.getRenderer().getSize();
    const style = {
      background: "#354556",
      border: "#8ca8c1",
      focusBorder: "#d0e7ff",
      foreground: "#f4f7fb",
      fontSize: 8
    };
    this.ui.setWidgets([
      new TextButton(width - 92, 32, 84, 16, "GEOSCAPE", () => ({ type: "switch", next: this.geoscapeState }), style),
      new TextButton(width - 92, 54, 84, 16, "BATTLE", () => ({ type: "switch", next: new BattlescapeState(this.campaign, this) }), style),
      new TextButton(width - 92, 76, 84, 16, "BASE VIEW", () => { this.panelMode = "base"; return noTransition(); }, style),
      new TextButton(width - 92, 98, 84, 16, "R&D VIEW", () => { this.panelMode = "rnd"; return noTransition(); }, style),
      new TextButton(width - 92, 120, 84, 16, "LOGI VIEW", () => { this.panelMode = "logistics"; return noTransition(); }, style),
      new TextButton(width - 92, 142, 84, 16, "SAVE", () => { this.campaign.saveToStorage(); return noTransition(); }, style),
      new TextButton(width - 92, 164, 40, 16, "SLOT-", () => { this.campaign.setSaveSlot(Math.max(1, this.campaign.getSaveSlot() - 1)); return noTransition(); }, style),
      new TextButton(width - 48, 164, 40, 16, "SLOT+", () => { this.campaign.setSaveSlot(Math.min(3, this.campaign.getSaveSlot() + 1)); return noTransition(); }, style)
    ]);
  }

  update(): StateTransition {
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    const snapshot = this.campaign.getSnapshot();
    const base = snapshot.bases[0];

    r.clear("#161a1e");
    r.text("BASESCAPE", 8, 14, "#d0e7ff", 10);

    r.rect(8, 24, 210, 156, "#242b32");
    r.strokeRect(8, 24, 210, 156, "#6f7f90");

    for (let x = 0; x < 6; x += 1) {
      for (let y = 0; y < 6; y += 1) {
        r.strokeRect(14 + x * 32, 30 + y * 24, 28, 20, "#43515e");
      }
    }

    for (const facility of base.facilities) {
      const px = 14 + facility.x * 32;
      const py = 30 + facility.y * 24;
      const width = 28 + (facility.size - 1) * 32;
      const height = 20 + (facility.size - 1) * 24;
      r.rect(px, py, width, height, "#314252");
      r.strokeRect(px, py, width, height, "#9ec0de");
    }

    r.text(`Base: ${base.name}`, 14, 168, "#d8dee6", 8);
    r.text(`Soldiers ${base.soldiers}`, 14, 178, "#9db2c5", 8);
    r.text(`Scientists ${base.scientists}`, 84, 178, "#9db2c5", 8);
    r.text(`Engineers ${base.engineers}`, 164, 178, "#9db2c5", 8);
    r.text(`Funds $${snapshot.funds.toLocaleString()}`, 14, 188, "#9db2c5", 8);

    if (this.panelMode === "base") {
      this.renderBasePanel(base, r);
    } else if (this.panelMode === "rnd") {
      this.renderRndPanel(base, r);
    } else {
      this.renderLogisticsPanel(snapshot, base, r);
    }

    let noticeY = 24;
    for (const notice of base.notices.slice(-3)) {
      r.text(notice.slice(0, 28), 228, noticeY, "#d4b48d", 7);
      noticeY += 8;
    }

    this.ui.draw(r);

    r.text(`Save Slot ${this.campaign.getSaveSlot()}`, 228, 190, "#9db2c5", 7);
  }

  private renderBasePanel(base: ReturnType<CampaignModel["getSnapshot"]>["bases"][number], r: Renderer): void {
    let sideY = 116;
    r.text("Capacity used/total", 228, sideY, "#d8dee6", 8);
    sideY += 9;
    r.text(`Pers ${base.usage.personnel}/${base.capacity.personnel}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Lab ${base.usage.labs}/${base.capacity.labs}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Work ${base.usage.workshops}/${base.capacity.workshops}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Store ${base.usage.storage}/${base.capacity.storage}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Hang ${base.usage.hangars}/${base.capacity.hangars}`, 228, sideY, "#9db2c5", 7);
    sideY += 10;
    r.text("Craft crew", 228, sideY, "#d8dee6", 8);
    sideY += 9;
    for (const craft of base.craftLoadout.slice(0, 3)) {
      const eta = craft.status === "STR_READY" ? "" : ` ${Math.ceil(craft.etaHours || craft.rearmHours)}h`;
      r.text(`${craft.label.slice(0, 8)} ${craft.assignedSoldiers}/${craft.soldierSlots}`, 228, sideY, "#9db2c5", 7);
      sideY += 8;
      r.text(`${craft.status.replace("STR_", "")}${eta}`, 228, sideY, "#7f96aa", 7);
      sideY += 8;
    }

    let rosterY = 108;
    r.text("Roster (click)", 14, rosterY, "#d8dee6", 8);
    r.text("Assign (click right)", 120, rosterY, "#d8dee6", 8);
    rosterY += 9;
    for (const [index, soldier] of base.roster.slice(0, 8).entries()) {
      const color = index === this.selectedSoldier ? "#e7f4ff" : "#9db2c5";
      const woundTag = soldier.woundHours > 0 ? `W${Math.ceil(soldier.woundHours / 24)}d` : "READY";
      const craftTag = soldier.craftAssignment ? soldier.craftAssignment.split("#")[0].replace("STR_", "") : "NONE";
      r.text(`${soldier.name.slice(0, 9)} ${woundTag}`, 14, rosterY, color, 7);
      r.text(craftTag.slice(0, 12), 120, rosterY, color, 7);
      rosterY += 8;
    }

    const selected = base.roster[this.selectedSoldier];
    if (!selected) return;

    let detailY = 108;
    r.text("Soldier", 120, detailY, "#d8dee6", 8);
    detailY += 9;
    r.text(selected.name, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`Rank ${selected.rank}`, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`TU ${selected.tu} STA ${selected.stamina} HP ${selected.health}`, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`BRV ${selected.bravery} MRL ${selected.morale}`, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`MIS ${selected.missions} KIL ${selected.kills}`, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`FIR ${selected.firing} REA ${selected.reactions}`, 120, detailY, "#9db2c5", 7);
    detailY += 8;
    r.text(`THR ${selected.throwing} STR ${selected.strength}`, 120, detailY, "#9db2c5", 7);

    let buildY = 154;
    r.text("Build Facilities (+)", 120, buildY, "#d8dee6", 8);
    buildY += 9;
    for (const option of base.facilityConstruction.available.slice(0, 4)) {
      r.text(`+ ${option.label.slice(0, 11)} ${Math.round(option.buildHours / 24)}d`, 120, buildY, "#9db2c5", 7);
      buildY += 8;
    }

    let queueY = 154;
    r.text("Construction (cancel)", 228, queueY, "#d8dee6", 8);
    queueY += 9;
    for (const order of base.facilityConstruction.queue.slice(0, 4)) {
      r.text(`${order.label.slice(0, 11)} ${Math.ceil(order.etaHours)}h`, 228, queueY, "#9db2c5", 7);
      queueY += 8;
    }
  }

  private renderRndPanel(base: ReturnType<CampaignModel["getSnapshot"]>["bases"][number], r: Renderer): void {
    r.text("R&D Control (click rows)", 14, 108, "#d8dee6", 8);
    r.text(`Free Sci: ${base.research.freeScientists}`, 14, 116, "#9db2c5", 7);
    r.text(`Free Eng: ${base.manufacture.freeEngineers}`, 114, 116, "#9db2c5", 7);
    r.text(`Workshop: ${base.manufacture.usedWorkshopSpace}/${base.capacity.workshops}`, 14, 124, "#9db2c5", 7);

    let y = 132;
    r.text("Research Avail", 14, y, "#d8dee6", 8);
    y += 9;
    for (const topic of base.research.available.slice(0, 5)) {
      r.text(`+ ${topic.label}`, 14, y, "#c7e4ff", 7);
      y += 8;
    }

    y += 2;
    r.text("Research Active (-/+ sci)", 14, y, "#d8dee6", 8);
    y += 8;
    r.text("left edge: cancel", 14, y, "#8aa3b9", 6);
    y += 9;
    for (const topic of base.research.active.slice(0, 3)) {
      const pct = Math.floor((topic.progress / topic.cost) * 100);
      r.text(`${topic.label} ${pct}% [${topic.assignedScientists}]  X`, 14, y, "#9db2c5", 7);
      y += 8;
    }

    let x = 114;
    let y2 = 132;
    r.text("Mfg Avail", x, y2, "#d8dee6", 8);
    y2 += 9;
    for (const m of base.manufacture.available.slice(0, 5)) {
      r.text(`+ ${m.label}`, x, y2, "#c7e4ff", 7);
      y2 += 8;
    }

    y2 += 2;
    r.text("Mfg Active (-/+ eng)", x, y2, "#d8dee6", 8);
    y2 += 8;
    r.text("left edge: cancel | mid: eng | right: target", x, y2, "#8aa3b9", 6);
    y2 += 9;
    for (const m of base.manufacture.active.slice(0, 3)) {
      const pct = Math.floor((m.progressTime / m.requiredTime) * 100);
      const status = m.status === "running" ? "" : m.status === "blocked-funds" ? " $!" : " item!";
      r.text(`${m.label} ${pct}% [${m.assignedEngineers}] T${m.targetUnits}${status} X`, x, y2, "#9db2c5", 7);
      y2 += 8;
    }

    const researchDetail = this.selectedResearchTopicId ? this.campaign.getResearchTopicDetails(this.selectedResearchTopicId) : null;
    const mfgDetail = this.selectedManufactureTopicId ? this.campaign.getManufactureTopicDetails(this.selectedManufactureTopicId) : null;

    let detailY = 24;
    if (researchDetail) {
      r.text(`Research: ${researchDetail.label}`, 228, detailY, "#d8dee6", 8);
      detailY += 8;
      r.text(`Cost ${researchDetail.cost} Pts ${researchDetail.points}`, 228, detailY, "#9db2c5", 7);
      detailY += 8;
      if (researchDetail.needItem) {
        r.text("Needs item capture", 228, detailY, "#9db2c5", 7);
        detailY += 8;
      }
      for (const req of researchDetail.requires.slice(0, 4)) {
        r.text(`${req.known ? "[OK]" : "[..]"} ${req.label}`, 228, detailY, "#9db2c5", 7);
        detailY += 8;
      }
      detailY += 4;
    }

    if (mfgDetail) {
      r.text(`Manufacture: ${mfgDetail.label}`, 228, detailY, "#d8dee6", 8);
      detailY += 8;
      r.text(`Cost ${mfgDetail.cost} Time ${mfgDetail.time}`, 228, detailY, "#9db2c5", 7);
      detailY += 8;
      r.text(`Space ${mfgDetail.space} ${mfgDetail.category}`, 228, detailY, "#9db2c5", 7);
      detailY += 8;
      for (const req of mfgDetail.requires.slice(0, 3)) {
        r.text(`${req.known ? "[OK]" : "[..]"} ${req.label}`, 228, detailY, "#9db2c5", 7);
        detailY += 8;
      }
      for (const item of mfgDetail.requiredItems.slice(0, 3)) {
        r.text(`${item.label} ${item.inStore}/${item.quantity}`, 228, detailY, "#9db2c5", 7);
        detailY += 8;
      }
    }
  }

  private renderLogisticsPanel(
    snapshot: ReturnType<CampaignModel["getSnapshot"]>,
    base: ReturnType<CampaignModel["getSnapshot"]>["bases"][number],
    r: Renderer
  ): void {
    r.text("Logistics (click rows)", 14, 108, "#d8dee6", 8);

    const featured = base.market.items.find((item) => item.id === base.market.featuredItemId) ?? base.market.items[0];
    if (featured) {
      r.text(`Market: ${featured.label}`, 14, 118, "#c7e4ff", 7);
      r.text(`Buy ${featured.buyCost} Sell ${featured.sellCost}`, 14, 126, "#9db2c5", 7);
      r.text(`Buy:+1 +5  Sell:-1 -5  Rotate item`, 14, 134, "#8aa3b9", 6);
    }

    const crafts = base.craftLoadout;
    const selectedCraft = crafts[this.selectedCraftIndex % Math.max(1, crafts.length)];
    if (selectedCraft) {
      r.text(`Craft: ${selectedCraft.label} (${selectedCraft.status.replace("STR_", "")})`, 14, 144, "#d8dee6", 8);
      r.text(`Crew ${selectedCraft.assignedSoldiers}/${selectedCraft.soldierSlots}`, 14, 152, "#9db2c5", 7);
      r.text(`Store->Craft (+1)`, 14, 160, "#d8dee6", 8);
      let storeY = 168;
      for (const item of base.stores.slice(0, 3)) {
        r.text(`+ ${item.label.slice(0, 12)} x${item.quantity}`, 14, storeY, "#9db2c5", 7);
        storeY += 8;
      }

      r.text(`Craft->Store (-1)`, 114, 160, "#d8dee6", 8);
      let craftY = 168;
      for (const item of selectedCraft.items.slice(0, 3)) {
        r.text(`- ${item.label.slice(0, 12)} x${item.quantity}`, 114, craftY, "#9db2c5", 7);
        craftY += 8;
      }
    }

    let sideY = 110;
    r.text("Staff", 228, sideY, "#d8dee6", 8);
    sideY += 9;
    r.text("Sci +1 +5", 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text("Eng +1 +5", 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text("Sol +1 +5", 228, sideY, "#9db2c5", 7);

    sideY += 10;
    r.text("Economy", 228, sideY, "#d8dee6", 8);
    sideY += 9;
    const projected = snapshot.economy.projected;
    r.text(`Inc ${projected.income}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Maint ${projected.maintenance}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Sal ${projected.salaries}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Score ${projected.scoreBonus}`, 228, sideY, "#9db2c5", 7);
    sideY += 8;
    r.text(`Net ${projected.net}`, 228, sideY, projected.net >= 0 ? "#8dd19a" : "#d18d8d", 7);

    sideY += 10;
    const last = snapshot.economy.monthlyReports.at(-1);
    if (last) {
      r.text(`Last ${last.monthIso}`, 228, sideY, "#9db2c5", 7);
      sideY += 8;
      r.text(`After ${last.fundsAfter}`, 228, sideY, "#9db2c5", 7);
    }

    let tY = 154;
    r.text("Transfers (cancel)", 228, tY, "#d8dee6", 8);
    tY += 9;
    for (const transfer of base.transfers.slice(0, 3)) {
      r.text(`${transfer.id} ${transfer.label.slice(0, 7)} ${Math.ceil(transfer.etaHours)}h`, 228, tY, "#9db2c5", 7);
      tY += 8;
    }
  }

  onPointerDown(_: StateContext, x: number, y: number): StateTransition {
    const uiTransition = this.ui.onPointerDown(x, y);
    if (uiTransition.type !== "none") return uiTransition;

    const snapshot = this.campaign.getSnapshot();
    const base = snapshot.bases[0];

    if (this.panelMode === "base") {
      const rosterStartY = 117;
      const row = Math.floor((y - rosterStartY) / 8);
      if (x >= 14 && x <= 110 && row >= 0 && row < Math.min(8, base.roster.length)) {
        this.selectedSoldier = row;
      }
      if (x >= 120 && x <= 206 && row >= 0 && row < Math.min(8, base.roster.length)) {
        this.selectedSoldier = row;
        this.campaign.cycleSoldierCraftAssignment(base.roster[row].name);
      }

      if (x >= 120 && x <= 206 && y >= 155 && y <= 187) {
        const buildRow = Math.floor((y - 163) / 8);
        if (buildRow >= 0 && buildRow < Math.min(4, base.facilityConstruction.available.length)) {
          this.campaign.startFacilityConstruction(base.facilityConstruction.available[buildRow].type);
        }
      }

      if (x >= 228 && x <= 319 && y >= 155 && y <= 187) {
        const queueRow = Math.floor((y - 163) / 8);
        if (queueRow >= 0 && queueRow < Math.min(4, base.facilityConstruction.queue.length)) {
          this.campaign.cancelFacilityConstruction(base.facilityConstruction.queue[queueRow].id);
        }
      }
      return noTransition();
    }

    if (this.panelMode === "rnd") {
      const researchAvailStartY = 141;
      const researchActiveStartY = 192;
      const mfgAvailStartY = 141;
      const mfgActiveStartY = 192;

      if (x >= 14 && x <= 106) {
        const availRow = Math.floor((y - researchAvailStartY) / 8);
        if (availRow >= 0 && availRow < Math.min(5, base.research.available.length)) {
          const id = base.research.available[availRow].id;
          this.selectedResearchTopicId = id;
          this.campaign.startResearch(id);
          return noTransition();
        }

        const activeRow = Math.floor((y - researchActiveStartY) / 8);
        if (activeRow >= 0 && activeRow < Math.min(3, base.research.active.length)) {
          const id = base.research.active[activeRow].id;
          this.selectedResearchTopicId = id;
          if (x < 32) this.campaign.cancelResearch(id);
          else this.campaign.adjustResearchScientists(id, x < 60 ? -5 : 5);
          return noTransition();
        }
      }

      if (x >= 114 && x <= 206) {
        const availRow = Math.floor((y - mfgAvailStartY) / 8);
        if (availRow >= 0 && availRow < Math.min(5, base.manufacture.available.length)) {
          const id = base.manufacture.available[availRow].id;
          this.selectedManufactureTopicId = id;
          this.campaign.startManufacture(id);
          return noTransition();
        }

        const activeRow = Math.floor((y - mfgActiveStartY) / 8);
        if (activeRow >= 0 && activeRow < Math.min(3, base.manufacture.active.length)) {
          const id = base.manufacture.active[activeRow].id;
          this.selectedManufactureTopicId = id;
          if (x < 132) this.campaign.cancelManufacture(id);
          else if (x < 146) this.campaign.adjustManufactureEngineers(id, -5);
          else if (x < 178) this.campaign.adjustManufactureEngineers(id, 5);
          else this.campaign.adjustManufactureTarget(id, x < 192 ? -1 : 1);
          return noTransition();
        }
      }

      return noTransition();
    }

    // logistics interactions
    const featured = base.market.items.find((item) => item.id === base.market.featuredItemId) ?? base.market.items[0];
    const selectedCraft = base.craftLoadout[this.selectedCraftIndex % Math.max(1, base.craftLoadout.length)];

    if (featured && y >= 118 && y <= 142 && x >= 14 && x <= 210) {
      if (x < 66) this.campaign.orderItem(featured.id, 1);
      else if (x < 112) this.campaign.orderItem(featured.id, 5);
      else if (x < 156) this.campaign.sellItem(featured.id, 1);
      else if (x < 188) this.campaign.sellItem(featured.id, 5);
      else {
        const idx = base.market.items.findIndex((item) => item.id === featured.id);
        const next = base.market.items[(idx + 1) % Math.max(1, base.market.items.length)];
        if (next) this.campaign.setFeaturedMarketItem(next.id);
      }
      return noTransition();
    }

    if (x >= 14 && x <= 210 && y >= 144 && y <= 156 && base.craftLoadout.length > 0) {
      this.selectedCraftIndex = (this.selectedCraftIndex + 1) % base.craftLoadout.length;
      return noTransition();
    }

    if (selectedCraft && x >= 14 && x <= 106 && y >= 162 && y <= 190) {
      const row = Math.floor((y - 168) / 8);
      if (row >= 0 && row < Math.min(3, base.stores.length)) {
        this.campaign.transferStoreItemToCraft(selectedCraft.key, base.stores[row].id, 1);
      }
      return noTransition();
    }

    if (selectedCraft && x >= 114 && x <= 206 && y >= 162 && y <= 190) {
      const row = Math.floor((y - 168) / 8);
      if (row >= 0 && row < Math.min(3, selectedCraft.items.length)) {
        this.campaign.transferCraftItemToStore(selectedCraft.key, selectedCraft.items[row].id, 1);
      }
      return noTransition();
    }

    if (x >= 228 && x <= 319 && y >= 118 && y <= 146) {
      const row = Math.floor((y - 118) / 8);
      if (row === 0) {
        this.campaign.hireScientists(x < 276 ? 1 : 5);
      } else if (row === 1) {
        this.campaign.hireEngineers(x < 276 ? 1 : 5);
      } else if (row === 2) {
        this.campaign.hireSoldiers(x < 276 ? 1 : 5);
      }
      return noTransition();
    }

    if (x >= 228 && x <= 319 && y >= 163 && y <= 189) {
      const transferRow = Math.floor((y - 163) / 8);
      const transfer = base.transfers[transferRow];
      if (transfer) this.campaign.cancelTransfer(transfer.id);
      return noTransition();
    }

    return noTransition();
  }

  onKeyDown(_: StateContext, event: KeyboardEvent): StateTransition {
    const transition = this.ui.onKeyDown(event);
    if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    return transition;
  }
}
