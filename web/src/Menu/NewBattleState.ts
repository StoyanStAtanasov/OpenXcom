import { BattlescapeState } from "../Battlescape/BattlescapeState.ts";
import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { Position } from "../Battlescape/Position.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Frame } from "../Interface/Frame.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { Armor } from "../Mod/Armor.ts";
import { MapData, TilePart } from "../Mod/MapData.ts";
import { Unit } from "../Mod/Unit.ts";
import { BattleUnit, UnitFaction } from "../Savegame/BattleUnit.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { GameDifficulty, SavedGame } from "../Savegame/SavedGame.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { Node } from "../Savegame/Node.ts";

type NewBattleSettings = {
  mission?: number;
  craft?: number;
  darkness?: number;
  terrain?: number;
  alienRace?: number;
  difficulty?: number;
  alienTech?: number;
  depth?: number;
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
    this._slrDepth.setValue(settings.depth ?? 1);
    this.initSave();
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
      depth: this._slrDepth.getValue()
    };
    try {
      window.localStorage?.setItem(`openxcom.${filename}.cfg`, JSON.stringify(settings));
    } catch {
      // localStorage can be disabled; the original failure only logs a warning.
    }
  }

  initSave(): void {
    const mod = this.game().getMod();
    const save = mod?.newSave?.() || new SavedGame();
    save.setSavedBattle(null);
    this.game().setSavedGame(save);
    this._craft = save.getBases()[0]?.getCrafts()[this._cbxCraft.getSelected()] || null;
  }

  async btnOkClick(_action: Action | null): Promise<void> {
    this.save();
    const save = this.game().getSavedGame() || new SavedGame();
    this.game().setSavedGame(save);
    save.setDifficulty(this._cbxDifficulty.getSelected() as GameDifficulty);

    const battle = await this.createBattle(save);
    save.setSavedBattle(battle);
    if (this.game().isState(this)) {
      this.game().popState();
    }
    this.game().pushState(new BattlescapeState(battle));
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
    console.log("CraftInfoState is not translated yet.");
  }

  cbxMissionChange(_action: Action | null): void {
    const mod = this.game().getMod();
    const mission = this._missionTypes[this._cbxMission.getSelected()] || "";
    const deploymentTerrains = mod?.getDeployment(mission)?.getTerrains() || [];
    this._terrainTypes = deploymentTerrains.length > 0 ? [...deploymentTerrains] : (mod?.getTerrainList() || []);
    if (this._terrainTypes.length === 0) {
      this._terrainTypes = ["STR_FARM"];
    }
    this._cbxTerrain.setOptions(this._terrainTypes, true);
    this._cbxTerrain.setSelected(Math.min(this._cbxTerrain.getSelected(), this._terrainTypes.length - 1));
    this.cbxTerrainChange(null);
  }

  cbxCraftChange(_action: Action | null): void {
    const save = this.game().getSavedGame();
    this._craft = save?.getBases()[0]?.getCrafts()[this._cbxCraft.getSelected()] || null;
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

  private async createBattle(save: SavedGame): Promise<SavedBattleGame> {
    const battle = new SavedBattleGame();
    const mission = this._missionTypes[this._cbxMission.getSelected()] || "STR_NEW_BATTLE";
    battle.setMissionType(mission);
    battle.setGlobalShade(this._slrDarkness.getValue());
    battle.setDepth(this._slrDepth.getValue());
    let generated = await this.generateBattleMap(battle, mission);
    if (!generated) {
      this.fillDeterministicBattleMap(battle);
    }

    const unit = this.createPlayerBattleUnit(save, battle.getDepth());
    unit.setDirection(2);
    unit.setVisible(true);
    unit.setTimeUnits(Math.max(60, unit.getTimeUnits()));
    battle.getUnits().push(unit);
    const start = this.findPlayerStart(battle, unit);
    if (!start) {
      battle.getUnits().pop();
      this.fillDeterministicBattleMap(battle);
      generated = false;
      battle.getUnits().push(unit);
      battle.setUnitPosition(unit, new Position(1, 1, 0));
    } else {
      battle.setUnitPosition(unit, start);
    }
    battle.setSelectedUnit(unit);
    if (generated) {
      this.deployGeneratedUnits(battle, mission, save);
      this.recalculateGeneratedLighting(battle);
    }
    battle.resetUnitTiles();
    battle.getTileEngine()?.recalculateFOV();
    return battle;
  }

  private async generateBattleMap(battle: SavedBattleGame, mission: string): Promise<boolean> {
    const mod = this.game().getMod();
    const deployment = mod?.getDeployment(mission) || null;
    if (!mod || !deployment) {
      return false;
    }

    const terrainName = this._terrainTypes[this._cbxTerrain.getSelected()] ||
      deployment.getTerrains()[0] ||
      mod.getTerrainList()[0] ||
      "";
    const terrain = mod.getTerrain(terrainName) || null;
    if (!terrain) {
      return false;
    }

    const deploymentScriptName = deployment.getScript();
    const terrainScriptName = terrain.getScript();
    const script = (deploymentScriptName ? mod.getMapScript(deploymentScriptName) : null) ||
      mod.getMapScript(terrainScriptName);
    if (!script) {
      return false;
    }

    try {
      const [width, length, height] = deployment.getDimensions();
      battle.setTurnLimit(deployment.getTurnLimit());
      battle.setChronoTrigger(deployment.getChronoTrigger());
      battle.setCheatTurn(deployment.getCheatTurn());
      battle.setObjectiveType(deployment.getObjectiveType());
      if (deployment.getObjectivesRequired() > 0) {
        battle.setObjectiveCount(deployment.getObjectivesRequired());
      }
      if (deployment.getShade() !== -1) {
        battle.setGlobalShade(deployment.getShade());
      }
      if (deployment.getMusic().length > 0) {
        battle.setMusic(deployment.getMusic()[0]);
      } else if (terrain.getMusic().length > 0) {
        battle.setMusic(terrain.getMusic()[0]);
      }
      const generator = new BattlescapeGenerator(battle, mod);
      generator.setTerrain(terrain);
      generator.setCraft(this._craft);
      await generator.generateMap(script, terrain, width, length, height);
      battle.initUtilities(mod);
      return battle.getTiles().some(tile => !tile.isVoid());
    } catch (e) {
      console.warn("BattlescapeGenerator failed; falling back to deterministic translated battle map.", e);
      return false;
    }
  }

  private deployGeneratedUnits(battle: SavedBattleGame, mission: string, save: SavedGame): number {
    const mod = this.game().getMod();
    const deployment = mod?.getDeployment(mission) || null;
    if (!mod || !deployment) {
      return 0;
    }

    try {
      const terrainName = this._terrainTypes[this._cbxTerrain.getSelected()] ||
        deployment.getTerrains()[0] ||
        mod.getTerrainList()[0] ||
        "";
      const terrain = mod.getTerrain(terrainName) || null;
      const generator = new BattlescapeGenerator(battle, mod);
      generator.setTerrain(terrain);
      generator.setAlienRace(this._alienRaces[this._cbxAlienRace.getSelected()] || deployment.getRace());
      generator.setAlienItemlevel(this._slrAlienTech.getValue());
      generator.setDifficulty(save.getDifficulty());
      return generator.deployAliens(deployment) + generator.deployCivilians(deployment.getCivilians());
    } catch (e) {
      console.warn("BattlescapeGenerator failed to deploy units.", e);
      return 0;
    }
  }

  private recalculateGeneratedLighting(battle: SavedBattleGame): void {
    const tileEngine = battle.getTileEngine();
    if (!tileEngine) {
      return;
    }
    tileEngine.calculateSunShading();
    tileEngine.calculateTerrainLighting();
    tileEngine.calculateUnitLighting();
  }

  private fillDeterministicBattleMap(battle: SavedBattleGame): void {
    battle.initMap(10, 10, 1);
    const floor = new MapData();
    floor.setObjectType(TilePart.O_FLOOR);
    floor.setTUCosts(4, 4, 4);
    floor.setTerrainLevel(0);
    floor.setNoFloor(false);
    floor.setFootstepSound(0);
    floor.setBlockValue(0, 0, 0, 0, 0, 0);

    for (const tile of battle.getTiles()) {
      tile.setMapData(floor, 0, 0, TilePart.O_FLOOR);
      tile.setDiscovered(true, TilePart.O_FLOOR);
      tile.addLight(15, 0);
    }
    battle.initUtilities(this.game().getMod() || undefined);
  }

  private findPlayerStart(battle: SavedBattleGame, unit: BattleUnit): Position | null {
    const routePositions = battle.getNodes()
      .filter(node => !node.isDummy() && node.getSegment() === Node.CRAFTSEGMENT)
      .sort((a, b) => a.getID() - b.getID())
      .map(node => node.getPosition());

    for (const pos of routePositions) {
      if (battle.setUnitPosition(unit, pos, true)) {
        return pos.clone();
      }
    }

    for (let z = 0; z < battle.getMapSizeZ(); ++z) {
      for (let y = 0; y < battle.getMapSizeY(); ++y) {
        for (let x = 0; x < battle.getMapSizeX(); ++x) {
          const pos = new Position(x, y, z);
          if (battle.setUnitPosition(unit, pos, true)) {
            return pos;
          }
        }
      }
    }
    return null;
  }

  private createPlayerBattleUnit(save: SavedGame, depth: number): BattleUnit {
    const soldier = save.getBases()[0]?.getSoldiers().find(candidate => candidate.getCraft()) ||
      save.getBases()[0]?.getSoldiers()[0] ||
      null;
    if (soldier?.getArmor()) {
      return new BattleUnit(soldier, depth);
    }

    const armor = new Armor("STR_PERSONAL_ARMOR");
    armor.load({
      type: "STR_PERSONAL_ARMOR",
      corpseBattle: [],
      damageModifier: [],
      loftempsSet: [],
      spriteFaceColor: [],
      spriteHairColor: [],
      spriteUtileColor: [],
      spriteRankColor: [],
      units: [],
      frontArmor: 10,
      sideArmor: 8,
      rearArmor: 6,
      underArmor: 4
    });
    const unit = new Unit("SOLDIER");
    unit.load({
      type: "SOLDIER",
      rank: "STR_ROOKIE",
      armor: armor.getType(),
      stats: {
        tu: 60,
        stamina: 60,
        health: 40,
        bravery: 50,
        reactions: 50,
        firing: 50,
        throwing: 50,
        strength: 30,
        psiStrength: 40,
        psiSkill: 0,
        melee: 30
      },
      standHeight: 22,
      kneelHeight: 16,
      floatHeight: 0,
      value: 20
    });
    const battleUnit = new BattleUnit(unit, UnitFaction.FACTION_PLAYER, save.getId("STR_SOLDIER"), armor, null, depth);
    battleUnit.setTimeUnits(60);
    return battleUnit;
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
