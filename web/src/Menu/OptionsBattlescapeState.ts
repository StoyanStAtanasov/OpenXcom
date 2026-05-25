import { Options, PATH_ARROWS, PATH_NONE, PATH_TU_COST } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text } from "../Interface/Text.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsBattlescapeState extends OptionsBaseState {
  private _txtEdgeScroll: Text;
  private _txtDragScroll: Text;
  private _cbxEdgeScroll: ComboBox;
  private _cbxDragScroll: ComboBox;
  private _txtScrollSpeed: Text;
  private _txtFireSpeed: Text;
  private _txtXcomSpeed: Text;
  private _txtAlienSpeed: Text;
  private _slrScrollSpeed: Slider;
  private _slrFireSpeed: Slider;
  private _slrXcomSpeed: Slider;
  private _slrAlienSpeed: Slider;
  private _txtPathPreview: Text;
  private _btnArrows: ToggleTextButton;
  private _btnTuCost: ToggleTextButton;
  private _txtOptions: Text;
  private _btnTooltips: ToggleTextButton;
  private _btnDeaths: ToggleTextButton;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnBattlescape);
    this._txtEdgeScroll = new Text(114, 9, 94, 8);
    this._cbxEdgeScroll = new ComboBox(this, 104, 16, 94, 18);
    this._txtDragScroll = new Text(114, 9, 206, 8);
    this._cbxDragScroll = new ComboBox(this, 104, 16, 206, 18);
    this._txtScrollSpeed = new Text(114, 9, 94, 40);
    this._slrScrollSpeed = new Slider(104, 16, 94, 50);
    this._txtFireSpeed = new Text(114, 9, 206, 40);
    this._slrFireSpeed = new Slider(104, 16, 206, 50);
    this._txtXcomSpeed = new Text(114, 9, 94, 72);
    this._slrXcomSpeed = new Slider(104, 16, 94, 82);
    this._txtAlienSpeed = new Text(114, 9, 206, 72);
    this._slrAlienSpeed = new Slider(104, 16, 206, 82);
    this._txtPathPreview = new Text(114, 9, 94, 100);
    this._btnArrows = new ToggleTextButton(104, 16, 94, 110);
    this._btnTuCost = new ToggleTextButton(104, 16, 94, 128);
    this._txtOptions = new Text(114, 9, 206, 100);
    this._btnTooltips = new ToggleTextButton(104, 16, 206, 110);
    this._btnDeaths = new ToggleTextButton(104, 16, 206, 128);

    for (const surface of [this._txtEdgeScroll, this._txtDragScroll, this._txtScrollSpeed, this._txtFireSpeed, this._txtXcomSpeed, this._txtAlienSpeed, this._txtPathPreview, this._txtOptions]) {
      this.add(surface, "text", "battlescapeMenu");
    }
    for (const surface of [this._slrScrollSpeed, this._slrFireSpeed, this._slrXcomSpeed, this._slrAlienSpeed, this._btnArrows, this._btnTuCost, this._btnTooltips, this._btnDeaths, this._cbxEdgeScroll, this._cbxDragScroll]) {
      this.add(surface, "button", "battlescapeMenu");
    }
    this.centerAllSurfaces();

    this._txtEdgeScroll.setText(String(this.tr("STR_EDGE_SCROLL")));
    this._cbxEdgeScroll.setOptions([String(this.tr("STR_DISABLED")), String(this.tr("STR_TRIGGER_SCROLL")), String(this.tr("STR_AUTO_SCROLL"))]);
    this._cbxEdgeScroll.setSelected(Options.battleEdgeScroll);
    this.setupCombo(this._cbxEdgeScroll, "STR_EDGE_SCROLL_DESC", this.cbxEdgeScrollChange.bind(this));
    this._txtDragScroll.setText(String(this.tr("STR_DRAG_SCROLL")));
    this._cbxDragScroll.setOptions([String(this.tr("STR_DISABLED")), String(this.tr("STR_LEFT_MOUSE_BUTTON")), String(this.tr("STR_MIDDLE_MOUSE_BUTTON")), String(this.tr("STR_RIGHT_MOUSE_BUTTON"))]);
    this._cbxDragScroll.setSelected(Options.battleDragScrollButton);
    this.setupCombo(this._cbxDragScroll, "STR_DRAG_SCROLL_DESC", this.cbxDragScrollChange.bind(this));
    this._txtScrollSpeed.setText(String(this.tr("STR_SCROLL_SPEED")));
    this.setupSlider(this._slrScrollSpeed, 2, 20, Options.battleScrollSpeed, "STR_SCROLL_SPEED_BATTLE_DESC", this.slrScrollSpeedChange.bind(this));
    this._txtFireSpeed.setText(String(this.tr("STR_FIRE_SPEED")));
    this.setupSlider(this._slrFireSpeed, 1, 20, Options.battleFireSpeed, "STR_FIRE_SPEED_DESC", this.slrFireSpeedChange.bind(this));
    this._txtXcomSpeed.setText(String(this.tr("STR_PLAYER_MOVEMENT_SPEED")));
    this.setupSlider(this._slrXcomSpeed, 1, 40, Options.battleXcomSpeed, "STR_PLAYER_MOVEMENT_SPEED_DESC", this.slrXcomSpeedChange.bind(this));
    this._txtAlienSpeed.setText(String(this.tr("STR_COMPUTER_MOVEMENT_SPEED")));
    this.setupSlider(this._slrAlienSpeed, 1, 40, Options.battleAlienSpeed, "STR_COMPUTER_MOVEMENT_SPEED_DESC", this.slrAlienSpeedChange.bind(this));
    this._txtPathPreview.setText(String(this.tr("STR_PATH_PREVIEW")));
    this.setupToggle(this._btnArrows, "STR_PATH_ARROWS", (Options.battleNewPreviewPath & PATH_ARROWS) !== 0, "STR_PATH_ARROWS_DESC", this.btnPathPreviewClick.bind(this));
    this.setupToggle(this._btnTuCost, "STR_PATH_TIME_UNIT_COST", (Options.battleNewPreviewPath & PATH_TU_COST) !== 0, "STR_PATH_TIME_UNIT_COST_DESC", this.btnPathPreviewClick.bind(this));
    this._txtOptions.setText(String(this.tr("STR_USER_INTERFACE_OPTIONS")));
    this.setupToggle(this._btnTooltips, "STR_TOOLTIPS", (Options as any).battleTooltips ?? true, "STR_TOOLTIPS_DESC", this.btnTooltipsClick.bind(this));
    this.setupToggle(this._btnDeaths, "STR_DEATH_NOTIFICATIONS", Options.battleNotifyDeath, "STR_DEATH_NOTIFICATIONS_DESC", this.btnDeathsClick.bind(this));
  }

  cbxEdgeScrollChange(_action?: Action): void { Options.battleEdgeScroll = this._cbxEdgeScroll.getSelected(); }
  cbxDragScrollChange(_action?: Action): void { Options.battleDragScrollButton = this._cbxDragScroll.getSelected(); }
  slrScrollSpeedChange(_action?: Action): void { Options.battleScrollSpeed = this._slrScrollSpeed.getValue(); }
  slrFireSpeedChange(_action?: Action): void { Options.battleFireSpeed = this._slrFireSpeed.getValue(); }
  slrXcomSpeedChange(_action?: Action): void { Options.battleXcomSpeed = this._slrXcomSpeed.getValue(); }
  slrAlienSpeedChange(_action?: Action): void { Options.battleAlienSpeed = this._slrAlienSpeed.getValue(); }
  btnPathPreviewClick(_action?: Action): void {
    let mode = PATH_NONE;
    if (this._btnArrows.getPressed()) mode |= PATH_ARROWS;
    if (this._btnTuCost.getPressed()) mode |= PATH_TU_COST;
    Options.battleNewPreviewPath = mode;
  }
  btnTooltipsClick(_action?: Action): void { (Options as any).battleTooltips = this._btnTooltips.getPressed(); }
  btnDeathsClick(_action?: Action): void { Options.battleNotifyDeath = this._btnDeaths.getPressed(); }

  private setupSlider(slider: Slider, min: number, max: number, value: number, tooltip: string, handler: (action: Action) => void): void {
    slider.setRange(min, max);
    slider.setValue(value);
    slider.onChange(handler);
    slider.setTooltip(tooltip);
    slider.onMouseIn(this.txtTooltipIn.bind(this));
    slider.onMouseOut(this.txtTooltipOut.bind(this));
  }

  private setupCombo(combo: ComboBox, tooltip: string, handler: (action: Action) => void): void {
    combo.setTooltip(tooltip);
    combo.onChange(handler);
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
