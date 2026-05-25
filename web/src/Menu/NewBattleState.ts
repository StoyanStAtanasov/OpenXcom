import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { BriefingState } from "../Battlescape/BriefingState.ts";
import { CraftInfoState } from "../Basescape/CraftInfoState.ts";
import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Frame } from "../Interface/Frame.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import { AlienBase } from "../Savegame/AlienBase.ts";
import { Base } from "../Savegame/Base.ts";
import { Craft } from "../Savegame/Craft.ts";
import { MissionSite } from "../Savegame/MissionSite.ts";
import { GameDifficulty, SavedGame, type SavedGameBaseNode } from "../Savegame/SavedGame.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";

type NewBattleSettings = {
  mission?: number;
  craft?: number;
  darkness?: number;
  terrain?: number;
  alienRace?: number;
  difficulty?: number;
  alienTech?: number;
  depth?: number;
  base?: SavedGameBaseNode;
};

/**
 * New Battle that displays a list of options to configure a standalone mission.
 */
export class NewBattleState extends State {
  private _window: Window;
  private _frameLeft: Frame;
  private _frameRight: Frame;
  private _txtTitle: Text;
  private _txtMapOptions: Text;
  private _txtAlienOptions: Text;
  private _txtMission: Text;
  private _txtCraft: Text;
  private _txtDarkness: Text;
  private _txtTerrain: Text;
  private _txtDifficulty: Text;
  private _txtAlienRace: Text;
  private _txtAlienTech: Text;
  private _txtDepth: Text;
  private _cbxMission: ComboBox;
  private _cbxCraft: ComboBox;
  private _cbxTerrain: ComboBox;
  private _cbxDifficulty: ComboBox;
  private _cbxAlienRace: ComboBox;
  private _slrDarkness: Slider;
  private _slrAlienTech: Slider;
  private _slrDepth: Slider;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _btnEquip: TextButton;
  private _btnRandom: TextButton;
  private _missionTypes: string[] = [];
  private _terrainTypes: string[] = [];
  private _alienRaces: string[] = [];
  private _crafts: string[] = [];
  private _craft: Craft | null = null;

