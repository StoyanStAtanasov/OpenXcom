import { CampaignModel } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiState } from "../interface/UiState";
import { BasescapeState } from "./BasescapeState";
import { BattlescapeState } from "./BattlescapeState";
import { CouncilReportState } from "./CouncilReportState";
import { StrategicOutcomeState } from "./StrategicOutcomeState";
import { StatisticsState } from "./StatisticsState";

export class GeoscapeState implements GameState {
  readonly id = "geoscape";
  private readonly campaign: CampaignModel;
  private readonly ui = new UiState();
  private speed = 1;
  private selectedContactId = "";
  private selectedInterceptorId = "";
  private selectedMissionId = "";

  constructor(campaign: CampaignModel) {
    this.campaign = campaign;
  }

  enter(ctx: StateContext): void {
    void ctx.game.getRenderer().setPalettePack(this.campaign.getGameId() === "xcom1" ? "ufo" : "tftd");
    const { width, height } = ctx.game.getRenderer().getSize();
    const baseStyle = {
      background: "#0e2238",
      border: "#74a0c8",
      focusBorder: "#9fd8ff",
      foreground: "#f4f7fb",
      fontSize: 8
    };
    this.ui.setWidgets([
      new TextButton(width - 94, 6, 86, 16, "FINAL", () => {
        if (this.campaign.isCampaignLocked()) return noTransition();
        this.campaign.launchFinalAssault();
        return noTransition();
      }, baseStyle),
      new TextButton(width - 94, 28, 86, 16, "BASESCAPE", () => ({ type: "switch", next: new BasescapeState(this.campaign, this) }), baseStyle),
      new TextButton(width - 94, 50, 86, 16, "TIME x1", () => {
        this.speed = 1;
        this.campaign.setTimeCompression(this.speed);
        return noTransition();
      }, () => ({
        ...baseStyle,
        background: this.speed === 1 ? "#21486e" : baseStyle.background
      })),
      new TextButton(width - 94, 72, 86, 16, "TIME x6", () => {
        this.speed = 6;
        this.campaign.setTimeCompression(this.speed);
        return noTransition();
      }, () => ({
        ...baseStyle,
        background: this.speed === 6 ? "#21486e" : baseStyle.background
      })),
      new TextButton(width - 94, 94, 86, 16, "TIME x60", () => {
        this.speed = 60;
        this.campaign.setTimeCompression(this.speed);
        return noTransition();
      }, () => ({
        ...baseStyle,
        background: this.speed === 60 ? "#21486e" : baseStyle.background
      })),
      new TextButton(width - 94, 116, 86, 16, "INTERCEPT", () => {
        if (this.campaign.isCampaignLocked()) return noTransition();
        if (!this.selectedContactId) return noTransition();
        this.campaign.issueIntercept(this.selectedContactId, this.selectedInterceptorId || undefined);
        return noTransition();
      }, baseStyle),
      new TextButton(width - 94, 138, 86, 16, "RECALL", () => {
        if (this.campaign.isCampaignLocked()) return noTransition();
        if (!this.selectedInterceptorId) return noTransition();
        this.campaign.recallInterceptor(this.selectedInterceptorId);
        return noTransition();
      }, baseStyle),
      new TextButton(width - 94, 160, 86, 16, "LAUNCH", () => {
        if (this.campaign.isCampaignLocked()) return noTransition();
        if (!this.selectedMissionId) return noTransition();
        this.campaign.launchMissionAssault(this.selectedMissionId);
        return noTransition();
      }, baseStyle),
      new TextButton(width - 94, 182, 42, 16, "IGN", () => {
        if (this.campaign.isCampaignLocked()) return noTransition();
        if (!this.selectedMissionId) return noTransition();
        this.campaign.resolveMission(this.selectedMissionId, false);
        return noTransition();
      }, baseStyle),
      new TextButton(width - 50, 182, 42, 16, "STATS", () => ({ type: "switch", next: new StatisticsState(this.campaign, this) }), baseStyle)
    ]);

    // Avoid dead assignment warning for height in future geoscape overlays.
    void height;
  }

