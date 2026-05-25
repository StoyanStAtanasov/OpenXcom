import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { BasescapeState } from "../Basescape/BasescapeState.ts";
import { SellState } from "../Basescape/SellState.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";
import { Globe } from "./Globe.ts";
import { InterceptState } from "./InterceptState.ts";
import { MultipleTargetsState } from "./MultipleTargetsState.ts";
import { GraphsState } from "./GraphsState.ts";
import { FundingState } from "./FundingState.ts";
import { CraftPatrolState } from "./CraftPatrolState.ts";
import { LowFuelState } from "./LowFuelState.ts";
import { CraftErrorState } from "./CraftErrorState.ts";
import { ItemsArrivingState } from "./ItemsArrivingState.ts";
import { ProductionCompleteState } from "./ProductionCompleteState.ts";
import { MissionDetectedState } from "./MissionDetectedState.ts";
import { MonthlyReportState } from "./MonthlyReportState.ts";
import { UfoDetectedState } from "./UfoDetectedState.ts";
import { UfoLostState } from "./UfoLostState.ts";
import { ResearchCompleteState } from "./ResearchCompleteState.ts";
import { NewPossibleResearchState } from "./NewPossibleResearchState.ts";
import { ResearchRequiredState } from "./ResearchRequiredState.ts";
import { NewPossibleManufactureState } from "./NewPossibleManufactureState.ts";
import { Waypoint } from "../Savegame/Waypoint.ts";
import { AlienMission } from "../Savegame/AlienMission.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { Production } from "../Savegame/Production.ts";
import type { ResearchProject } from "../Savegame/ResearchProject.ts";
import { productionProgress_e } from "../Savegame/Production.ts";
import { TimeTrigger } from "../Savegame/GameTime.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";
import { UfoTrajectory } from "../Mod/UfoTrajectory.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import type { Mod } from "../Mod/Mod.ts";
import { GenerationType, type RuleMissionScript } from "../Mod/RuleMissionScript.ts";
import type { RuleAlienMission } from "../Mod/RuleAlienMission.ts";
import { RNG } from "../Engine/RNG.ts";
import { GeoscapeCraftState } from "./GeoscapeCraftState.ts";
import { ConfirmLandingState } from "./ConfirmLandingState.ts";
import { AlienBase } from "../Savegame/AlienBase.ts";
import { AlienBaseState } from "./AlienBaseState.ts";
import { MissionSite } from "../Savegame/MissionSite.ts";
import { DogfightState } from "./DogfightState.ts";
import { DogfightErrorState } from "./DogfightErrorState.ts";
import { BaseDefenseState } from "./BaseDefenseState.ts";
import { BaseDestroyedState } from "./BaseDestroyedState.ts";
import { BriefingState } from "../Battlescape/BriefingState.ts";
import { CutsceneState } from "../Menu/CutsceneState.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { Base } from "../Savegame/Base.ts";
import type { SavedGame } from "../Savegame/SavedGame.ts";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

type UfoMissionRuntime = {
  ufoReachedWaypoint?: (ufo: Ufo, engine: unknown, globe: Globe) => void;
  ufoLifting?: (ufo: Ufo, save: SavedGame) => void;
  setWaveCountdown?: (minutes: number) => void;
};

export class GeoscapeState extends State {
  private _bg: Surface;
  private _sideLine: Surface;
  private _sidebar: Surface;
  private _globe: Globe;
  private _btnIntercept: TextButton;
  private _btnBases: TextButton;
  private _btnGraphs: TextButton;
  private _btnUfopaedia: TextButton;
  private _btnOptions: TextButton;
  private _btnFunding: TextButton;
  private _btn5Secs: TextButton;
  private _btn1Min: TextButton;
  private _btn5Mins: TextButton;
  private _btn30Mins: TextButton;
  private _btn1Hour: TextButton;
  private _btn1Day: TextButton;
  private _txtFunds: Text;
  private _txtHour: Text;
  private _txtHourSep: Text;
  private _txtMin: Text;
  private _txtMinSep: Text;
  private _txtSec: Text;
  private _txtDay: Text;
  private _txtMonth: Text;
  private _txtYear: Text;
  private _timeSpeed: { value: TextButton | null };
  private _gameTimer: Timer;
  private _pause = false;
  private _popups: State[] = [];
  private _dogfights: DogfightState[] = [];
  private _dogfightsToBeStarted: DogfightState[] = [];
  private _minimizedDogfights = 0;