  constructor() {
    super();
    this._window = new Window(this, 320, 200, 0, 0, POPUP_BOTH);
    this._txtTitle = new Text(320, 17, 0, 9);

    this._txtMapOptions = new Text(148, 9, 8, 68);
    this._frameLeft = new Frame(148, 96, 8, 78);
    this._txtAlienOptions = new Text(148, 9, 164, 68);
    this._frameRight = new Frame(148, 96, 164, 78);

    this._txtMission = new Text(100, 9, 8, 30);
    this._cbxMission = new ComboBox(this, 214, 16, 98, 26);

    this._txtCraft = new Text(100, 9, 8, 50);
    this._cbxCraft = new ComboBox(this, 106, 16, 98, 46);
    this._btnEquip = new TextButton(106, 16, 206, 46);

    this._txtDarkness = new Text(120, 9, 22, 83);
    this._slrDarkness = new Slider(120, 16, 22, 93);

    this._txtTerrain = new Text(120, 9, 22, 113);
    this._cbxTerrain = new ComboBox(this, 120, 16, 22, 123);

    this._txtDepth = new Text(120, 9, 22, 143);
    this._slrDepth = new Slider(120, 16, 22, 153);

    this._txtDifficulty = new Text(120, 9, 178, 83);
    this._cbxDifficulty = new ComboBox(this, 120, 16, 178, 93);

    this._txtAlienRace = new Text(120, 9, 178, 113);
    this._cbxAlienRace = new ComboBox(this, 120, 16, 178, 123);

    this._txtAlienTech = new Text(120, 9, 178, 143);
    this._slrAlienTech = new Slider(120, 16, 178, 153);

    this._btnOk = new TextButton(100, 16, 8, 176);
    this._btnCancel = new TextButton(100, 16, 110, 176);
    this._btnRandom = new TextButton(100, 16, 212, 176);

    this.setInterface("newBattleMenu");

    this.add(this._window, "window", "newBattleMenu");
    this.add(this._txtTitle, "heading", "newBattleMenu");
    this.add(this._txtMapOptions, "heading", "newBattleMenu");
    this.add(this._frameLeft, "frames", "newBattleMenu");
    this.add(this._txtAlienOptions, "heading", "newBattleMenu");
    this.add(this._frameRight, "frames", "newBattleMenu");

    this.add(this._txtMission, "text", "newBattleMenu");
    this.add(this._txtCraft, "text", "newBattleMenu");
    this.add(this._btnEquip, "button1", "newBattleMenu");

    this.add(this._txtDarkness, "text", "newBattleMenu");
    this.add(this._slrDarkness, "button1", "newBattleMenu");
    this.add(this._txtDepth, "text", "newBattleMenu");
    this.add(this._slrDepth, "button1", "newBattleMenu");
    this.add(this._txtTerrain, "text", "newBattleMenu");
    this.add(this._txtDifficulty, "text", "newBattleMenu");
    this.add(this._txtAlienRace, "text", "newBattleMenu");
    this.add(this._txtAlienTech, "text", "newBattleMenu");
    this.add(this._slrAlienTech, "button1", "newBattleMenu");

    this.add(this._btnOk, "button2", "newBattleMenu");
    this.add(this._btnCancel, "button2", "newBattleMenu");
    this.add(this._btnRandom, "button2", "newBattleMenu");

    this.add(this._cbxTerrain, "button1", "newBattleMenu");
    this.add(this._cbxAlienRace, "button1", "newBattleMenu");
    this.add(this._cbxDifficulty, "button1", "newBattleMenu");
    this.add(this._cbxCraft, "button1", "newBattleMenu");
    this.add(this._cbxMission, "button1", "newBattleMenu");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_MISSION_GENERATOR")));
    this._txtMapOptions.setText(String(this.tr("STR_MAP_OPTIONS")));
    this._frameLeft.setThickness(3);
    this._txtAlienOptions.setText(String(this.tr("STR_ALIEN_OPTIONS")));
    this._frameRight.setThickness(3);

    this._txtMission.setText(String(this.tr("STR_MISSION")));
    this._txtCraft.setText(String(this.tr("STR_CRAFT")));
    this._txtDarkness.setText(String(this.tr("STR_MAP_DARKNESS")));
    this._txtDepth.setText(String(this.tr("STR_MAP_DEPTH")));
    this._txtTerrain.setText(String(this.tr("STR_MAP_TERRAIN")));
    this._txtDifficulty.setText(String(this.tr("STR_DIFFICULTY")));
    this._txtAlienRace.setText(String(this.tr("STR_ALIEN_RACE")));
    this._txtAlienTech.setText(String(this.tr("STR_ALIEN_TECH_LEVEL")));

    this.loadOptionsFromRules();

    this._slrDarkness.setRange(0, 15);
    this._slrDepth.setRange(1, 3);
    this._slrAlienTech.setRange(0, Math.max(0, (this.game().getMod()?.getAlienItemLevels().length || 1) - 1));

    this._cbxMission.onChange(this.cbxMissionChange.bind(this));
    this._cbxCraft.onChange(this.cbxCraftChange.bind(this));
    this._cbxTerrain.onChange(this.cbxTerrainChange.bind(this));

    this._btnEquip.setText(String(this.tr("STR_EQUIP_CRAFT")));
    this._btnEquip.onMouseClick(this.btnEquipClick.bind(this));
    this._btnRandom.setText(String(this.tr("STR_RANDOMIZE")));
    this._btnRandom.onMouseClick(this.btnRandomClick.bind(this));
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this.load();
  }

  override init(): void {
    super.init();
    if (!this.game().getSavedGame()) {
      this.initSave();
    }
  }