  update(_: StateContext, dtMs: number): StateTransition {
    this.campaign.advance(dtMs);
    const strategic = this.campaign.consumeStrategicOutcomeAlert();
    if (strategic) {
      return { type: "switch", next: new StrategicOutcomeState(strategic, this) };
    }
    if (this.campaign.consumeGroundCombatReady()) {
      return { type: "switch", next: new BattlescapeState(this.campaign, new BasescapeState(this.campaign, this)) };
    }
    const council = this.campaign.consumeCouncilReport();
    if (council) {
      return { type: "switch", next: new CouncilReportState(council, this) };
    }
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    const { width, height } = r.getSize();
    const snapshot = this.campaign.getSnapshot();
    r.clear("#001322");

    // Placeholder globe grid.
    r.rect(20, 24, 190, 145, "#07253f");
    for (let x = 20; x <= 210; x += 19) r.strokeRect(x, 24, 1, 145, "#18415f");
    for (let y = 24; y <= 169; y += 18) r.strokeRect(20, y, 190, 1, "#18415f");

    r.text("GEOSCAPE", 8, 14, "#9fd8ff", 10);
    r.text(`Date: ${snapshot.dateIsoUtc.slice(0, 16).replace("T", " ")}`, 8, 185, "#e2f1ff", 9);
    r.text(`Funds: $${snapshot.funds.toLocaleString()}`, 146, 185, "#e2f1ff", 9);
    r.text(`Income: $${snapshot.monthlyIncome.toLocaleString()}/m`, 8, 194, "#8eb4d0", 7);
    r.text(`Score: ${snapshot.geoscape.score}`, 86, 194, "#8eb4d0", 7);
    const strategic = this.campaign.getStrategicStatus();
    const finalLabel = strategic.finalAssaultLaunchable ? "READY" : strategic.finalAssaultUnlocked ? "STANDBY" : "LOCKED";
    r.text(`Final Assault: ${finalLabel}`, 154, 194, strategic.finalAssaultLaunchable ? "#8cff8c" : "#8eb4d0", 7);
    r.text(`Deficit ${strategic.deficitMonths}m  Pacts ${strategic.pactCount}/${strategic.totalCountries}`, 8, 202, "#6f90ab", 7);
    if (this.campaign.isCampaignLocked()) {
      r.text("CAMPAIGN LOCKED", 216, 14, "#ff9a9a", 8);
    }

    // Render contacts and interceptors on map.
    for (const contact of snapshot.geoscape.contacts) {
      const px = 20 + Math.floor(contact.x * 190);
      const py = 24 + Math.floor(contact.y * 145);
      const color = contact.id === this.selectedContactId ? "#ff6b6b" : "#f2ce6b";
      r.rect(px - 1, py - 1, 3, 3, color);
    }
    for (const interceptor of snapshot.geoscape.interceptors) {
      const px = 20 + Math.floor(interceptor.x * 190);
      const py = 24 + Math.floor(interceptor.y * 145);
      const color = interceptor.id === this.selectedInterceptorId ? "#7de2ff" : "#96b8d2";
      r.strokeRect(px - 2, py - 2, 4, 4, color);
    }
    for (const mission of snapshot.geoscape.missions) {
      const px = 20 + Math.floor(mission.x * 190);
      const py = 24 + Math.floor(mission.y * 145);
      const color = mission.id === this.selectedMissionId ? "#8cff8c" : "#5cd95c";
      r.strokeRect(px - 3, py - 3, 6, 6, color);
    }

    let y = 38;
    r.text("Contacts", 224, y, "#b8d8ef", 9);
    y += 10;
    for (const contact of snapshot.geoscape.contacts.slice(0, 4)) {
      const marker = contact.id === this.selectedContactId ? ">" : " ";
      r.text(`${marker}${contact.id} ${contact.size}`, 224, y, "#87a9c3", 8);
      y += 9;
    }

    y += 2;
    r.text("Interceptors", 224, y, "#b8d8ef", 9);
    y += 10;
    for (const interceptor of snapshot.geoscape.interceptors.slice(0, 3)) {
      const marker = interceptor.id === this.selectedInterceptorId ? ">" : " ";
      r.text(`${marker}${interceptor.id} ${interceptor.status} D${Math.round(interceptor.damagePct)}`, 224, y, "#87a9c3", 8);
      y += 9;
    }

    y += 2;
    r.text("Missions", 224, y, "#b8d8ef", 9);
    y += 10;
    for (const mission of snapshot.geoscape.missions.slice(0, 3)) {
      const marker = mission.id === this.selectedMissionId ? ">" : " ";
      r.text(`${marker}${mission.id} ${mission.type}`, 224, y, "#87a9c3", 8);
      y += 9;
    }

    y += 2;
    r.text("Council", 224, y, "#b8d8ef", 9);
    y += 10;
    const pactCount = snapshot.countries.filter((country) => country.pact).length;
    r.text(`Pacts ${pactCount}/${snapshot.countries.length}`, 224, y, "#87a9c3", 8);
    y += 8;
    for (const country of snapshot.countries
      .slice()
      .sort((a, b) => a.satisfaction - b.satisfaction)
      .slice(0, 2)) {
      r.text(`${country.label.slice(0, 12)} S${country.satisfaction}`, 224, y, country.pact ? "#d58f8f" : "#87a9c3", 7);
      y += 8;
    }

    y += 2;
    r.text("Events", 224, y, "#b8d8ef", 9);
    y += 9;
    for (const event of snapshot.geoscape.events.slice(-3)) {
      r.text(event.slice(0, 26), 224, y, "#87a9c3", 7);
      y += 8;
    }

    this.ui.draw(r);

    r.text(`Scale ${width}x${height}`, 8, height - 4, "#6f90ab", 7);
  }

  onPointerDown(_: StateContext, x: number, y: number): StateTransition {
    const uiTransition = this.ui.onPointerDown(x, y);
    if (uiTransition.type !== "none") return uiTransition;

    const snapshot = this.campaign.getSnapshot();
    if (x >= 224 && x <= 319) {
      const contactRow = Math.floor((y - 48) / 9);
      if (contactRow >= 0 && contactRow < Math.min(4, snapshot.geoscape.contacts.length)) {
        this.selectedContactId = snapshot.geoscape.contacts[contactRow].id;
        return noTransition();
      }

      const interceptorRow = Math.floor((y - 96) / 9);
      if (interceptorRow >= 0 && interceptorRow < Math.min(3, snapshot.geoscape.interceptors.length)) {
        this.selectedInterceptorId = snapshot.geoscape.interceptors[interceptorRow].id;
        return noTransition();
      }

      const missionRow = Math.floor((y - 133) / 9);
      if (missionRow >= 0 && missionRow < Math.min(3, snapshot.geoscape.missions.length)) {
        this.selectedMissionId = snapshot.geoscape.missions[missionRow].id;
        return noTransition();
      }
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