  constructor() {
    super();
    const screenWidth = Options.baseXGeoscape;
    const screenHeight = Options.baseYGeoscape;
    const hd = this.game().getMod()?.getSurface("ALTGEOBORD.SCR");
    this._bg = hd || new Surface(screenWidth - 64, screenHeight);
    this._sideLine = new Surface(64, screenHeight, screenWidth - 64, 0);
    this._sidebar = new Surface(64, 200, screenWidth - 64, screenHeight / 2 - 100);
    this._globe = new Globe(this.game(), (screenWidth - 64) / 2, screenHeight / 2, screenWidth - 64, screenHeight, 0, 0);
    this._bg.setX(Math.trunc((this._globe.getWidth() - this._bg.getWidth()) / 2));
    this._bg.setY(Math.trunc((this._globe.getHeight() - this._bg.getHeight()) / 2));

    this._btnIntercept = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 100);
    this._btnBases = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 88);
    this._btnGraphs = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 76);
    this._btnUfopaedia = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 64);
    this._btnOptions = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 52);
    this._btnFunding = new TextButton(63, 11, screenWidth - 63, screenHeight / 2 - 40);
    this._btn5Secs = new TextButton(31, 13, screenWidth - 63, screenHeight / 2 + 12);
    this._btn1Min = new TextButton(31, 13, screenWidth - 31, screenHeight / 2 + 12);
    this._btn5Mins = new TextButton(31, 13, screenWidth - 63, screenHeight / 2 + 26);
    this._btn30Mins = new TextButton(31, 13, screenWidth - 31, screenHeight / 2 + 26);
    this._btn1Hour = new TextButton(31, 13, screenWidth - 63, screenHeight / 2 + 40);
    this._btn1Day = new TextButton(31, 13, screenWidth - 31, screenHeight / 2 + 40);
    this._timeSpeed = { value: this._btn5Secs };
    this._gameTimer = new Timer(Options.geoClockSpeed, true);
    this._txtHour = new Text(20, 16, screenWidth - 61, screenHeight / 2 - 26);
    this._txtHourSep = new Text(4, 16, screenWidth - 41, screenHeight / 2 - 26);
    this._txtMin = new Text(20, 16, screenWidth - 37, screenHeight / 2 - 26);
    this._txtMinSep = new Text(4, 16, screenWidth - 17, screenHeight / 2 - 26);
    this._txtSec = new Text(11, 8, screenWidth - 13, screenHeight / 2 - 20);
    this._txtDay = new Text(29, 8, screenWidth - 61, screenHeight / 2 - 6);
    this._txtMonth = new Text(29, 8, screenWidth - 32, screenHeight / 2 - 6);
    this._txtYear = new Text(59, 8, screenWidth - 61, screenHeight / 2 + 1);
    this._txtFunds = new Text(59, 8, screenWidth - 61, screenHeight / 2 - 27);

    this.setInterface("geoscape");
    this.add(this._bg);
    this.add(this._sideLine);
    this.add(this._sidebar);
    this.add(this._globe);
    for (const button of [this._btnIntercept, this._btnBases, this._btnGraphs, this._btnUfopaedia, this._btnOptions, this._btnFunding, this._btn5Secs, this._btn1Min, this._btn5Mins, this._btn30Mins, this._btn1Hour, this._btn1Day]) {
      this.add(button, "button", "geoscape");
      button.setGeoscapeButton(true);
    }
    for (const text of [this._txtFunds, this._txtHour, this._txtHourSep, this._txtMin, this._txtMinSep, this._txtSec, this._txtDay, this._txtMonth, this._txtYear]) {
      this.add(text, "text", "geoscape");
      text.setAlign(ALIGN_CENTER);
    }

    const geobord = this.game().getMod()?.getSurface("GEOBORD.SCR");
    if (geobord) {
      geobord.setX(this._sidebar.getX() - geobord.getWidth() + this._sidebar.getWidth());
      geobord.setY(this._sidebar.getY());
      this._sidebar.copy(geobord);
    } else {
      this._sidebar.drawRect(0, 0, this._sidebar.getWidth(), this._sidebar.getHeight(), 224);
    }
    this._sideLine.drawRect(0, 0, this._sideLine.getWidth(), this._sideLine.getHeight(), 15);

    this._btnIntercept.setText(String(this.tr("STR_INTERCEPT")));
    this._btnBases.setText(String(this.tr("STR_BASES")));
    this._btnGraphs.setText(String(this.tr("STR_GRAPHS")));
    this._btnUfopaedia.setText(String(this.tr("STR_UFOPAEDIA_UC")));
    this._btnOptions.setText(String(this.tr("STR_OPTIONS_UC")));
    this._btnFunding.setText(String(this.tr("STR_FUNDING_UC")));
    this._btn5Secs.setText(String(this.tr("STR_5_SECONDS")));
    this._btn1Min.setText(String(this.tr("STR_1_MINUTE")));
    this._btn5Mins.setText(String(this.tr("STR_5_MINUTES")));
    this._btn30Mins.setText(String(this.tr("STR_30_MINUTES")));
    this._btn1Hour.setText(String(this.tr("STR_1_HOUR")));
    this._btn1Day.setText(String(this.tr("STR_1_DAY")));

    this._btnIntercept.onMouseClick(this.btnInterceptClick.bind(this));
    this._btnIntercept.onKeyboardPress(this.btnInterceptClick.bind(this), Options.keyGeoIntercept);
    this._btnBases.onMouseClick(this.btnBasesClick.bind(this));
    this._btnBases.onKeyboardPress(this.btnBasesClick.bind(this), Options.keyGeoBases);
    this._btnGraphs.onMouseClick(this.btnGraphsClick.bind(this));
    this._btnGraphs.onKeyboardPress(this.btnGraphsClick.bind(this), Options.keyGeoGraphs);
    this._btnFunding.onMouseClick(this.btnFundingClick.bind(this));
    this._btnFunding.onKeyboardPress(this.btnFundingClick.bind(this), Options.keyGeoFunding);
    this._globe.onMouseClick(this.globeClick.bind(this));
    this._gameTimer.onTimer(this.timeAdvance.bind(this));
    this._gameTimer.start();

    const timerButtons = [this._btn5Secs, this._btn1Min, this._btn5Mins, this._btn30Mins, this._btn1Hour, this._btn1Day];
    const timerKeys = [Options.keyGeoSpeed1, Options.keyGeoSpeed2, Options.keyGeoSpeed3, Options.keyGeoSpeed4, Options.keyGeoSpeed5, Options.keyGeoSpeed6];
    for (let i = 0; i < timerButtons.length; ++i) {
      timerButtons[i].setGroup(this._timeSpeed);
      timerButtons[i].onMouseClick(this.btnTimerClick.bind(this));
      timerButtons[i].onKeyboardPress(this.btnTimerClick.bind(this), timerKeys[i]);
    }

    this.timeDisplay();
  }

  override init(): void {
    super.init();
    this.timeDisplay();
    this._globe.rotateStop();
    this._globe.setFocus(true);
    this._globe.draw();

    const save = this.game().getSavedGame();
    if (this._dogfights.length === 0 && this._dogfightsToBeStarted.length === 0) {
      if (save?.getMonthsPassed() === -1) {
        this.game().getMod()?.playMusic("GMGEO", 1);
      } else {
        this.game().getMod()?.playMusic("GMGEO");
      }
    } else {
      this.game().getMod()?.playMusic("GMINTER");
    }
    this._globe.setNewBaseHover(false);
  }

  getGlobe(): Globe {
    return this._globe;
  }

  override think(): void {
    super.think();
    if (this._popups.length > 0) {
      this._globe.rotateStop();
      const popup = this._popups.shift();
      if (popup) {
        this.game().pushState(popup);
      }
      return;
    }
    if (this._dogfights.length > 0) {
      this.handleDogfights();
      if (this._dogfights.length > 0 && this._dogfights.length !== this._minimizedDogfights) {
        return;
      }
    }
    this._gameTimer.think(this, null);
    if (!this._pause) {
      this._globe.think();
    }
  }

  override handle(action: Action): void {
    for (let i = this._dogfights.length - 1; i >= 0; --i) {
      this._dogfights[i].handle(action);
    }
    super.handle(action);
  }

  override blit(): void {
    super.blit();
    for (const dogfight of this._dogfights) {
      dogfight.blit();
    }
  }

  timeDisplay(): void {
    const save = this.game().getSavedGame();
    const time = save?.getTime();
    if (!save || !time) {
      return;
    }
    this._txtFunds.setText(`$${save.getFunds().toLocaleString("en-US")}`);
    this._txtHour.setText(pad2(time.getHour()));
    this._txtHourSep.setText(":");
    this._txtMin.setText(pad2(time.getMinute()));
    this._txtMinSep.setText(":");
    this._txtSec.setText(pad2(time.getSecond()));
    this._txtDay.setText(pad2(time.getDay()));
    this._txtMonth.setText(pad2(time.getMonth()));
    this._txtYear.setText(String(time.getYear()));
  }

  btnInterceptClick(): void {
    if (this.buttonsDisabled()) {
      return;
    }
    this.game().pushState(new InterceptState(this._globe));
  }

  btnBasesClick(): void {
    if (this.buttonsDisabled()) {
      return;
    }
    this.timerReset();
    const base = this.game().getSavedGame()?.getSelectedBase() || null;
    this.game().pushState(new BasescapeState(base, this._globe));
  }

  btnGraphsClick(): void {
    if (this.buttonsDisabled()) {
      return;
    }
    this.game().pushState(new GraphsState());
  }

  btnFundingClick(): void {
    if (this.buttonsDisabled()) {
      return;
    }
    this.game().pushState(new FundingState());
  }

  btnTimerClick(action?: Action): void {
    const sender = action?.getSender();
    if (sender instanceof TextButton) {
      this._timeSpeed.value = sender;
    }
  }

  timeAdvance(): void {
    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }
    let timeSpan = 0;
    if (this._timeSpeed.value === this._btn5Secs) {
      timeSpan = 1;
    } else if (this._timeSpeed.value === this._btn1Min) {
      timeSpan = 12;
    } else if (this._timeSpeed.value === this._btn5Mins) {
      timeSpan = 12 * 5;
    } else if (this._timeSpeed.value === this._btn30Mins) {
      timeSpan = 12 * 5 * 6;
    } else if (this._timeSpeed.value === this._btn1Hour) {
      timeSpan = 12 * 5 * 6 * 2;
    } else if (this._timeSpeed.value === this._btn1Day) {
      timeSpan = 12 * 5 * 6 * 2 * 24;
    }

    for (let i = 0; i < timeSpan && !this._pause; ++i) {
      const trigger = save.getTime().advance();
      switch (trigger) {
        case TimeTrigger.TIME_1MONTH:
          this.time1Month();
        case TimeTrigger.TIME_1DAY:
          this.time1Day();
        case TimeTrigger.TIME_1HOUR:
          this.time1Hour();
        case TimeTrigger.TIME_30MIN:
          this.time30Minutes();
        case TimeTrigger.TIME_10MIN:
          this.time10Minutes();
        case TimeTrigger.TIME_5SEC:
          this.time5Seconds();
      }
    }

    this._pause = this._dogfightsToBeStarted.length > 0;
    this.timeDisplay();
    this._globe.draw();
  }

  time5Seconds(): void {
    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }

    for (const ufo of save.getUfos()) {
      switch (ufo.getStatus()) {
        case UfoStatus.FLYING: {
          ufo.think();
          if (ufo.reachedDestination()) {
            const missionSitesBefore = save.getMissionSites().length;
            const mission = ufo.getMission() as UfoMissionRuntime | null;
            const detected = ufo.getDetected();
            mission?.ufoReachedWaypoint?.(ufo, this.game(), this._globe);
            if (detected !== ufo.getDetected() && ufo.getFollowers().length > 0) {
              if (!(ufo.getTrajectory()?.getID?.() === UfoTrajectory.RETALIATION_ASSAULT_RUN && ufo.getStatus() === UfoStatus.LANDED)) {
                this.popup(new UfoLostState(ufo.getName(this.game().getLanguage())));
              }
            }
            if (missionSitesBefore < save.getMissionSites().length) {
              const site = save.getMissionSites().at(-1);
              if (site) {
                site.setDetected(true);
                this.popup(new MissionDetectedState(site, this));
              }
            }
            if (ufo.getStatus() === UfoStatus.DESTROYED) {
              return;
            }
            const destination = ufo.getDestination();
            if (destination instanceof Base) {
              mission?.setWaveCountdown?.(30 * (RNG.generate(0, 400) + 48));
              ufo.setDestination(null);
              destination.setupDefenses();
              this.timerReset();
              if (destination.getDefenses().length > 0) {
                this.popup(new BaseDefenseState(destination, ufo, this));
              } else {
                this.handleBaseDefense(destination, ufo);
                return;
              }
            }
          }
          break;
        }
        case UfoStatus.LANDED: {
          ufo.think();
          if (ufo.getSecondsRemaining() === 0) {
            const mission = ufo.getMission() as UfoMissionRuntime | null;
            const detected = ufo.getDetected();
            mission?.ufoLifting?.(ufo, save);
            if (detected !== ufo.getDetected() && ufo.getFollowers().length > 0) {
              this.popup(new UfoLostState(ufo.getName(this.game().getLanguage())));
            }
          }
          break;
        }
        case UfoStatus.CRASHED:
          ufo.think();
          if (ufo.getSecondsRemaining() === 0) {
            ufo.setDetected(false);
            ufo.setStatus(UfoStatus.DESTROYED);
          }
          break;
        case UfoStatus.DESTROYED:
          break;
      }
    }

    for (const base of save.getBases()) {
      for (const craft of base.getCrafts()) {
        if (craft.getDestination() === null) {
          continue;
        }
        const destination = craft.getDestination();
        if (destination instanceof Ufo) {
          if (!destination.getDetected()) {
            if (destination.getTrajectory()?.getID?.() === UfoTrajectory.RETALIATION_ASSAULT_RUN
              && (destination.getStatus() === UfoStatus.LANDED || destination.getStatus() === UfoStatus.DESTROYED)) {
              craft.returnToBase();
            } else {
              const waypoint = new Waypoint();
              waypoint.setLongitude(destination.getLongitude());
              waypoint.setLatitude(destination.getLatitude());
              waypoint.setId(destination.getId());
              craft.setDestination(null);
              this.popup(new GeoscapeCraftState(craft, this._globe, waypoint));
            }
          }
          if (destination.getStatus() === UfoStatus.LANDED && craft.isInDogfight()) {
            craft.setInDogfight(false);
          } else if (destination.getStatus() === UfoStatus.DESTROYED) {
            craft.returnToBase();
          }
        } else if (craft.isInDogfight()) {
          craft.setInDogfight(false);
        }
        craft.think();
        if (craft.reachedDestination()) {
          const reached = craft.getDestination();
          if (reached instanceof Ufo) {
            switch (reached.getStatus()) {
              case UfoStatus.FLYING:
                this.startFlyingUfoDogfight(craft, reached);
                break;
              case UfoStatus.LANDED:
              case UfoStatus.CRASHED:
              case UfoStatus.DESTROYED:
                if (craft.getNumSoldiers() > 0 || craft.getNumVehicles() > 0) {
                  if (!craft.isInDogfight()) {
                    this.timerReset();
                    this.popup(this.createConfirmLandingState(craft, reached));
                  }
                } else if (reached.getStatus() !== UfoStatus.LANDED) {
                  craft.returnToBase();
                }
                break;
            }
          } else if (reached instanceof Waypoint) {
            this.popup(new CraftPatrolState(craft, this._globe));
            craft.setDestination(null);
          } else if (reached instanceof MissionSite) {
            if (craft.getNumSoldiers() > 0 || craft.getNumVehicles() > 0) {
              this.timerReset();
              this.popup(this.createConfirmLandingState(craft, reached));
            } else {
              craft.returnToBase();
            }
          } else if (reached instanceof AlienBase) {
            if (reached.isDiscovered()) {
              if (craft.getNumSoldiers() > 0 || craft.getNumVehicles() > 0) {
                this.timerReset();
                this.popup(this.createConfirmLandingState(craft, reached));
              } else {
                craft.returnToBase();
              }
            }
          }
        }
      }
    }
    for (let i = 0; i < save.getWaypoints().length;) {
      const waypoint = save.getWaypoints()[i];
      if (waypoint instanceof Waypoint && waypoint.getFollowers().length === 0) {
        save.getWaypoints().splice(i, 1);
      } else {
        ++i;
      }
    }
  }

  private createConfirmLandingState(craft: Craft, target: Ufo | MissionSite | AlienBase): ConfirmLandingState {
    const polygon = this._globe.getPolygonTextureAndShade(target.getLongitude(), target.getLatitude());
    let texture = polygon.texture;
    if (target instanceof MissionSite && this.game().getMod()?.getGlobe().getTexture(target.getTexture())) {
      texture = target.getTexture();
    }
    return new ConfirmLandingState(
      craft,
      this.game().getMod()?.getGlobe().getTexture(texture) || null,
      polygon.shade
    );
  }

  time10Minutes(): void {
    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }
    for (const base of save.getBases()) {
      for (const craft of base.getCrafts()) {
        if (craft.getStatus() === "STR_OUT") {
          craft.consumeFuel();
          if (!craft.getLowFuel() && craft.getFuel() <= craft.getFuelLimit()) {
            craft.setLowFuel(true);
            craft.returnToBase();
            this.popup(new LowFuelState(craft, this));
          }
        }
      }
    }
  }

  time30Minutes(): void {
    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }

    for (const mission of save.getAlienMissions()) {
      mission.think(this.game(), this._globe);
    }
    const alienMissions = save.getAlienMissions();
    for (let i = 0; i < alienMissions.length;) {
      if (alienMissions[i].isOver()) {
        alienMissions.splice(i, 1);
      } else {
        ++i;
      }
    }

    for (const ufo of save.getUfos()) {
      if (ufo.getStatus() === UfoStatus.CRASHED) {
        if (ufo.getSecondsRemaining() >= 30 * 60) {
          ufo.setSecondsRemaining(ufo.getSecondsRemaining() - 30 * 60);
        } else {
          ufo.setStatus(UfoStatus.DESTROYED);
        }
      }
    }

    for (const base of save.getBases()) {
      for (const craft of base.getCrafts()) {
        if (craft.getStatus() === "STR_REFUELLING") {
          const missing = craft.refuel();
          if (missing.length > 0) {
            const msg = String(this.tr("STR_NOT_ENOUGH_ITEM_TO_REFUEL_CRAFT_AT_BASE")
              .arg(this.tr(missing))
              .arg(craft.getName(this.game().getLanguage()))
              .arg(base.getName()));
            this.popup(new CraftErrorState(this, msg));
          }
        }
      }
    }

    for (const ufo of save.getUfos()) {
      let points = ufo.getRules().getMissionScore();
      if (ufo.getStatus() === UfoStatus.LANDED) {
        points *= 2;
      }
      if (ufo.getStatus() === UfoStatus.LANDED || ufo.getStatus() === UfoStatus.FLYING) {
        for (const region of save.getRegions()) {
          if (region.getRules().insideRegion(ufo.getLongitude(), ufo.getLatitude())) {
            region.addActivityAlien(points);
            break;
          }
        }
        for (const country of save.getCountries()) {
          if (country.getRules().insideCountry(ufo.getLongitude(), ufo.getLatitude())) {
            country.addActivityAlien(points);
            break;
          }
        }

        if (!ufo.getDetected()) {
          let detected = false;
          let hyperdetected = false;
          for (const base of save.getBases()) {
            if (hyperdetected) {
              break;
            }
            switch (base.detect(ufo)) {
              case 2:
                ufo.setHyperDetected(true);
                hyperdetected = true;
              case 1:
                detected = true;
                break;
              default:
                break;
            }
            for (const craft of base.getCrafts()) {
              if (detected) {
                break;
              }
              if (craft.getStatus() === "STR_OUT" && craft.detect(ufo)) {
                detected = true;
                break;
              }
            }
          }
          if (detected) {
            ufo.setDetected(true);
            this.popup(new UfoDetectedState(ufo, this, true, ufo.getHyperDetected()));
          }
        } else {
          let detected = false;
          let hyperdetected = false;
          for (const base of save.getBases()) {
            if (hyperdetected) {
              break;
            }
            switch (base.insideRadarRange(ufo)) {
              case 2:
                detected = true;
                hyperdetected = true;
                ufo.setHyperDetected(true);
                break;
              case 1:
                detected = true;
                hyperdetected = ufo.getHyperDetected();
                break;
              default:
                break;
            }
            for (const craft of base.getCrafts()) {
              if (detected) {
                break;
              }
              if (craft.getStatus() === "STR_OUT" && craft.insideRadarRange(ufo)) {
                detected = true;
                hyperdetected = ufo.getHyperDetected();
                break;
              }
            }
          }
          if (!detected) {
            ufo.setDetected(false);
            ufo.setHyperDetected(false);
            if (ufo.getFollowers().length > 0) {
              this.popup(new UfoLostState(ufo.getName(this.game().getLanguage())));
            }
          }
        }
      }
    }

    const missionSites = save.getMissionSites();
    for (let i = 0; i < missionSites.length;) {
      if (this.processMissionSite(missionSites[i])) {
        missionSites.splice(i, 1);
      } else {
        ++i;
      }
    }
  }

  private processMissionSite(site: MissionSite): boolean {
    const save = this.game().getSavedGame();
    if (!save) {
      return false;
    }
    let removeSite = site.getSecondsRemaining() < 30 * 60;
    if (!removeSite) {
      site.setSecondsRemaining(site.getSecondsRemaining() - 30 * 60);
    } else {
      removeSite = site.getFollowers().length === 0;
    }

    const score = removeSite ? site.getDeployment().getDespawnPenalty() : site.getDeployment().getPoints();
    const region = save.locateRegion(site.getLongitude(), site.getLatitude());
    if (region) {
      region.addActivityAlien(score);
    }
    for (const country of save.getCountries()) {
      if (country.getRules().insideCountry(site.getLongitude(), site.getLatitude())) {
        country.addActivityAlien(score);
        break;
      }
    }
    return removeSite;
  }

  time1Hour(): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      return;
    }

    for (const base of save.getBases()) {
      for (const craft of base.getCrafts()) {
        if (craft.getStatus() === "STR_REPAIRS") {
          craft.repair();
        } else if (craft.getStatus() === "STR_REARMING") {
          const missing = craft.rearm(mod);
          if (missing.length > 0) {
            const msg = String(this.tr("STR_NOT_ENOUGH_ITEM_TO_REARM_CRAFT_AT_BASE")
              .arg(this.tr(missing))
              .arg(craft.getName(this.game().getLanguage()))
              .arg(base.getName()));
            this.popup(new CraftErrorState(this, msg));
          }
        }
      }
    }

    let window = false;
    for (const base of save.getBases()) {
      for (const transfer of base.getTransfers()) {
        transfer.advance(base);
        if (!window && transfer.getHours() <= 0) {
          window = true;
        }
      }
    }
    if (window) {
      this.popup(new ItemsArrivingState(this));
    }

    for (const base of save.getBases()) {
      const toRemove = new Map<Production, productionProgress_e>();
      for (const production of [...base.getProductions()] as Production[]) {
        toRemove.set(production, production.step(base, save, mod));
      }
      for (const [production, progress] of toRemove) {
        if (progress > productionProgress_e.PROGRESS_NOT_COMPLETE) {
          this.popup(new ProductionCompleteState(base, String(this.tr(production.getRules().getName())), this, progress));
          base.removeProduction(production);
        }
      }

      if (Options.storageLimitsEnforced && base.storesOverfull()) {
        const geoscape = mod.getInterface("geoscape");
        this.popup(new ErrorMessageState(
          String(this.tr("STR_STORAGE_EXCEEDED").arg(base.getName())),
          this._palette,
          geoscape?.getElement("errorMessage")?.color || 1,
          "BACK13.SCR",
          geoscape?.getElement("errorPalette")?.color ?? -1
        ));
        this.popup(new SellState(base));
      }
    }

    for (const site of save.getMissionSites()) {
      if (!site.getDetected()) {
        site.setDetected(true);
        this.popup(new MissionDetectedState(site, this));
        break;
      }
    }
  }

  time1Day(): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      return;
    }
    for (const base of save.getBases()) {
      for (const facility of base.getFacilities()) {
        if (facility.getBuildTime() > 0) {
          facility.build();
          if (facility.getBuildTime() === 0) {
            this.popup(new ProductionCompleteState(base, String(this.tr(facility.getRules().getType())), this, productionProgress_e.PROGRESS_CONSTRUCTION));
          }
        }
      }

      const finished: ResearchProject[] = [];
      for (const project of [...base.getResearch()] as ResearchProject[]) {
        if (project.step()) {
          finished.push(project);
        }
      }
      const before = finished.length > 0 ? save.getAvailableResearchProjects(mod, base) : [];
      for (const project of finished) {
        let bonus: RuleResearch | null = null;
        const research = project.getRules();

        base.removeResearch(project);

        if (Options.retainCorpses && research.destroyItem() && mod.getUnit(research.getName())) {
          const unit = mod.getUnit(research.getName());
          const corpse = unit ? mod.getArmor(unit.getArmor())?.getCorpseGeoscape() || "" : "";
          if (corpse.length > 0) {
            base.getStorageItems().addItem(corpse);
          }
        }

        if (research.getGetOneFree().length > 0) {
          const possibilities = research.getGetOneFree().filter(topic => !save.isResearched(topic, false));
          if (possibilities.length > 0) {
            const selected = possibilities[RNG.generate(0, possibilities.length - 1)];
            bonus = mod.getResearch(selected, true);
            if (bonus) {
              save.addFinishedResearch(bonus, mod, base);
              if (bonus.getLookup().length > 0) {
                const lookup = mod.getResearch(bonus.getLookup(), true);
                if (lookup) {
                  save.addFinishedResearch(lookup, mod, base);
                }
              }
            }
          }
        }

        let newResearch: RuleResearch | null = research;
        const name = research.getLookup().length === 0 ? research.getName() : research.getLookup();
        if (save.isResearched(name, false)) {
          newResearch = null;
        }

        save.addFinishedResearch(research, mod, base);
        if (research.getLookup().length > 0) {
          const lookup = mod.getResearch(research.getLookup(), true);
          if (lookup) {
            save.addFinishedResearch(lookup, mod, base);
          }
        }

        if (research.getCutscene().length > 0) {
          this.popup(new CutsceneState(research.getCutscene()));
        }
        if (bonus && bonus.getCutscene().length > 0) {
          this.popup(new CutsceneState(bonus.getCutscene()));
        }
        this.popup(new ResearchCompleteState(newResearch, bonus, research));
        this.timerReset();

        if (newResearch) {
          const item = mod.getItem(newResearch.getName());
          if (item && item.getBattleType() === BattleType.BT_FIREARM && item.getCompatibleAmmo().length > 0) {
            const manufacture = mod.getManufacture(item.getType());
            if (manufacture && manufacture.getRequirements().length > 0) {
              const requirements = manufacture.getRequirements();
              const ammo = mod.getItem(item.getCompatibleAmmo()[0]);
              if (ammo && requirements.includes(ammo.getType()) && !save.isResearched(requirements, true)) {
                this.popup(new ResearchRequiredState(item));
              }
            }
          }
        }

        const after = save.getAvailableResearchProjects(mod, base);
        const newPossibleResearch = save.getNewlyAvailableResearchProjects(before, after);
        this.popup(new NewPossibleResearchState(base, newPossibleResearch));

        const newPossibleManufacture = save.getDependableManufacture(research, mod, base);
        if (newPossibleManufacture.length > 0) {
          this.popup(new NewPossibleManufactureState(base, newPossibleManufacture));
        }

        for (const otherBase of save.getBases()) {
          for (const otherProject of [...otherBase.getResearch()] as ResearchProject[]) {
            if (research.getName() === otherProject.getRules().getName()) {
              if (!save.isResearched(research.getGetOneFree(), false)) {
                // This research topic can still yield undiscovered getOneFree topics.
              } else if (save.hasUndiscoveredProtectedUnlock(research, mod)) {
                // This research topic can still yield protected zero-cost unlocks.
              } else {
                otherBase.removeResearch(otherProject);
                break;
              }
            }
          }
        }
      }

      for (const soldier of base.getSoldiers()) {
        if (soldier.getWoundRecovery() > 0) {
          soldier.heal();
        }
      }
      if (base.getAvailablePsiLabs() > 0 && Options.anytimePsiTraining) {
        for (const soldier of base.getSoldiers()) {
          soldier.trainPsi1Day();
          soldier.calcStatString(mod.getStatStrings(), Options.psiStrengthEval && save.isResearched(mod.getPsiRequirements()));
        }
      }
    }

    for (const alienBase of save.getAlienBases()) {
      const region = save.locateRegion(alienBase.getLongitude(), alienBase.getLatitude());
      if (region) {
        region.addActivityAlien(alienBase.getDeployment().getPoints());
      }
      for (const country of save.getCountries()) {
        if (country.getRules().insideCountry(alienBase.getLongitude(), alienBase.getLatitude())) {
          country.addActivityAlien(alienBase.getDeployment().getPoints());
          break;
        }
      }
    }

    for (const alienBase of save.getAlienBases()) {
      this.generateSupplyMission(alienBase, save, mod);
    }
  }

  private generateSupplyMission(alienBase: AlienBase, save: SavedGame, mod: Mod): void {
    const deployment = alienBase.getDeployment();
    const missionName = deployment.chooseGenMissionType();
    const missionRule = mod.getAlienMission(missionName);
    if (missionRule) {
      if (RNG.percent(deployment.getGenMissionFrequency())) {
        const mission = new AlienMission(missionRule);
        const region = save.locateRegion(alienBase.getLongitude(), alienBase.getLatitude());
        if (!region) {
          return;
        }
        mission.setRegion(region.getRules().getType(), mod);
        mission.setId(save.getId("ALIEN_MISSIONS"));
        mission.setRace(alienBase.getAlienRace());
        mission.setAlienBase(alienBase);
        mission.start();
        save.getAlienMissions().push(mission);
      }
    } else if (missionName.length > 0) {
      throw new Error(`Alien Base tried to generate undefined mission: ${missionName}`);
    }
  }

  time1Month(): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      return;
    }
    save.addMonth();

    this.determineAlienMissions(save, mod);

    let psi = false;
    if (!Options.anytimePsiTraining) {
      for (const base of save.getBases()) {
        if (base.getAvailablePsiLabs() > 0) {
          psi = true;
          for (const soldier of base.getSoldiers()) {
            if (soldier.isInPsiTraining()) {
              soldier.trainPsi();
              soldier.calcStatString(mod.getStatStrings(), Options.psiStrengthEval && save.isResearched(mod.getPsiRequirements()));
            }
          }
        }
      }
    }

    this.timerReset();
    save.monthlyFunding();
    this.popup(new MonthlyReportState(psi, this._globe));

    if (save.getAlienBases().length > 0 && RNG.percent(20)) {
      for (const base of save.getAlienBases()) {
        if (!base.isDiscovered()) {
          base.setDiscovered(true);
          this.popup(new AlienBaseState(base, this));
          break;
        }
      }
    }
  }

  private determineAlienMissions(save: SavedGame, mod: Mod): void {
    const strategy = save.getAlienStrategy();
    const month = save.getMonthsPassed();
    const availableMissions: RuleMissionScript[] = [];
    const conditions = new Map<number, boolean>();

    for (const name of mod.getMissionScriptList()) {
      const command = mod.getMissionScript(name);
      if (!command) {
        continue;
      }
      if (
        command.getFirstMonth() <= month &&
        (command.getLastMonth() >= month || command.getLastMonth() === -1) &&
        (command.getMaxRuns() === -1 || command.getMaxRuns() > strategy.getMissionsRun(command.getVarName())) &&
        command.getMinDifficulty() <= save.getDifficulty()
      ) {
        let triggerHappy = true;
        for (const [research, required] of command.getResearchTriggers()) {
          triggerHappy = save.isResearched(research) === required;
          if (!triggerHappy) {
            break;
          }
        }
        if (triggerHappy) {
          availableMissions.push(command);
        }
      }
    }

    for (const command of availableMissions) {
      let process = true;
      let success = false;
      for (const conditional of command.getConditionals()) {
        if (!process) {
          break;
        }
        const found = conditions.get(Math.abs(conditional));
        process = found == null || (found === true && conditional > 0) || (found === false && conditional < 0);
      }
      if (command.getLabel() > 0 && conditions.has(command.getLabel())) {
        const shared = availableMissions
          .filter(other => other !== command && other.getLabel() === command.getLabel())
          .map(other => other.getType())
          .join(", ");
        throw new Error(`Mission generator encountered an error: multiple commands: ${command.getType()} and ${shared}, are sharing the same label: ${command.getLabel()}`);
      }
      if (process && RNG.percent(command.getExecutionOdds())) {
        success = this.processCommand(command, save, mod);
      }
      if (command.getLabel() > 0) {
        if (conditions.has(command.getLabel())) {
          throw new Error(`Error in mission scripts: ${command.getType()}. Two or more commands sharing the same label. That's bad, Mmmkay?`);
        }
        conditions.set(command.getLabel(), success);
      }
    }
  }

  private processCommand(command: RuleMissionScript, save: SavedGame, mod: Mod): boolean {
    const strategy = save.getAlienStrategy();
    const month = save.getMonthsPassed();
    let targetRegion = "";
    let missionRules: RuleAlienMission | null = null;
    let missionType = "";
    let missionRace = "";
    let targetZone = -1;

    if (command.getSiteType()) {
      missionType = command.generate(month, GenerationType.GEN_MISSION);
      const missions = command.getMissionTypes(month);
      const maxMissions = missions.length;
      const targetBase = RNG.percent(command.getTargetBaseOdds());
      let currPos = 0;
      for (; currPos !== maxMissions; ++currPos) {
        if (missions[currPos] === missionType) {
          break;
        }
      }

      const validAreas: Array<[string, number]> = [];
      for (let h = 0; h !== maxMissions; ++h) {
        let regions = command.hasRegionWeights() ? command.getRegions(month) : [...mod.getRegionsList()];
        missionRules = mod.getAlienMission(missionType, true);
        if (!missionRules) {
          return false;
        }
        targetZone = missionRules.getSpawnZone();

        if (targetBase) {
          const regionsToKeep: string[] = [];
          for (const base of save.getBases()) {
            const located = save.locateRegion(base.getLongitude(), base.getLatitude());
            if (located) {
              regionsToKeep.push(located.getRules().getType());
            }
          }
          regions = regions.filter(region => regionsToKeep.includes(region));
        }

        for (const regionName of regions) {
          let processThisRegion = true;
          for (const mission of save.getAlienMissions()) {
            if (mission.getRules().getType() === missionRules.getType() && mission.getRegion() === regionName) {
              processThisRegion = false;
              break;
            }
          }
          if (!processThisRegion) {
            continue;
          }
          const region = mod.getRegion(regionName);
          if (!region) {
            throw new Error(`Error proccessing mission script named: ${command.getType()}, region named: ${regionName} is not defined`);
          }
          if (region.getMissionZones().length > targetZone) {
            const areas = region.getMissionZones()[targetZone].areas;
            let counter = 0;
            for (const area of areas) {
              if (this.missionAreaIsPoint(area) && strategy.validMissionLocation(command.getVarName(), region.getType(), counter)) {
                validAreas.push([region.getType(), counter]);
              }
              ++counter;
            }
          }
        }

        if (validAreas.length === 0) {
          if (maxMissions > 1 && ++currPos === maxMissions) {
            currPos = 0;
          }
          missionType = missions[currPos] || "";
        } else {
          break;
        }
      }

      if (validAreas.length === 0) {
        return false;
      }

      targetZone = -1;
      while (targetZone === -1) {
        if (command.hasRegionWeights()) {
          targetRegion = command.generate(month, GenerationType.GEN_REGION);
        } else {
          const regions = mod.getRegionsList();
          targetRegion = regions[RNG.generate(0, regions.length - 1)] || "";
        }

        let min = -1;
        let max = -1;
        let curr = 0;
        for (const [region, zone] of validAreas) {
          if (region === targetRegion) {
            if (min === -1) {
              min = curr;
            }
            max = curr;
          } else if (min > -1) {
            break;
          }
          ++curr;
        }
        if (min !== -1) {
          targetZone = validAreas[RNG.generate(min, max)][1];
        }
      }
      strategy.addMissionLocation(command.getVarName(), targetRegion, targetZone, command.getRepeatAvoidance());
    } else if (RNG.percent(command.getTargetBaseOdds())) {
      const types = command.getMissionTypes(month);
      const regionsMaster: string[] = [];
      for (const base of save.getBases()) {
        const located = save.locateRegion(base.getLongitude(), base.getLatitude());
        if (located) {
          regionsMaster.push(located.getRules().getType());
        }
      }
      if (types.length === 0) {
        for (let i = 0; i < regionsMaster.length;) {
          if (!strategy.validMissionRegion(regionsMaster[i])) {
            regionsMaster.splice(i, 1);
          } else {
            ++i;
          }
        }
        if (regionsMaster.length === 0) {
          return false;
        }
        targetRegion = regionsMaster[RNG.generate(0, regionsMaster.length - 1)] || "";
      } else {
        const max = types.length;
        let entry = RNG.generate(0, max - 1);
        let regions: string[] = [];
        for (let i = 0; i !== max; ++i) {
          regions = [...regionsMaster];
          for (const mission of save.getAlienMissions()) {
            if (types[entry] === mission.getRules().getType()) {
              for (let k = 0; k < regions.length;) {
                if (regions[k] === mission.getRegion()) {
                  regions.splice(k, 1);
                } else {
                  ++k;
                }
              }
            }
          }
          if (regions.length > 0) {
            missionType = types[entry];
            targetRegion = regions[RNG.generate(0, regions.length - 1)] || "";
            break;
          }
          if (max > 1 && ++entry === max) {
            entry = 0;
          }
        }
      }
    } else if (!command.hasRegionWeights()) {
      targetRegion = strategy.chooseRandomRegion(mod);
    } else {
      targetRegion = command.generate(month, GenerationType.GEN_REGION);
    }

    if (targetRegion.length === 0) {
      return false;
    }

    if (!mod.getRegion(targetRegion)) {
      throw new Error(`Error proccessing mission script named: ${command.getType()}, region named: ${targetRegion} is not defined`);
    }

    if (missionType.length === 0) {
      if (!command.hasMissionWeights()) {
        missionType = strategy.chooseRandomMission(targetRegion);
      } else {
        missionType = command.generate(month, GenerationType.GEN_MISSION);
      }
    }

    if (missionType.length === 0) {
      return false;
    }

    missionRules = mod.getAlienMission(missionType);
    if (!missionRules) {
      throw new Error(`Error proccessing mission script named: ${command.getType()}, mission type: ${missionType} is not defined`);
    }

    if (!command.hasRaceWeights()) {
      missionRace = missionRules.generateRace(month);
    } else {
      missionRace = command.generate(month, GenerationType.GEN_RACE);
    }

    if (missionRace.length === 0) {
      throw new Error(`Error proccessing mission script named: ${command.getType()}, mission type: ${missionType} has no available races`);
    }

    if (!mod.getAlienRace(missionRace)) {
      throw new Error(`Error proccessing mission script named: ${command.getType()}, race: ${missionRace} is not defined`);
    }

    const mission = new AlienMission(missionRules);
    mission.setRace(missionRace);
    mission.setId(save.getId("ALIEN_MISSIONS"));
    mission.setRegion(targetRegion, mod);
    mission.setMissionSiteZone(targetZone);
    strategy.addMissionRun(command.getVarName());
    mission.start(command.getDelay());
    save.getAlienMissions().push(mission);
    if (command.getUseTable()) {
      strategy.removeMission(targetRegion, missionType);
    }
    return true;
  }

  private missionAreaIsPoint(area: { lonMin: number; lonMax: number; latMin: number; latMax: number }): boolean {
    return Math.abs(area.lonMin - area.lonMax) <= Number.EPSILON &&
      Math.abs(area.latMin - area.latMax) <= Number.EPSILON;
  }

  timerReset(): void {
    this._timeSpeed.value = this._btn5Secs;
  }

  popup(state: State): void {
    this._pause = true;
    this._popups.push(state);
  }

  startDogfight(): void {
    if (this._globe.getZoom() < 3) {
      this._globe.saveZoomDogfight();
      this._globe.rotateStop();
      while (!this._globe.zoomDogfightIn()) {
        // Browser port performs the original timer-driven zoom-in synchronously.
      }
    }
    this.timerReset();
    while (this._dogfightsToBeStarted.length > 0) {
      const dogfight = this._dogfightsToBeStarted.pop();
      if (!dogfight) {
        continue;
      }
      this._dogfights.push(dogfight);
      dogfight.setInterceptionNumber(this.getFirstFreeDogfightSlot());
      dogfight.setInterceptionsCount(this._dogfights.length + this._dogfightsToBeStarted.length);
    }
    for (const dogfight of this._dogfights) {
      dogfight.setInterceptionsCount(this._dogfights.length);
    }
  }

  handleDogfights(): void {
    this._minimizedDogfights = 0;
    for (const dogfight of this._dogfights) {
      dogfight.getUfo().setInterceptionProcessed(false);
    }
    for (let i = 0; i < this._dogfights.length;) {
      const dogfight = this._dogfights[i];
      if (dogfight.isMinimized()) {
        if (dogfight.getWaitForPoly() && this._globe.insideLand(dogfight.getUfo().getLongitude(), dogfight.getUfo().getLatitude())) {
          dogfight.setMinimized(false);
          dogfight.setWaitForPoly(false);
        } else if (dogfight.getWaitForAltitude() && dogfight.getUfo().getAltitudeInt() <= dogfight.getCraft().getRules().getMaxAltitude()) {
          dogfight.setMinimized(false);
          dogfight.setWaitForAltitude(false);
        } else {
          ++this._minimizedDogfights;
        }
      } else {
        this._globe.rotateStop();
      }
      dogfight.think();
      if (dogfight.dogfightEnded()) {
        if (dogfight.isMinimized()) {
          --this._minimizedDogfights;
        }
        this._dogfights.splice(i, 1);
      } else {
        ++i;
      }
    }
    if (this._dogfights.length === 0) {
      while (!this._globe.zoomDogfightOut()) {
        // Browser port performs the original timer-driven zoom-out synchronously.
      }
      this._pause = false;
    }
  }

  getFirstFreeDogfightSlot(): number {
    let slotNo = 1;
    while (this._dogfights.some(dogfight => dogfight.getInterceptionNumber() === slotNo)) {
      ++slotNo;
    }
    return slotNo;
  }

  async handleBaseDefense(base: Base, ufo: Ufo): Promise<void> {
    ufo.setStatus(UfoStatus.DESTROYED);

    if (base.getAvailableSoldiers(true) > 0 || base.getVehicles().length > 0) {
      const bgame = new SavedBattleGame();
      const save = this.game().getSavedGame();
      save?.setSavedBattle(bgame);
      bgame.setMissionType("STR_BASE_DEFENSE");
      const bgen = new BattlescapeGenerator(bgame, this.game().getMod());
      bgen.setBase(base);
      bgen.setAlienRace(ufo.getAlienRace());
      if (save) {
        bgen.setDifficulty(save.getDifficulty());
      }
      this._pause = true;
      await bgen.run();
      this.game().pushState(new BriefingState(null, base));
    } else {
      this.popup(new BaseDestroyedState(base));
    }
  }

  private startFlyingUfoDogfight(craft: Craft, ufo: Ufo): void {
    if (this._dogfights.length + this._dogfightsToBeStarted.length >= 4) {
      return;
    }
    if (craft.isInDogfight() || ufo.getSpeed() > craft.getRules().getMaxSpeed()) {
      return;
    }
    const dogfight = new DogfightState(this, craft, ufo);
    this._dogfightsToBeStarted.push(dogfight);
    if (craft.getRules().isWaterOnly() && ufo.getAltitudeInt() > craft.getRules().getMaxAltitude()) {
      this.popup(new DogfightErrorState(craft, String(this.tr("STR_UNABLE_TO_ENGAGE_DEPTH"))));
      dogfight.setMinimized(true);
      dogfight.setWaitForAltitude(true);
    } else if (craft.getRules().isWaterOnly() && !this._globe.insideLand(craft.getLongitude(), craft.getLatitude())) {
      this.popup(new DogfightErrorState(craft, String(this.tr("STR_UNABLE_TO_ENGAGE_AIRBORNE"))));
      dogfight.setMinimized(true);
      dogfight.setWaitForPoly(true);
    }
    this._pause = true;
    this.timerReset();
    this._globe.center(craft.getLongitude(), craft.getLatitude());
    this.startDogfight();
    this.game().getMod()?.playMusic("GMINTER");
  }

  globeClick(action: Action): void {
    const mouseX = Math.floor(action.getAbsoluteXMouse());
    const mouseY = Math.floor(action.getAbsoluteYMouse());
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      const targets = this._globe.getTargets(mouseX, mouseY, false);
      if (targets.length > 0) {
        this.game().pushState(new MultipleTargetsState(targets, null, this));
      }
    }
  }

  private buttonsDisabled(): boolean {
    return false;
  }
}