  load(filename = "battle"): void {
    const settings = this.loadSettings(filename);
    if (!settings) {
      this.cbxMissionChange(null);
      this.initSave();
      return;
    }
    this._cbxMission.setSelected(Math.min(settings.mission ?? 0, Math.max(0, this._missionTypes.length - 1)));
    this.cbxMissionChange(null);
    this._cbxCraft.setSelected(Math.min(settings.craft ?? 0, Math.max(0, this._crafts.length - 1)));
    this._slrDarkness.setValue(settings.darkness ?? 0);
    this._cbxTerrain.setSelected(Math.min(settings.terrain ?? 0, Math.max(0, this._terrainTypes.length - 1)));
    this.cbxTerrainChange(null);
    this._cbxAlienRace.setSelected(Math.min(settings.alienRace ?? 0, Math.max(0, this._alienRaces.length - 1)));
    this._cbxDifficulty.setSelected(Math.min(settings.difficulty ?? 0, 4));
    this._slrAlienTech.setValue(settings.alienTech ?? 0);
    const mod = this.game().getMod();
    if (!settings.base || !mod) {
      this.initSave();
      return;
    }

    const save = new SavedGame();
    save.getBases().length = 0;
    const base = save.loadBase(settings.base, mod);
    save.getBases().push(base);
    this.addAllResearch(save);
    this.seedRecoverableItems(save, base, false);
    if (base.getCrafts().length === 0) {
      this._craft = this.createSelectedCraft(save, base, save.getId(this.getSelectedCraftType()));
    } else {
      this._craft = base.getCrafts()[0] || null;
      this.pruneInvalidCraftItems(this._craft);
    }
    this.game().setSavedGame(save);
  }

  save(filename = "battle"): void {
    const settings: NewBattleSettings = {
      mission: this._cbxMission.getSelected(),
      craft: this._cbxCraft.getSelected(),
      darkness: this._slrDarkness.getValue(),
      terrain: this._cbxTerrain.getSelected(),
      alienRace: this._cbxAlienRace.getSelected(),
      difficulty: this._cbxDifficulty.getSelected(),
      alienTech: this._slrAlienTech.getValue(),
      base: this.game().getSavedGame()?.getBases()[0]
        ? this.game().getSavedGame()!.saveBase(this.game().getSavedGame()!.getBases()[0])
        : undefined
    };
    try {
      window.localStorage?.setItem(`openxcom.${filename}.cfg`, JSON.stringify(settings));
    } catch {
      // localStorage can be disabled; the original failure only logs a warning.
    }
  }

  initSave(): void {
    const mod = this.game().getMod();
    const save = new SavedGame();
    save.getBases().length = 0;
    const starter = mod?.newSave?.();
    const base = starter?.getBases()[0] || new Base(mod || null);
    base.setMod(mod || null);
    base.getSoldiers().length = 0;
    base.getCrafts().length = 0;
    base.getStorageItems().getContents().clear();
    save.getBases().push(base);

    this._craft = this.createSelectedCraft(save, base, 1);
    this.generateSandboxSoldiers(save, base);
    this.seedRecoverableItems(save, base, true);
    this.addAllResearch(save);
    this.game().setSavedGame(save);
    this.cbxMissionChange(null);
  }

