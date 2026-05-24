import { Surface } from "./Surface.ts";
import { InteractiveSurface } from "./InteractiveSurface.ts";
import { LocalizedText } from "./LocalizedText.ts";
import { Palette } from "./Palette.ts";
import type { PaletteColor } from "../types.ts";
import type { Action } from "./Action.ts";
import type { Game } from "./Game.ts";
import { INT_MAX, type RuleInterface } from "../Mod/RuleInterface.ts";
import { Mod } from "../Mod/Mod.ts";
import { BattlescapeButton } from "../Interface/BattlescapeButton.ts";

export class State {
  protected static _game: Game;
  protected _surfaces: Surface[] = [];
  protected _screen = true;
  protected _modal: InteractiveSurface | null = null;
  protected _ruleInterface: RuleInterface | null = null;
  protected _ruleInterfaceParent: RuleInterface | null = null;
  protected _palette: PaletteColor[] = Palette.createDefault();
  protected _cursorColor = 3;

  constructor() {
    this._palette = Palette.createDefault();
  }

  setInterface(category: string, alterPal = false): void {
    let backPal = -1;
    let pal = "PAL_GEOSCAPE";
    this._ruleInterface = State._game.getMod()?.getInterface(category) || null;
    if (this._ruleInterface) {
      this._ruleInterfaceParent = State._game.getMod()?.getInterface(this._ruleInterface.getParent()) || null;
      pal = this._ruleInterface.getPalette();
      let element = this._ruleInterface.getElement("palette");
      if (this._ruleInterfaceParent) {
        if (!element) {
          element = this._ruleInterfaceParent.getElement("palette");
        }
        if (!pal) {
          pal = this._ruleInterfaceParent.getPalette();
        }
      }
      if (element) {
        const color = alterPal ? element.color2 : element.color;
        if (color !== INT_MAX) {
          backPal = color;
        }
      }
    }
    if (!pal) {
      pal = "PAL_GEOSCAPE";
    }
    this.setPalette(this.paletteForInterface(pal, backPal));
  }

  add(surface: Surface, id?: string, category?: string, parent?: Surface): void {
    surface.setPalette(this._palette);
    if (id != null && category != null) {
      const element = State._game.getMod()?.getInterface(category)?.getElement(id);
      if (element) {
        if (parent && element.w !== INT_MAX && element.h !== INT_MAX) {
          surface.setWidth(element.w);
          surface.setHeight(element.h);
        }
        if (parent && element.x !== INT_MAX && element.y !== INT_MAX) {
          surface.setX(parent.getX() + element.x);
          surface.setY(parent.getY() + element.y);
        }
        surface.setTFTDMode(element.TFTDMode);
        if (element.color !== INT_MAX) {
          surface.setColor(element.color);
        }
        if (element.color2 !== INT_MAX) {
          surface.setSecondaryColor(element.color2);
        }
        if (element.border !== INT_MAX) {
          surface.setBorderColor(element.border);
        }
      }
    }
    if (surface instanceof BattlescapeButton && parent) {
      surface.copy(parent);
      surface.initSurfaces();
    }
    surface.initText(State._game.getMod()?.getFont("FONT_BIG"), State._game.getMod()?.getFont("FONT_SMALL"), State._game.getLanguage());
    this._surfaces.push(surface);
  }

  isScreen(): boolean {
    return this._screen;
  }

  toggleScreen(): void {
    this._screen = !this._screen;
  }

  init(): void {
    State._game.getScreen().setPalette(this._palette);
    State._game.getCursor().setPalette(this._palette);
    State._game.getCursor().setColor(this._cursorColor);
    State._game.getCursor().draw();
    State._game.getFpsCounter().setPalette(this._palette);
    State._game.getFpsCounter().setColor(this._cursorColor);
    State._game.getFpsCounter().draw();
    State._game.getMod()?.setPalette(this._palette);
  }

