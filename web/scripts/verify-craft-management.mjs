import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-craft-management.js");
const session = "openxcom-craft-management";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod()?.getInventory?.("STR_GROUND"));

  const result = await page.evaluate(async () => {
    const [
      { Base },
      { Craft },
      { Vehicle },
      { Soldier },
      { BattleItem },
      { CraftEquipmentState },
      { InventoryState },
      { Action },
      { InventoryType, RuleInventory },
      { BattleType },
      { createUnitStats },
      { MovementType },
      { Options },
      { SDL_BUTTON_RIGHT, SDL_BUTTON_X1, SDL_BUTTON_X2 }
    ] = await Promise.all([
      import("/web/dist/Savegame/Base.js"),
      import("/web/dist/Savegame/Craft.js"),
      import("/web/dist/Savegame/Vehicle.js"),
      import("/web/dist/Savegame/Soldier.js"),
      import("/web/dist/Savegame/BattleItem.js"),
      import("/web/dist/Basescape/CraftEquipmentState.js"),
      import("/web/dist/Battlescape/InventoryState.js"),
      import("/web/dist/Engine/Action.js"),
      import("/web/dist/Mod/RuleInventory.js"),
      import("/web/dist/Mod/RuleItem.js"),
      import("/web/dist/Mod/Unit.js"),
      import("/web/dist/Mod/Armor.js"),
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/types.js")
    ]);
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const makeRule = (type, options = {}) => ({
      getType: () => type,
      getName: () => options.name || type,
      getSize: () => options.size ?? 1,
      getClipSize: () => options.clipSize ?? 0,
      getCompatibleAmmo: () => options.compatibleAmmo || [],
      getBattleType: () => options.battleType ?? BattleType.BT_FIREARM,
      drawHandSprite: () => {},
      getBigSprite: () => options.bigSprite ?? 1,
      getWeight: () => options.weight ?? 1,
      getInventoryWidth: () => options.inventoryWidth ?? 1,
      getInventoryHeight: () => options.inventoryHeight ?? 1,
      getRequirements: () => options.requirements || [],
      isFixed: () => options.fixed ?? false,
      isRifle: () => Boolean(options.twoHanded),
      isPistol: () => (options.battleType ?? BattleType.BT_FIREARM) === BattleType.BT_FIREARM && !options.twoHanded,
      isRecoverable: () => options.recoverable ?? true,
      getSpecialType: () => 0,
      getRecoveryPoints: () => 0,
      isAlien: () => false,
      getSellCost: () => options.sellCost ?? 0
    });

    const hwpAmmoed = makeRule("HWP_AMMOED", { fixed: true, clipSize: 6, compatibleAmmo: ["HWP_AMMO"], size: 8 });
    const hwpAmmo = makeRule("HWP_AMMO", { clipSize: 2, size: 0.5, battleType: BattleType.BT_AMMO });
    const hwpNoAmmo = makeRule("HWP_NO_AMMO", { fixed: true, clipSize: 12, size: 7 });
    const rifle = makeRule("STR_RIFLE", { size: 1 });
    const grenade = makeRule("STR_GRENADE", { battleType: BattleType.BT_GRENADE });
    const proximityGrenade = makeRule("STR_PROXIMITY_GRENADE", { battleType: BattleType.BT_PROXIMITYGRENADE });
    const testWeapon = makeRule("STR_TEST_WEAPON", { compatibleAmmo: ["STR_TEST_CLIP"] });
    const testClip = makeRule("STR_TEST_CLIP", { battleType: BattleType.BT_AMMO, clipSize: 10 });
    const rules = new Map([
      [hwpAmmoed.getType(), hwpAmmoed],
      [hwpAmmo.getType(), hwpAmmo],
      [hwpNoAmmo.getType(), hwpNoAmmo],
      [rifle.getType(), rifle],
      [grenade.getType(), grenade],
      [proximityGrenade.getType(), proximityGrenade],
      [testWeapon.getType(), testWeapon],
      [testClip.getType(), testClip]
    ]);

    const craftRule = {
      getType: () => "STR_SKYRANGER",
      getWeapons: () => 0,
      getMaxSpeed: () => 0,
      getMarker: () => -1,
      getSoldiers: () => 8,
      getVehicles: () => 2,
      getMaxItems: () => 80,
      getMaxFuel: () => 100,
      getMaxDamage: () => 100,
      getRefuelItem: () => ""
    };
    const storageRule = {
      getStorage: () => 10,
      getPersonnel: () => 0,
      getLaboratories: () => 0,
      getWorkshops: () => 0,
      getCrafts: () => 0,
      getPsiLaboratories: () => 0,
      getAliens: () => 0,
      getDefenseValue: () => 0,
      getRadarRange: () => 0,
      getRadarChance: () => 0,
      isHyper: () => false,
      isGrav: () => false,
      getMonthlyCost: () => 0
    };

    const game = window.openxcomGame;
    const mod = game.getMod();
    const originalGetItem = mod.getItem.bind(mod);
    const originalGetItemsList = mod.getItemsList?.bind(mod);
    const originalGetUnit = mod.getUnit.bind(mod);
    const originalGetArmor = mod.getArmor.bind(mod);
    const originalGetSoldier = mod.getSoldier.bind(mod);
    const originalSave = game.getSavedGame();
    let previousSavedGame = game.getSavedGame();
    const originalStates = [...game._states];
    const originalStorageLimits = Options.storageLimitsEnforced;
    const originalIncludePrimeState = Options.includePrimeStateInSavedLayout;

    const fakeSavedGame = {
      _savedBattle: null,
      getMonthsPassed: () => 0,
      isResearched: requirements => Array.isArray(requirements),
      setSavedBattle(battle) {
        this._savedBattle = battle;
      },
      getSavedBattle() {
        return this._savedBattle;
      }
    };

    mod.getItem = (type, error = false) => {
      const rule = rules.get(type) || null;
      if (!rule && error) throw new Error("missing fake rule " + type);
      return rule;
    };
    mod.getItemsList = () => ["HWP_AMMOED", "HWP_AMMO", "HWP_NO_AMMO", "STR_RIFLE"];
    mod.getUnit = type => type === "HWP_AMMOED" || type === "HWP_NO_AMMO" ? { getArmor: () => "HWP_ARMOR" } : null;
    mod.getArmor = (type, error = false) => {
      if (type === "HWP_ARMOR") {
        return { getSize: () => 2 };
      }
      const armor = originalGetArmor(type, error);
      if (error && !armor) {
        throw new Error("missing fake armor " + type);
      }
      return armor;
    };
    mod.getSoldier = (type, error = false) => {
      const soldier = originalGetSoldier(type, error);
      if (error && !soldier) {
        throw new Error("missing fake soldier " + type);
      }
      return soldier;
    };

    try {
      game.setSavedGame(fakeSavedGame);

      const base = new Base(mod);
      base.setName("BASE");
      base.getFacilities().push({ getBuildTime: () => 0, getRules: () => storageRule });
      base.getStorageItems().load({ HWP_AMMOED: 2, HWP_AMMO: 4, HWP_NO_AMMO: 1, STR_RIFLE: 5 });

      const craft = new Craft(craftRule, base, 1);
      craft.setName("SKYRANGER-1");
      base.getCrafts().push(craft);
      craft.getItems().addItem("STR_RIFLE", 2);
      craft.getVehicles().push(new Vehicle(hwpNoAmmo, 12, 4));

      assert(craft.getNumVehicles() === 1, "real craft vehicle list not used");
      assert(craft.getVehicleCount("HWP_NO_AMMO") === 1, "craft vehicle count mismatch");
      assert(craft.getSpaceUsed() === 4, "craft vehicle space should use Vehicle.getSize()");
      assert(craft.getSpaceAvailable() === 4, "craft available space mismatch");

      craft.setStatus("STR_REARMING");
      craft.getWeapons().push({
        isRearming: () => true,
        getRules: () => ({ getClipItem: () => "HWP_AMMO", getAmmoMax: () => 10 }),
        getAmmo: () => 4
      });
      assert(base.getIgnoredStores() === 1.5, "ignored rearming clip stores mismatch");
      assert(base.getUsedStores() === 37.5, "base used stores should include craft vehicle rule size and subtract ignored rearming clips");

      craft.setStatus("STR_READY");
      const savedBattleBeforeInventory = fakeSavedGame.getSavedBattle();
      game._states = [];
      const state = new CraftEquipmentState(base, 0);
      const hwpRow = state._items.indexOf("HWP_AMMOED");
      assert(hwpRow !== -1, "HWP row missing from CraftEquipmentState");
      state._sel = hwpRow;
      state.moveRightByValue(2);
      assert(craft.getVehicleCount("HWP_AMMOED") === 1, "CraftEquipmentState did not add a real HWP vehicle");
      assert(craft.getNumVehicles() === 2, "craft vehicle cap was not respected");
      assert(base.getStorageItems().getItem("HWP_AMMOED") === 1, "HWP item consumption mismatch");
      assert(base.getStorageItems().getItem("HWP_AMMO") === 1, "HWP ammo consumption mismatch");
      assert(craft.getSpaceUsed() === 8 && craft.getSpaceAvailable() === 0, "craft space text source helpers mismatch after adding HWP");

      state.moveLeftByValue(1);
      assert(craft.getVehicleCount("HWP_AMMOED") === 0, "CraftEquipmentState did not remove the real HWP vehicle");
      assert(base.getStorageItems().getItem("HWP_AMMOED") === 2, "HWP item return mismatch");
      assert(base.getStorageItems().getItem("HWP_AMMO") === 4, "HWP ammo return mismatch");
      assert(craft.getSpaceUsed() === 4 && craft.getSpaceAvailable() === 4, "craft space helper mismatch after removing HWP");
      craft.getItems().addItem("STR_RIFLE", 1);

      const soldierType = (mod.getSoldiersList?.() || [])[0] || "STR_SOLDIER";
      const soldierRule = mod.getSoldier?.(soldierType) || {
        getStandHeight: () => 16,
        getKneelHeight: () => 10,
        getFloatHeight: () => 0,
        getRequirements: () => [],
        getValue: () => 0,
        getType: () => "STR_SOLDIER"
      };
      const fallbackArmor = {
        getMovementType: () => MovementType.MT_WALK,
        getStats: () => createUnitStats(),
        getLoftempsSet: () => [],
        getFrontArmor: () => 0,
        getSideArmor: () => 0,
        getRearArmor: () => 0,
        getUnderArmor: () => 0,
        getFaceColorGroup: () => 0,
        getFaceColor: () => 0,
        getHairColorGroup: () => 0,
        getHairColor: () => 0,
        getUtileColorGroup: () => 0,
        getUtileColor: () => 0,
        getRankColorGroup: () => 0,
        getRankColor: () => 0,
        getType: () => "STR_FAKE_ARMOR",
        getSize: () => 1,
        getWeight: () => 0,
        getDamageModifier: () => 1,
        getDeathFrames: () => 3,
        getSpriteInventory: () => "",
        drawBubbles: () => false
      };
      const soldierArmor = mod.getArmor?.(mod.getArmorsList?.()[0] || "STR_NONE") || fallbackArmor;
      const soldier = new Soldier(soldierRule, soldierArmor, 0);
      soldier.setName("INV-SOLDIER-1");
      soldier.setCraft(craft);
      base.getSoldiers().push(soldier);
      const secondSoldier = new Soldier(soldierRule, soldierArmor, 0);
      secondSoldier.setName("INV-SOLDIER-2");
      secondSoldier.setCraft(craft);
      base.getSoldiers().push(secondSoldier);
      assert(craft.getNumSoldiers() === 2, "craft soldier fixture not attached before inventory click");

      state.btnInventoryClick();
      const topState = game._states.at(-1);
      const topStateName = topState ? topState.constructor?.name || "UNKNOWN" : "none";
      const isInventoryState = topState instanceof InventoryState || topStateName === "InventoryState";
      const savedBattle = fakeSavedGame.getSavedBattle();
      assert(savedBattle !== null, "btnInventoryClick should set SavedBattle");
      const mapsize = [
        savedBattle?.getMapSizeX?.() ?? null,
        savedBattle?.getMapSizeY?.() ?? null,
        savedBattle?.getMapSizeZ?.() ?? null
      ];
      const mapPreparedForInventory = mapsize[0] === 2 && mapsize[1] === 2 && mapsize[2] === 1;
      if (isInventoryState) {
        assert(mapPreparedForInventory, "InventoryState path should initialize a 2x2x1 saved battle map");
        assert(savedBattle?.getTiles?.().length === 4, "InventoryState path should create inventory tiles");
      } else {
        assert(!mapPreparedForInventory, "Legacy path should not initialize inventory map before the translation is complete");
        assert(savedBattleBeforeInventory === null, "Inventory click should set SavedBattle from a clean starting point");
      }
      assert(isInventoryState, "btnInventoryClick should now push InventoryState");
      const battleUnit = savedBattle?.getSelectedUnit?.();
      const groundTile = battleUnit?.getTile?.();
      assert(savedBattle?.getUnits?.().length === 2, "inventory launch should populate both craft soldier battle units");
      assert(battleUnit, "inventory launch should select the craft soldier battle unit");
      assert(groundTile?.getInventory?.().length >= 1, "inventory launch should place remaining craft equipment on the inventory tile");

      topState.init();
      const makeButtonAction = button => new Action({ type: "SDL_MOUSEBUTTONDOWN", button: { x: 0, y: 0, button } }, 1, 1, 0, 0);
      const firstBattleUnit = savedBattle.getSelectedUnit();
      topState.handle(makeButtonAction(SDL_BUTTON_X1));
      assert(savedBattle.getSelectedUnit() !== firstBattleUnit, "InventoryState X1 should select the next unit");
      topState.handle(makeButtonAction(SDL_BUTTON_X2));
      assert(savedBattle.getSelectedUnit() === firstBattleUnit, "InventoryState X2 should select the previous unit");
      const nonFixedInventory = () => battleUnit.getInventory().filter(item => !item.getRules().isFixed());
      const groundCount = () => groundTile.getInventory().length;
      assert(nonFixedInventory().length >= 1, "auto-equip should place one craft item on the selected unit");
      const firstTemplateSlot = nonFixedInventory()[0].getSlot()?.getId?.();

      topState.btnCreateTemplateClick();
      assert(topState._curInventoryTemplate.length === nonFixedInventory().length, "create template should copy source layout items, not item references");
      assert(topState._curInventoryTemplate[0].itemType === "STR_RIFLE", "template should record source item type");
      assert(topState._curInventoryTemplate[0].slot === firstTemplateSlot, "template should record source slot id");

      const invWidget = topState._inv;
      assert(invWidget, "InventoryState should expose _inv for mouseClick-driven inventory coverage");
      const makeMouseAction = (x, y, button = 1) => {
        const absoluteX = x + (invWidget.getX?.() || 0);
        const absoluteY = y + (invWidget.getY?.() || 0);
        const action = new Action({ type: "SDL_MOUSEBUTTONDOWN", button: { x: absoluteX, y: absoluteY, button } }, 1, 1, 0, 0);
        action.setMouseAction(absoluteX, absoluteY, 0, 0);
        return action;
      };

      const sourceItem = nonFixedInventory().find(item => item.getSlot()?.getType?.() !== InventoryType.INV_GROUND);
      assert(!!sourceItem, "mouseClick assertion needs a non-ground, non-fixed movable item");
      const sourceSlot = sourceItem.getSlot?.();
      assert(!!sourceSlot, "selected source item should expose a source inventory slot");
      const sourceSlotX = sourceSlot.getX?.() ?? 0;
      const sourceSlotY = sourceSlot.getY?.() ?? 0;
      const sourceActionX = sourceSlot.getType?.() === InventoryType.INV_HAND
        ? sourceSlotX + Math.floor(RuleInventory.HAND_W * RuleInventory.SLOT_W / 2)
        : sourceSlotX + sourceItem.getSlotX() * RuleInventory.SLOT_W + Math.floor(RuleInventory.SLOT_W / 2);
      const sourceActionY = sourceSlot.getType?.() === InventoryType.INV_HAND
        ? sourceSlotY + Math.floor(RuleInventory.HAND_H * RuleInventory.SLOT_H / 2)
        : sourceSlotY + sourceItem.getSlotY() * RuleInventory.SLOT_H + Math.floor(RuleInventory.SLOT_H / 2);
      const sourceAction = makeMouseAction(
        sourceActionX,
        sourceActionY
      );
      const carryCountBefore = battleUnit?.getInventory?.().length || 0;
      const groundBeforeMove = groundCount();
      const originalModifiers = Options.getKeyModifiers?.() ?? 0;

      try {
        Options.setKeyModifiers?.(1);
        Options.keyModifiers = 1;
        invWidget.mouseOver(sourceAction, topState);
        invWidget.mouseClick(sourceAction, topState);
      } finally {
        Options.setKeyModifiers?.(originalModifiers);
        Options.keyModifiers = originalModifiers;
      }
      const carryAfter = battleUnit?.getInventory?.() || [];
      assert(!invWidget.getSelectedItem?.(), "Ctrl Inventory.mouseClick quick-move should not leave a selected item");
      assert(!carryAfter.includes(sourceItem), "Dropped inventory item should be removed from soldier carry list");
      assert(carryAfter.length === carryCountBefore - 1, "Soldier carry count should decrease after Ctrl mouse quick-move");
      const groundAfter = groundCount();
      assert(sourceItem.getSlot?.()?.getType?.() === InventoryType.INV_GROUND, "Ctrl Inventory.mouseClick should move carried item to ground in this fixture");
      assert(groundAfter > groundBeforeMove, "Ctrl Inventory.mouseClick should add moved item to the ground tile");

      topState.onAutoequip();
      assert(nonFixedInventory().length >= 1, "autoequip should recover a carried item after Ctrl mouse quick-move");

      const dragItem = nonFixedInventory().find(item => item.getSlot()?.getType?.() !== InventoryType.INV_GROUND);
      assert(!!dragItem, "drag/drop assertion needs a carried item after autoequip");
      const dragSlot = dragItem.getSlot?.();
      assert(!!dragSlot, "drag/drop source item should expose a source inventory slot");
      const dragSourceAction = makeMouseAction(
        dragSlot.getType?.() === InventoryType.INV_HAND
          ? (dragSlot.getX?.() || 0) + Math.floor(RuleInventory.HAND_W * RuleInventory.SLOT_W / 2)
          : (dragSlot.getX?.() || 0) + dragItem.getSlotX() * RuleInventory.SLOT_W + Math.floor(RuleInventory.SLOT_W / 2),
        dragSlot.getType?.() === InventoryType.INV_HAND
          ? (dragSlot.getY?.() || 0) + Math.floor(RuleInventory.HAND_H * RuleInventory.SLOT_H / 2)
          : (dragSlot.getY?.() || 0) + dragItem.getSlotY() * RuleInventory.SLOT_H + Math.floor(RuleInventory.SLOT_H / 2)
      );
      const groundRule = mod.getInventory("STR_GROUND", true);
      const currentGroundOffset = invWidget._groundOffset || 0;
      const makeGroundItemAction = (item, button = 1) => makeMouseAction(
        groundRule.getX() + (item.getSlotX() - (invWidget._groundOffset || 0)) * RuleInventory.SLOT_W + Math.floor(RuleInventory.SLOT_W / 2),
        groundRule.getY() + item.getSlotY() * RuleInventory.SLOT_H + Math.floor(RuleInventory.SLOT_H / 2),
        button
      );
      let dragTarget = null;
      for (let y = 0; y < 4 && !dragTarget; ++y) {
        for (let x = 0; x < 8 && !dragTarget; ++x) {
          if (!battleUnit.getItem(groundRule, x + currentGroundOffset, y)) {
            dragTarget = {
              x: groundRule.getX() + x * RuleInventory.SLOT_W + Math.floor(RuleInventory.SLOT_W / 2),
              y: groundRule.getY() + y * RuleInventory.SLOT_H + Math.floor(RuleInventory.SLOT_H / 2),
              slotX: x + currentGroundOffset,
              slotY: y
            };
          }
        }
      }
      assert(!!dragTarget, "drag/drop assertion needs an empty ground target slot");
      const carryBeforeDrag = battleUnit.getInventory().length;
      const groundBeforeDrag = groundCount();
      invWidget.mouseOver(dragSourceAction, topState);
      invWidget.mouseClick(dragSourceAction, topState);
      assert(invWidget.getSelectedItem?.() === dragItem, "Inventory.mouseClick should pick up a carried item before explicit drop");
      const dragTargetAction = makeMouseAction(dragTarget.x, dragTarget.y);
      invWidget.mouseOver(dragTargetAction, topState);
      invWidget.mouseClick(dragTargetAction, topState);
      assert(!invWidget.getSelectedItem?.(), "Inventory.mouseClick explicit drop should clear selected item");
      assert(!battleUnit.getInventory().includes(dragItem), "Explicit drag/drop should remove moved item from soldier inventory");
      assert(battleUnit.getInventory().length === carryBeforeDrag - 1, "Explicit drag/drop should reduce carried item count");
      assert(groundCount() === groundBeforeDrag + 1, "Explicit drag/drop should add moved item to ground");
      assert(dragItem.getSlot?.() === groundRule, "Explicit drag/drop should set moved item to STR_GROUND");
      assert(dragItem.getSlotX?.() === dragTarget.slotX && dragItem.getSlotY?.() === dragTarget.slotY, "Explicit drag/drop should keep target ground coordinates");

      topState.onAutoequip();
      assert(nonFixedInventory().length >= 1, "autoequip should recover a carried item after explicit drag/drop");

      const proxGrenade = new BattleItem(proximityGrenade, 9001);
      groundTile.addItem(proxGrenade, groundRule);
      invWidget.arrangeGround(false);
      try {
        Options.includePrimeStateInSavedLayout = true;
        let proxAction = makeGroundItemAction(proxGrenade, SDL_BUTTON_RIGHT);
        invWidget.mouseOver(proxAction, topState);
        invWidget.mouseClick(proxAction, topState);
        assert(proxGrenade.getFuseTimer() === 0, "Right-click proximity grenade should activate fuse timer in inventory view");
        proxAction = makeGroundItemAction(proxGrenade, SDL_BUTTON_RIGHT);
        invWidget.mouseOver(proxAction, topState);
        invWidget.mouseClick(proxAction, topState);
        assert(proxGrenade.getFuseTimer() === -1, "Right-click active proximity grenade should deactivate fuse timer");
      } finally {
        Options.includePrimeStateInSavedLayout = originalIncludePrimeState;
      }

      const timedGrenade = new BattleItem(grenade, 9006);
      groundTile.addItem(timedGrenade, groundRule);
      invWidget.arrangeGround(false);
      const statesBeforeGrenadePrime = game._states.length;
      try {
        Options.includePrimeStateInSavedLayout = true;
        const timedGrenadeAction = makeGroundItemAction(timedGrenade, SDL_BUTTON_RIGHT);
        invWidget.mouseOver(timedGrenadeAction, topState);
        invWidget.mouseClick(timedGrenadeAction, topState);
        const pushedStateName = game._states.at(-1)?.constructor?.name || "";
        assert(game._states.length === statesBeforeGrenadePrime + 1 && pushedStateName === "PrimeGrenadeState", "Right-click timed grenade should push PrimeGrenadeState");
        game.popState();
      } finally {
        Options.includePrimeStateInSavedLayout = originalIncludePrimeState;
      }

      const groundBeforeClear = groundCount();
      topState.onClearInventory();
      assert(nonFixedInventory().length === 0, "clear inventory should move non-fixed carried items to ground");
      assert(groundCount() > groundBeforeClear, "clear inventory should add carried items to the inventory tile");

      topState.onAutoequip();
      assert(nonFixedInventory().length >= 1, "autoequip should move ground items back to the selected unit");
      topState.onClearInventory();
      topState.btnApplyTemplateClick();
      assert(nonFixedInventory().length === topState._curInventoryTemplate.length, "apply template should restore copied item count");
      assert(nonFixedInventory()[0].getRules().getType() === "STR_RIFLE", "apply template should restore copied item type");
      assert(nonFixedInventory()[0].getSlot()?.getId?.() === firstTemplateSlot, "apply template should restore copied slot");

      const loadWeapon = new BattleItem(testWeapon, 9002);
      const loadClip = new BattleItem(testClip, 9003);
      groundTile.addItem(loadWeapon, groundRule);
      groundTile.addItem(loadClip, groundRule);
      invWidget.arrangeGround(false);
      const groundBeforeAmmoLoad = groundCount();
      const clipAction = makeGroundItemAction(loadClip);
      invWidget.mouseOver(clipAction, topState);
      invWidget.mouseClick(clipAction, topState);
      assert(invWidget.getSelectedItem?.() === loadClip, "Inventory.mouseClick should pick up ammo before loading a weapon");
      const weaponAction = makeGroundItemAction(loadWeapon);
      invWidget.mouseOver(weaponAction, topState);
      invWidget.mouseClick(weaponAction, topState);
      assert(!invWidget.getSelectedItem?.(), "Inventory.mouseClick ammo-load should clear selected ammo");
      assert(loadWeapon.getAmmoItem?.() === loadClip, "Inventory.mouseClick should load compatible ammo into weapon");
      assert(!groundTile.getInventory().includes(loadClip), "Loaded ammo should be removed from ground inventory");
      assert(groundCount() === groundBeforeAmmoLoad - 1, "Ammo-load should reduce ground item count by the loaded clip");

      const emptyGroundCells = [];
      for (let y = 0; y < 4 && emptyGroundCells.length < 2; ++y) {
        for (let x = 0; x < 8 && emptyGroundCells.length < 2; ++x) {
          const slotX = x + (invWidget._groundOffset || 0);
          if (!battleUnit.getItem(groundRule, slotX, y)) {
            emptyGroundCells.push({ slotX, slotY: y });
          }
        }
      }
      assert(emptyGroundCells.length === 2, "Stack assertion needs two empty ground cells");
      const stackClipA = new BattleItem(testClip, 9004);
      const stackClipB = new BattleItem(testClip, 9005);
      groundTile.addItem(stackClipA, groundRule);
      stackClipA.setSlotX(emptyGroundCells[0].slotX);
      stackClipA.setSlotY(emptyGroundCells[0].slotY);
      groundTile.addItem(stackClipB, groundRule);
      stackClipB.setSlotX(emptyGroundCells[1].slotX);
      stackClipB.setSlotY(emptyGroundCells[1].slotY);
      const groundBeforeStack = groundCount();
      const stackSourceAction = makeGroundItemAction(stackClipA);
      invWidget.mouseOver(stackSourceAction, topState);
      invWidget.mouseClick(stackSourceAction, topState);
      assert(invWidget.getSelectedItem?.() === stackClipA, "Inventory.mouseClick should pick up a stackable ground item");
      const stackTargetAction = makeGroundItemAction(stackClipB);
      invWidget.mouseOver(stackTargetAction, topState);
      invWidget.mouseClick(stackTargetAction, topState);
      assert(!invWidget.getSelectedItem?.(), "Inventory.mouseClick stack drop should clear selected item");
      assert(groundCount() === groundBeforeStack, "Stacking should keep both items on the ground tile");
      assert(stackClipA.getSlot?.() === groundRule && stackClipB.getSlot?.() === groundRule, "Stacked items should stay on STR_GROUND");
      assert(stackClipA.getSlotX?.() === stackClipB.getSlotX?.() && stackClipA.getSlotY?.() === stackClipB.getSlotY?.(), "Stacking should move selected item onto target item coordinates");
      assert(craft.isInBattlescape(), "craft should be set in battlescape before inventory launch");

      return {
        vehicles: craft.getVehicles().map(vehicle => ({ type: vehicle.getRules().getType(), ammo: vehicle.getAmmo(), size: vehicle.getSize() })),
        baseStores: Object.fromEntries(base.getStorageItems().getContents()),
        ignoredStores: base.getIgnoredStores(),
        usedStores: base.getUsedStores(),
        spaceUsed: craft.getSpaceUsed(),
        spaceAvailable: craft.getSpaceAvailable(),
        inventoryRoute: {
          topStateName,
          savedBattleBeforeInventory: !!savedBattleBeforeInventory,
          savedBattleAfterInventory: !!savedBattle,
          mapsize,
          mapPreparedForInventory,
          units: savedBattle?.getUnits?.().length,
          templateSize: topState._curInventoryTemplate?.length || 0,
          unitInventory: nonFixedInventory().map(item => ({ type: item.getRules().getType(), slot: item.getSlot()?.getId?.() || "" })),
          groundItems: groundTile?.getInventory?.().map(item => item.getRules().getType()) || [],
          craftInBattlescape: craft.isInBattlescape(),
          inventoryMouseClick: {
            ctrlQuickMove: true,
            explicitDragDrop: true,
            ammoLoad: true,
            rightClickProximityGrenade: true,
            rightClickTimedGrenade: true,
            groundStack: true,
            x1x2UnitCycle: true
          }
        }
      };
    } finally {
      game.setSavedGame(previousSavedGame);
      game._states = originalStates;
      Options.storageLimitsEnforced = originalStorageLimits;
      Options.includePrimeStateInSavedLayout = originalIncludePrimeState;
      mod.getItem = originalGetItem;
      mod.getItemsList = originalGetItemsList || (() => []);
      mod.getUnit = originalGetUnit;
      mod.getArmor = originalGetArmor;
      mod.getSoldier = originalGetSoldier;
    }
  });

  await page.evaluate(value => console.log("VERIFY_CRAFT_MANAGEMENT ok " + JSON.stringify(value)), result);
}`;

function line(message) {
  console.log(message);
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n"&|^<>\(\)]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

async function run(name, command, args, cwd = webRoot) {
  line(`- ${name}`);
  const useCmd = process.platform === "win32" && command.endsWith(".cmd");
  const runner = useCmd ? "cmd" : command;
  const runnerArgs = useCmd ? ["/d", "/s", "/c", [command, ...args.map(quoteForCmd)].join(" ")] : args;
  const stdout = [];
  const stderr = [];
  return await new Promise((resolve, reject) => {
    const child = spawn(runner, runnerArgs, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", chunk => stdout.push(String(chunk)));
    child.stderr.on("data", chunk => stderr.push(String(chunk)));
    child.on("error", reject);
    child.on("close", code => {
      const outText = stdout.join("");
      const errText = stderr.join("");
      if (code === 0) {
        resolve({ stdout: outText, stderr: errText });
      } else {
        reject(new Error(`${name} failed\nstdout:\n${outText}\nstderr:\n${errText}`));
      }
    });
  });
}

function serverReady() {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForServer() {
  for (let i = 0; i < 40; ++i) {
    if (await serverReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Local web server did not become ready");
}

async function runBrowserVerifier() {
  line("- browser VERIFY_CRAFT_MANAGEMENT");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(verifierPath, verifier, "utf8");

  let server = null;
  if (!(await serverReady())) {
    server = spawn(process.execPath, [join(webRoot, "scripts", "serve.mjs")], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: "ignore"
    });
    await waitForServer();
  }

  try {
    await run("playwright open", npm, [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "open", url
    ], repoRoot);
    const runCodeResult = await run("playwright run-code", npm, [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "run-code", "--filename", verifierPath
    ], repoRoot);
    const marker = "VERIFY_CRAFT_MANAGEMENT ok";
    const runOutput = `${runCodeResult.stdout}\n${runCodeResult.stderr}`;
    let consoleLogPath = null;
    const match = runOutput.match(/(?:\.playwright-cli[\\/][^\\s#]+\\.log)(?:#L\d+-L\d+)?/);
    if (match) {
      const rawPath = match[0].split("#")[0];
      consoleLogPath = normalize(join(repoRoot, rawPath));
      const consoleText = await readFile(consoleLogPath, "utf8");
      if (!consoleText.includes(marker)) {
        throw new Error(`Verifier marker missing from Playwright console log: ${rawPath}`);
      }
    } else if (!runOutput.includes(marker)) {
      throw new Error(`Browser verifier marker missing from run-code output:\n${runOutput}`);
    }
  } finally {
    await run("playwright close", npm, [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "close"
    ], repoRoot).catch(() => {});
    if (server) {
      server.kill();
    }
    await rm(verifierPath, { force: true });
  }
}

async function main() {
  line("VERIFY_CRAFT_MANAGEMENT");
  await run("build", npm, ["run", "build"]);
  await run("typecheck", npm, ["run", "typecheck"]);
  await runBrowserVerifier();
  line("VERIFY_CRAFT_MANAGEMENT ok");
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