  async btnOkClick(_action: Action | null): Promise<void> {
    this.save();
    const save = this.game().getSavedGame() || new SavedGame();
    this.game().setSavedGame(save);
    const mission = this._missionTypes[this._cbxMission.getSelected()] || "";
    if (mission !== "STR_BASE_DEFENSE" && (!this._craft || (this._craft.getNumSoldiers() === 0 && this._craft.getNumVehicles() === 0))) {
      return;
    }

    const battle = new SavedBattleGame();
    save.setSavedBattle(battle);
    battle.setMissionType(mission);
    const mod = this.game().getMod();
    const generator = new BattlescapeGenerator(battle, mod);
    let base: Base | null = null;

    generator.setTerrain(mod?.getTerrain(this._terrainTypes[this._cbxTerrain.getSelected()] || "") || null);
    if (mission === "STR_BASE_DEFENSE") {
      base = this._craft?.getBase() || save.getBases()[0] || null;
      generator.setBase(base);
      this._craft = null;
    } else if (mod?.getDeployment(mission)?.isAlienBase()) {
      const deployment = mod.getDeployment(mission);
      if (!deployment || !this._craft) {
        throw new Error(`Cannot start alien base mission ${mission}`);
      }
      const alienBase = new AlienBase(deployment);
      alienBase.setId(1);
      alienBase.setAlienRace(this._alienRaces[this._cbxAlienRace.getSelected()] || "");
      this._craft.setDestination(alienBase);
      generator.setAlienBase(alienBase);
      save.getAlienBases().push(alienBase);
    } else {
      const ufoRule = mod?.getUfo(mission) || null;
      if (this._craft && ufoRule) {
        const ufo = new Ufo(ufoRule);
        ufo.setId(1);
        this._craft.setDestination(ufo);
        generator.setUfo(ufo);
        if (RNG.generate(0, 1) === 1) {
          ufo.setStatus(UfoStatus.LANDED);
          battle.setMissionType("STR_UFO_GROUND_ASSAULT");
        } else {
          ufo.setStatus(UfoStatus.CRASHED);
          battle.setMissionType("STR_UFO_CRASH_RECOVERY");
        }
        save.getUfos().push(ufo);
      } else {
        const deployment = mod?.getDeployment(battle.getMissionType()) || null;
        const alienMissionType = mod?.getAlienMissionList()[0] || "";
        const alienMission = mod?.getAlienMission(alienMissionType) || null;
        if (!deployment || !alienMission || !this._craft) {
          throw new Error(`Cannot start mission site ${battle.getMissionType()}`);
        }
        const missionSite = new MissionSite(alienMission, deployment);
        missionSite.setId(1);
        missionSite.setAlienRace(this._alienRaces[this._cbxAlienRace.getSelected()] || "");
        this._craft.setDestination(missionSite);
        generator.setMissionSite(missionSite);
        save.getMissionSites().push(missionSite);
      }
    }

    if (this._craft) {
      this._craft.setSpeed(0);
      generator.setCraft(this._craft);
    }
    save.setDifficulty(this._cbxDifficulty.getSelected() as GameDifficulty);
    generator.setDifficulty(save.getDifficulty());
    generator.setWorldShade(this._slrDarkness.getValue());
    generator.setAlienRace(this._alienRaces[this._cbxAlienRace.getSelected()] || "");
    generator.setAlienItemlevel(this._slrAlienTech.getValue());
    battle.setDepth(this._slrDepth.getValue());

    await generator.run();

    const craft = this._craft;
    this.game().popState();
    this.game().popState();
    this.game().pushState(new BriefingState(craft, base));
    this._craft = null;
  }

  btnCancelClick(_action: Action | null): void {
    this.save();
    this.game().setSavedGame(null);
    if (this.game().isState(this)) {
      this.game().popState();
    }
  }

  btnRandomClick(_action: Action | null): void {
    this.initSave();
    this._cbxMission.setSelected(this.randomIndex(this._missionTypes));
    this.cbxMissionChange(null);
    this._cbxCraft.setSelected(this.randomIndex(this._crafts));
    this.cbxCraftChange(null);
    this._slrDarkness.setValue(Math.trunc(Math.random() * 16));
    this._cbxTerrain.setSelected(this.randomIndex(this._terrainTypes));
    this.cbxTerrainChange(null);
    this._cbxAlienRace.setSelected(this.randomIndex(this._alienRaces));
    this._cbxDifficulty.setSelected(Math.trunc(Math.random() * 5));
    this._slrAlienTech.setValue(this.randomIndex(this.game().getMod()?.getAlienItemLevels() || [0]));
  }

  btnEquipClick(_action: Action | null): void {
    const base = this.game().getSavedGame()?.getBases()[0] || null;
    if (base) {
      this.game().pushState(new CraftInfoState(base, 0));
    }
  }