  handle(action: Action): void {
    if (!this._modal) {
      for (let i = this._surfaces.length - 1; i >= 0; --i) {
        const surface = this._surfaces[i];
        if (surface instanceof InteractiveSurface) {
          surface.handle(action, this);
        }
      }
    } else {
      this._modal.handle(action, this);
    }
  }

  think(): void {
    for (const surface of this._surfaces) {
      surface.think();
    }
  }

  blit(): void {
    for (const surface of this._surfaces) {
      surface.blit(State._game.getScreen().getSurface());
    }
  }

  hideAll(): void {
    for (const surface of this._surfaces) {
      surface.setHidden(true);
    }
  }

  showAll(): void {
    for (const surface of this._surfaces) {
      surface.setHidden(false);
    }
  }

  resetAll(): void {
    for (const surface of this._surfaces) {
      if (surface instanceof InteractiveSurface) {
        surface.unpress(this);
      }
    }
  }

  tr(id: string, n?: number): LocalizedText {
    return State._game.getLanguage().getString(id, n);
  }

  redrawText(): void {
    for (const surface of this._surfaces) {
      surface.draw();
    }
  }

  centerAllSurfaces(): void {
    for (const surface of this._surfaces) {
      surface.setX(surface.getX() + State._game.getScreen().getDX());
      surface.setY(surface.getY() + State._game.getScreen().getDY());
    }
  }

  lowerAllSurfaces(): void {
    for (const surface of this._surfaces) {
      surface.setY(surface.getY() + Math.trunc(State._game.getScreen().getDY() / 2));
    }
  }

  applyBattlescapeTheme(): void {}

  static setGamePtr(game: Game): void {
    State._game = game;
  }

  setModal(surface: InteractiveSurface | null): void {
    this._modal = surface;
  }

  setPalette(colors: PaletteColor[] | null, firstcolor = 0, ncolors = 256, immediately = true): void {
    if (colors) {
      for (let i = 0; i < ncolors && i < colors.length; ++i) {
        this._palette[firstcolor + i] = colors[i];
      }
    }
    if (immediately) {
      State._game?.getCursor().setPalette(this._palette);
      State._game?.getFpsCounter().setPalette(this._palette);
      State._game?.getMod()?.setPalette(this._palette);
    }
  }

  getPalette(): PaletteColor[] {
    return this._palette;
  }

  setPaletteByName(palette: string, immediately = true): void {
    this.setPalette(Palette.clone(State._game.getMod()?.getPalette(palette) || Palette.createDefault()), 0, 256, immediately);
  }

  resize(dX: { value: number }, dY: { value: number }): void {
    this.recenter(dX.value, dY.value);
  }

  recenter(dX: number, dY: number): void {
    for (const surface of this._surfaces) {
      surface.setX(surface.getX() + Math.trunc(dX / 2));
      surface.setY(surface.getY() + Math.trunc(dY / 2));
    }
  }

  protected game(): Game {
    return State._game;
  }

  private paletteForInterface(palette: string, backPal: number): PaletteColor[] {
    const mod = State._game.getMod();
    const colors = Palette.clone(mod?.getPalette(palette) || Palette.createDefault());
    const backpals = mod?.getPalette("BACKPALS.DAT");
    if (backPal !== -1 && backpals) {
      const source = Palette.blockOffset(backPal);
      for (let i = 0; i < 16 && source + i < backpals.length; ++i) {
        colors[Palette.backPos + i] = { ...backpals[source + i], a: 255 };
      }
    }
    if (palette === "PAL_BASESCAPE") {
      this._cursorColor = Mod.BASESCAPE_CURSOR;
    } else if (palette === "PAL_UFOPAEDIA") {
      this._cursorColor = Mod.UFOPAEDIA_CURSOR;
    } else if (palette === "PAL_GRAPHS") {
      this._cursorColor = Mod.GRAPHS_CURSOR;
    } else if (palette === "PAL_BATTLESCAPE") {
      this._cursorColor = Mod.BATTLESCAPE_CURSOR;
    } else {
      this._cursorColor = Mod.GEOSCAPE_CURSOR;
    }
    return colors;
  }
}
