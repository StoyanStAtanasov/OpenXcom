import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options, SCALE_15X, SCALE_2X, SCALE_ORIGINAL, SCALE_SCREEN, SCALE_SCREEN_DIV_2, SCALE_SCREEN_DIV_3 } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import type { Action } from "../Engine/Action.ts";
import { ArrowButton, ARROW_BIG_DOWN, ARROW_BIG_UP } from "../Interface/ArrowButton.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextEdit, TextEditConstraint } from "../Interface/TextEdit.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";
import { SetWindowedRootState } from "./SetWindowedRootState.ts";

type Resolution = { w: number; h: number };

export class OptionsVideoState extends OptionsBaseState {
  private static GL_EXT = "OpenGL.shader";
  private static GL_FOLDER = "Shaders/";
  private static GL_STRING = "*";

  private _displaySurface: InteractiveSurface;
  private _txtDisplayResolution: Text;
  private _txtDisplayX: Text;
  private _txtDisplayWidth: TextEdit;
  private _txtDisplayHeight: TextEdit;
  private _btnDisplayResolutionUp: ArrowButton;
  private _btnDisplayResolutionDown: ArrowButton;
  private _txtLanguage: Text;
  private _txtFilter: Text;
  private _txtGeoScale: Text;
  private _txtBattleScale: Text;
  private _cbxLanguage: ComboBox;
  private _cbxFilter: ComboBox;
  private _cbxDisplayMode: ComboBox;
  private _cbxGeoScale: ComboBox;
  private _cbxBattleScale: ComboBox;
  private _txtMode: Text;
  private _txtOptions: Text;
  private _btnLetterbox: ToggleTextButton;
  private _btnLockMouse: ToggleTextButton;
  private _btnRootWindowedMode: ToggleTextButton;
  private _res: Resolution[] = [];
  private _resAmount = 0;
  private _resCurrent = -1;
  private _langs: string[] = [];
  private _filters: string[] = [];

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnVideo);
    this._displaySurface = new InteractiveSurface(110, 32, 94, 18);
    this._txtDisplayResolution = new Text(114, 9, 94, 8);
    this._txtDisplayWidth = new TextEdit(this, 40, 17, 94, 26);
    this._txtDisplayX = new Text(16, 17, 132, 26);
    this._txtDisplayHeight = new TextEdit(this, 40, 17, 144, 26);
    this._btnDisplayResolutionUp = new ArrowButton(ARROW_BIG_UP, 14, 14, 186, 18);
    this._btnDisplayResolutionDown = new ArrowButton(ARROW_BIG_DOWN, 14, 14, 186, 36);
    this._txtLanguage = new Text(114, 9, 94, 52);
    this._cbxLanguage = new ComboBox(this, 104, 16, 94, 62);
    this._txtFilter = new Text(114, 9, 206, 52);
    this._cbxFilter = new ComboBox(this, 104, 16, 206, 62);
    this._txtMode = new Text(114, 9, 206, 22);
    this._cbxDisplayMode = new ComboBox(this, 104, 16, 206, 32);
    this._txtGeoScale = new Text(114, 9, 94, 82);
    this._cbxGeoScale = new ComboBox(this, 104, 16, 94, 92);
    this._txtBattleScale = new Text(114, 9, 94, 112);
    this._cbxBattleScale = new ComboBox(this, 104, 16, 94, 122);
    this._txtOptions = new Text(114, 9, 206, 82);
    this._btnLetterbox = new ToggleTextButton(104, 16, 206, 92);
    this._btnLockMouse = new ToggleTextButton(104, 16, 206, 110);
    this._btnRootWindowedMode = new ToggleTextButton(104, 16, 206, 128);

    this._res = [
      { w: 1920, h: 1080 },
      { w: 1600, h: 900 },
      { w: 1280, h: 720 },
      { w: 640, h: 400 }
    ];
    this._resAmount = this._res.length;
    this._resCurrent = Math.max(0, this._res.findIndex(res => res.w <= Options.displayWidth));

    this.add(this._displaySurface);
    for (const surface of [this._txtDisplayResolution, this._txtLanguage, this._txtFilter, this._txtMode, this._txtOptions, this._txtBattleScale, this._txtGeoScale]) {
      this.add(surface, "text", "videoMenu");
    }
    this.add(this._txtDisplayWidth, "resolution", "videoMenu");
    this.add(this._txtDisplayX, "resolution", "videoMenu");
    this.add(this._txtDisplayHeight, "resolution", "videoMenu");
    for (const surface of [this._btnDisplayResolutionUp, this._btnDisplayResolutionDown, this._btnLetterbox, this._btnLockMouse, this._btnRootWindowedMode, this._cbxFilter, this._cbxDisplayMode, this._cbxBattleScale, this._cbxGeoScale, this._cbxLanguage]) {
      this.add(surface, "button", "videoMenu");
    }
    this.centerAllSurfaces();

    this._txtDisplayResolution.setText(String(this.tr("STR_DISPLAY_RESOLUTION")));
    this._displaySurface.setTooltip("STR_DISPLAY_RESOLUTION_DESC");
    this._displaySurface.onMouseIn(this.txtTooltipIn.bind(this));
    this._displaySurface.onMouseOut(this.txtTooltipOut.bind(this));
    this._txtDisplayWidth.setAlign(ALIGN_CENTER);
    this._txtDisplayWidth.setBig();
    this._txtDisplayWidth.setConstraint(TextEditConstraint.TEC_NUMERIC_POSITIVE);
    this._txtDisplayWidth.onChange(this.txtDisplayWidthChange.bind(this));
    this._txtDisplayX.setAlign(ALIGN_CENTER);
    this._txtDisplayX.setBig();
    this._txtDisplayX.setText("x");
    this._txtDisplayHeight.setAlign(ALIGN_CENTER);
    this._txtDisplayHeight.setBig();
    this._txtDisplayHeight.setConstraint(TextEditConstraint.TEC_NUMERIC_POSITIVE);
    this._txtDisplayHeight.onChange(this.txtDisplayHeightChange.bind(this));
    this._txtDisplayWidth.setText(String(Options.displayWidth));
    this._txtDisplayHeight.setText(String(Options.displayHeight));
    this._btnDisplayResolutionUp.onMouseClick(this.btnDisplayResolutionUpClick.bind(this));
    this._btnDisplayResolutionDown.onMouseClick(this.btnDisplayResolutionDownClick.bind(this));

    this._txtMode.setText(String(this.tr("STR_DISPLAY_MODE")));
    this._txtOptions.setText(String(this.tr("STR_DISPLAY_OPTIONS")));
    this.setupToggle(this._btnLetterbox, "STR_LETTERBOXED", Options.keepAspectRatio, "STR_LETTERBOXED_DESC", this.btnLetterboxClick.bind(this));
    this.setupToggle(this._btnLockMouse, "STR_LOCK_MOUSE", Options.captureMouse, "STR_LOCK_MOUSE_DESC", this.btnLockMouseClick.bind(this));
    this.setupToggle(this._btnRootWindowedMode, "STR_FIXED_WINDOW_POSITION", Options.rootWindowedMode, "STR_FIXED_WINDOW_POSITION_DESC", this.btnRootWindowedModeClick.bind(this));

    this._txtLanguage.setText(String(this.tr("STR_DISPLAY_LANGUAGE")));
    this._langs = [Options.language || "en-US"];
    this._cbxLanguage.setOptions(this._langs);
    this._cbxLanguage.setSelected(0);
    this.setupCombo(this._cbxLanguage, "STR_DISPLAY_LANGUAGE_DESC", this.cbxLanguageChange.bind(this));

    this._txtFilter.setText(String(this.tr("STR_DISPLAY_FILTER")));
    this._filters = ["", "", "", ""];
    this._cbxFilter.setOptions([String(this.tr("STR_DISABLED")), "Scale", "HQx", "xBRZ"]);
    this._cbxFilter.setSelected(Options.useScaleFilter ? 1 : Options.useHQXFilter ? 2 : Options.useXBRZFilter ? 3 : 0);
    this.setupCombo(this._cbxFilter, "STR_DISPLAY_FILTER_DESC", this.cbxFilterChange.bind(this));

    this._cbxDisplayMode.setOptions([String(this.tr("STR_WINDOWED")), String(this.tr("STR_FULLSCREEN")), String(this.tr("STR_BORDERLESS")), String(this.tr("STR_RESIZABLE"))]);
    this._cbxDisplayMode.setSelected(Options.fullscreen ? 1 : Options.borderless ? 2 : Options.allowResize ? 3 : 0);
    this.setupCombo(this._cbxDisplayMode, "STR_DISPLAY_MODE_DESC", this.updateDisplayMode.bind(this));

    const scales = [String(this.tr("STR_ORIGINAL")), String(this.tr("STR_1_5X")), String(this.tr("STR_2X")), String(this.tr("STR_THIRD_DISPLAY")), String(this.tr("STR_HALF_DISPLAY")), String(this.tr("STR_FULL_DISPLAY"))];
    this._txtGeoScale.setText(String(this.tr("STR_GEOSCAPE_SCALE")));
    this._cbxGeoScale.setOptions(scales);
    this._cbxGeoScale.setSelected(Options.geoscapeScale);
    this.setupCombo(this._cbxGeoScale, "STR_GEOSCAPESCALE_SCALE_DESC", this.updateGeoscapeScale.bind(this));
    this._txtBattleScale.setText(String(this.tr("STR_BATTLESCAPE_SCALE")));
    this._cbxBattleScale.setOptions(scales);
    this._cbxBattleScale.setSelected(Options.battlescapeScale);
    this.setupCombo(this._cbxBattleScale, "STR_BATTLESCAPE_SCALE_DESC", this.updateBattlescapeScale.bind(this));
  }

  ucWords(str: string): string {
    return str.replace(/(^|[ _-])(\w)/g, (_m, sep: string, ch: string) => `${sep === "_" || sep === "-" ? " " : sep}${ch.toUpperCase()}`);
  }

  btnDisplayResolutionUpClick(_action?: Action): void {
    if (this._resAmount === 0) return;
    this._resCurrent = this._resCurrent <= 0 ? this._resAmount - 1 : this._resCurrent - 1;
    this.updateDisplayResolution();
  }

  btnDisplayResolutionDownClick(_action?: Action): void {
    if (this._resAmount === 0) return;
    this._resCurrent = this._resCurrent >= this._resAmount - 1 ? 0 : this._resCurrent + 1;
    this.updateDisplayResolution();
  }

  updateDisplayResolution(): void {
    const res = this._res[this._resCurrent];
    if (!res) return;
    this._txtDisplayWidth.setText(String(res.w));
    this._txtDisplayHeight.setText(String(res.h));
    Options.newDisplayWidth = res.w;
    Options.newDisplayHeight = res.h;
  }

  txtDisplayWidthChange(_action?: Action): void {
    Options.newDisplayWidth = Number.parseInt(this._txtDisplayWidth.getText(), 10) || 0;
    this.updateResolutionIndex();
  }

  txtDisplayHeightChange(_action?: Action): void {
    Options.newDisplayHeight = Number.parseInt(this._txtDisplayHeight.getText(), 10) || 0;
    this.updateResolutionIndex();
  }

  cbxLanguageChange(_action?: Action): void {
    Options.language = this._langs[this._cbxLanguage.getSelected()] || Options.language;
  }

  cbxFilterChange(_action?: Action): void {
    Options.newOpenGL = false;
    Options.newScaleFilter = this._cbxFilter.getSelected() === 1;
    Options.newHQXFilter = this._cbxFilter.getSelected() === 2;
    Options.newXBRZFilter = this._cbxFilter.getSelected() === 3;
    Options.newOpenGLShader = this._filters[this._cbxFilter.getSelected()] || "";
  }

  updateDisplayMode(_action?: Action): void {
    Options.newFullscreen = this._cbxDisplayMode.getSelected() === 1;
    Options.newBorderless = this._cbxDisplayMode.getSelected() === 2;
    Options.newAllowResize = this._cbxDisplayMode.getSelected() === 3;
  }

  btnLetterboxClick(_action?: Action): void { Options.keepAspectRatio = this._btnLetterbox.getPressed(); }
  btnLockMouseClick(_action?: Action): void { Options.captureMouse = this._btnLockMouse.getPressed(); }

  btnRootWindowedModeClick(_action?: Action): void {
    if (this._btnRootWindowedMode.getPressed()) {
      this.game().pushState(new SetWindowedRootState(this._origin, this));
    } else {
      Options.newRootWindowedMode = false;
    }
  }

  updateGeoscapeScale(_action?: Action): void {
    Options.newGeoscapeScale = this.scaleFromSelected(this._cbxGeoScale.getSelected());
  }

  updateBattlescapeScale(_action?: Action): void {
    Options.newBattlescapeScale = this.scaleFromSelected(this._cbxBattleScale.getSelected());
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    super.resize(dX, dY);
    this._txtDisplayWidth.setText(String(Options.displayWidth));
    this._txtDisplayHeight.setText(String(Options.displayHeight));
  }

  override handle(action: Action): void {
    super.handle(action);
    if (action.getDetails().type === "SDL_KEYDOWN" && action.getDetails().key?.keysym.sym === "g") {
      this._btnLockMouse.setPressed(Options.captureMouse);
    }
  }

  unpressRootWindowedMode(): void {
    this._btnRootWindowedMode.setPressed(false);
  }

  private updateResolutionIndex(): void {
    this._resCurrent = this._res.findIndex(res => res.w <= Options.newDisplayWidth && res.h <= Options.newDisplayHeight);
  }

  private scaleFromSelected(selected: number): number {
    return [SCALE_ORIGINAL, SCALE_15X, SCALE_2X, SCALE_SCREEN_DIV_3, SCALE_SCREEN_DIV_2, SCALE_SCREEN][selected] ?? SCALE_2X;
  }

  private setupCombo(combo: ComboBox, tooltip: string, handler: (action: Action) => void): void {
    combo.onChange(handler);
    combo.setTooltip(tooltip);
    combo.onMouseIn(this.txtTooltipIn.bind(this));
    combo.onMouseOut(this.txtTooltipOut.bind(this));
  }

  private setupToggle(button: ToggleTextButton, text: string, pressed: boolean, tooltip: string, handler: (action: Action) => void): void {
    button.setText(String(this.tr(text)));
    button.setPressed(pressed);
    button.onMouseClick(handler);
    button.setTooltip(tooltip);
    button.onMouseIn(this.txtTooltipIn.bind(this));
    button.onMouseOut(this.txtTooltipOut.bind(this));
  }
}