  cbxMissionChange(_action: Action | null): void {
    const mod = this.game().getMod();
    const mission = this._missionTypes[this._cbxMission.getSelected()] || "";
    const deployment = mod?.getDeployment(mission) || null;
    const deploymentTerrains = deployment?.getTerrains() || [];
    const globeTerrains = deploymentTerrains.length === 0
      ? (mod?.getGlobe().getTerrains("") || [])
      : (mod?.getGlobe().getTerrains(deployment?.getType() || "") || []);
    const terrains = new Set<string>();
    for (const terrain of deploymentTerrains) {
      terrains.add(terrain);
    }
    for (const terrain of globeTerrains) {
      terrains.add(terrain);
    }
    this._terrainTypes = [...terrains].sort();
    if (this._terrainTypes.length === 0) {
      this._terrainTypes = mod?.getTerrainList() || ["STR_FARM"];
    }
    this._txtDarkness.setVisible((deployment?.getShade() ?? -1) === -1);
    this._slrDarkness.setVisible((deployment?.getShade() ?? -1) === -1);
    this._txtTerrain.setVisible(this._terrainTypes.length > 1);
    this._cbxTerrain.setVisible(this._terrainTypes.length > 1);
    this._cbxTerrain.setOptions(this._terrainTypes.map(terrain => `MAP_${terrain}`), true);
    this._cbxTerrain.setSelected(0);
    this.cbxTerrainChange(null);
  }

  cbxCraftChange(_action: Action | null): void {
    const mod = this.game().getMod();
    const rule = mod?.getCraft(this.getSelectedCraftType()) || null;
    if (!this._craft || !rule) {
      return;
    }
    this._craft.changeRules(rule);
    let current = this._craft.getNumSoldiers();
    const max = this._craft.getRules().getSoldiers();
    const base = this._craft.getBase();
    if (!base || current <= max) {
      return;
    }
    for (let i = base.getSoldiers().length - 1; i >= 0 && current > max; --i) {
      const soldier = base.getSoldiers()[i];
      if (soldier.getCraft() === this._craft) {
        soldier.setCraft(null);
        current--;
      }
    }
  }

  cbxTerrainChange(_action: Action | null): void {
    const mod = this.game().getMod();
    const mission = this._missionTypes[this._cbxMission.getSelected()] || "";
    const deployment = mod?.getDeployment(mission) || null;
    const terrain = mod?.getTerrain(this._terrainTypes[this._cbxTerrain.getSelected()] || "") || null;
    const deploymentTerrain = deployment?.getTerrains()[0] ? mod?.getTerrain(deployment.getTerrains()[0]) : null;
    let minDepth = 0;
    let maxDepth = 0;
    if ((deployment?.getMaxDepth() || 0) > 0 || (terrain?.getMaxDepth() || 0) > 0 || (deploymentTerrain?.getMaxDepth() || 0) > 0) {
      minDepth = 1;
      maxDepth = 3;
    }
    this._txtDepth.setVisible(minDepth !== maxDepth);
    this._slrDepth.setVisible(minDepth !== maxDepth);
    this._slrDepth.setRange(minDepth, maxDepth);
    this._slrDepth.setValue(minDepth);
  }

  private loadOptionsFromRules(): void {
    const mod = this.game().getMod();
    this._missionTypes = mod?.getDeploymentsList() || [];
    if (this._missionTypes.length === 0) {
      this._missionTypes = ["STR_NEW_BATTLE"];
    }
    this._cbxMission.setOptions(this._missionTypes, true);

    this._crafts = (mod?.getCraftsList() || []).filter(type => (mod?.getCraft(type)?.getSoldiers() || 0) > 0);
    if (this._crafts.length === 0) {
      this._crafts = ["STR_SKYRANGER"];
    }
    this._cbxCraft.setOptions(this._crafts, true);

    this._terrainTypes = mod?.getTerrainList() || ["STR_FARM"];
    this._cbxTerrain.setOptions(this._terrainTypes, true);

    this._cbxDifficulty.setOptions([
      String(this.tr("STR_1_BEGINNER")),
      String(this.tr("STR_2_EXPERIENCED")),
      String(this.tr("STR_3_VETERAN")),
      String(this.tr("STR_4_GENIUS")),
      String(this.tr("STR_5_SUPERHUMAN"))
    ]);

    this._alienRaces = (mod?.getAlienRacesList() || []).filter(type => !type.includes("_UNDERWATER"));
    if (this._alienRaces.length === 0) {
      this._alienRaces = ["STR_SECTOID"];
    }
    this._cbxAlienRace.setOptions(this._alienRaces, true);
  }

  private getSelectedCraftType(): string {
    return this._crafts[this._cbxCraft.getSelected()] || this._crafts[0] || "STR_SKYRANGER";
  }

  private createSelectedCraft(save: SavedGame, base: Base, id: number): Craft | null {
    const rule = this.game().getMod()?.getCraft(this.getSelectedCraftType()) || null;
    if (!rule) {
      return null;
    }
    const craft = new Craft(rule, base, id);
    base.getCrafts().push(craft);
    return craft;
  }

  private generateSandboxSoldiers(save: SavedGame, base: Base): void {
    const mod = this.game().getMod();
    const soldiers = mod?.getSoldiersList() || [];
    for (let i = 0; i < 30; ++i) {
      const soldierType = soldiers.length > 0 ? soldiers[RNG.generate(0, soldiers.length - 1)] : "";
      const soldier = mod?.genSoldier(save, soldierType) || null;
      if (!soldier) {
        continue;
      }
      for (let n = 0; n < 5; ++n) {
        if (RNG.percent(70)) {
          continue;
        }
        soldier.promoteRank();
        const stats = soldier.getCurrentStats();
        stats.tu += RNG.generate(0, 5);
        stats.stamina += RNG.generate(0, 5);
        stats.health += RNG.generate(0, 5);
        stats.bravery += RNG.generate(0, 5);
        stats.reactions += RNG.generate(0, 5);
        stats.firing += RNG.generate(0, 5);
        stats.throwing += RNG.generate(0, 5);
        stats.strength += RNG.generate(0, 5);
        stats.psiStrength += RNG.generate(0, 5);
        stats.melee += RNG.generate(0, 5);
        stats.psiSkill += RNG.generate(0, 20);
      }
      const stats = soldier.getCurrentStats();
      stats.bravery = Math.ceil(stats.bravery / 10) * 10;
      base.getSoldiers().push(soldier);
      if (this._craft && i < this._craft.getRules().getSoldiers()) {
        soldier.setCraft(this._craft);
      }
    }
  }

  private seedRecoverableItems(_save: SavedGame, base: Base, includeCraftItems: boolean): void {
    const mod = this.game().getMod();
    base.getStorageItems().getContents().clear();
    for (const itemType of mod?.getItemsList() || []) {
      const rule = mod?.getItem(itemType) || null;
      if (!rule || rule.getBattleType() === BattleType.BT_CORPSE || !rule.isRecoverable()) {
        continue;
      }
      base.getStorageItems().addItem(itemType, 1);
      if (includeCraftItems && this._craft && rule.getBattleType() !== BattleType.BT_NONE && !rule.isFixed() && rule.getBigSprite() > -1) {
        this._craft.getItems().addItem(itemType, 1);
      }
    }
  }

  private addAllResearch(save: SavedGame): void {
    const mod = this.game().getMod();
    for (const researchType of mod?.getResearchList() || []) {
      const research = mod?.getResearch(researchType) || null;
      if (research) {
        save.addFinishedResearchSimple(research);
      }
    }
  }

  private pruneInvalidCraftItems(craft: Craft | null): void {
    if (!craft) {
      return;
    }
    const mod = this.game().getMod();
    for (const [itemType] of craft.getItems().getContents()) {
      if (!mod?.getItem(itemType)) {
        craft.getItems().getContents().set(itemType, 0);
      }
    }
  }

  private loadSettings(filename: string): NewBattleSettings | null {
    try {
      const raw = window.localStorage?.getItem(`openxcom.${filename}.cfg`);
      return raw ? JSON.parse(raw) as NewBattleSettings : null;
    } catch {
      return null;
    }
  }

  private randomIndex(values: unknown[]): number {
    return values.length === 0 ? 0 : Math.trunc(Math.random() * values.length);
  }
}
