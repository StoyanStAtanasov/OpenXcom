import { Options } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text } from "../Interface/Text.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsGeoscapeState extends OptionsBaseState {
  private _txtDragScroll: Text;
  private _cbxDragScroll: ComboBox;
  private _txtScrollSpeed: Text;
  private _slrScrollSpeed: Slider;
  private _txtDogfightSpeed: Text;
  private _slrDogfightSpeed: Slider;
  private _txtClockSpeed: Text;
  private _slrClockSpeed: Slider;
  private _txtGlobeDetails: Text;
  private _btnGlobeCountries: ToggleTextButton;
  private _btnGlobeRadars: ToggleTextButton;
  private _btnGlobePaths: ToggleTextButton;
  private _txtOptions: Text;
  private _btnShowFunds: ToggleTextButton;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnGeoscape);
    this._txtDragScroll = new Text(114, 9, 206, 8);
    this._cbxDragScroll = new ComboBox(this, 104, 16, 206, 18);
    this._txtScrollSpeed = new Text(114, 9, 94, 8);
    this._slrScrollSpeed = new Slider(104, 16, 94, 18);
    this._txtDogfightSpeed = new Text(114, 9, 206, 40);
    this._slrDogfightSpeed = new Slider(104, 16, 206, 50);
    this._txtClockSpeed = new Text(114, 9, 94, 40);
    this._slrClockSpeed = new Slider(104, 16, 94, 50);
    this._txtGlobeDetails = new Text(114, 9, 94, 82);
    this._btnGlobeCountries = new ToggleTextButton(104, 16, 94, 92);
    this._btnGlobeRadars = new ToggleTextButton(104, 16, 94, 110);
    this._btnGlobePaths = new ToggleTextButton(104, 16, 94, 128);
    this._txtOptions = new Text(114, 9, 206, 82);
    this._btnShowFunds = new ToggleTextButton(104, 16, 206, 92);

    for (const surface of [this._txtScrollSpeed, this._txtDogfightSpeed, this._txtClockSpeed, this._txtGlobeDetails, this._txtOptions, this._txtDragScroll]) {
      this.add(surface, "text", "geoscapeMenu");
    }
    for (const surface of [this._slrScrollSpeed, this._slrDogfightSpeed, this._slrClockSpeed, this._btnGlobeCountries, this._btnGlobeRadars, this._btnGlobePaths, this._btnShowFunds, this._cbxDragScroll]) {
      this.add(surface, "button", "geoscapeMenu");
    }
    this.centerAllSurfaces();

    this._txtDragScroll.setText(String(this.tr("STR_DRAG_SCROLL")));
    this._cbxDragScroll.setOptions([String(this.tr("STR_DISABLED")), String(this.tr("STR_LEFT_MOUSE_BUTTON")), String(this.tr("STR_MIDDLE_MOUSE_BUTTON")), String(this.tr("STR_RIGHT_MOUSE_BUTTON"))]);
    this._cbxDragScroll.setSelected(Options.geoDragScrollButton);
    this.setupCombo(this._cbxDragScroll, "STR_DRAG_SCROLL_DESC", this.cbxDragScrollChange.bind(this));

    this._txtScrollSpeed.setText(String(this.tr("STR_SCROLL_SPEED")));
    this.setupSlider(this._slrScrollSpeed, 10, 100, Options.geoScrollSpeed, "STR_SCROLL_SPEED_GEO_DESC", this.slrScrollSpeedChange.bind(this));
    this._txtDogfightSpeed.setText(String(this.tr("STR_DOGFIGHT_SPEED")));
    this.setupSlider(this._slrDogfightSpeed, 20, 50, Options.dogfightSpeed, "STR_DOGFIGHT_SPEED_DESC", this.slrDogfightSpeedChange.bind(this));
    this._txtClockSpeed.setText(String(this.tr("STR_CLOCK_SPEED")));
    this.setupSlider(this._slrClockSpeed, 10, 250, Options.geoClockSpeed, "STR_CLOCK_SPEED_DESC", this.slrClockSpeedChange.bind(this));

    this._txtGlobeDetails.setText(String(this.tr("STR_GLOBE_DETAILS")));
    this.setupToggle(this._btnGlobeCountries, "STR_GLOBE_COUNTRIES", Options.globeDetail, "STR_GLOBE_COUNTRIES_DESC", this.btnGlobeCountriesClick.bind(this));
    this.setupToggle(this._btnGlobeRadars, "STR_GLOBE_RADARS", Options.globeRadarLines, "STR_GLOBE_RADARS_DESC", this.btnGlobeRadarsClick.bind(this));
    this.setupToggle(this._btnGlobePaths, "STR_GLOBE_FLIGHT_PATHS", Options.globeFlightPaths, "STR_GLOBE_FLIGHT_PATHS_DESC", this.btnGlobePathsClick.bind(this));
    this._txtOptions.setText(String(this.tr("STR_USER_INTERFACE_OPTIONS")));
    this.setupToggle(this._btnShowFunds, "STR_SHOW_FUNDS", Options.showFundsOnGeoscape, "STR_SHOW_FUNDS_DESC", this.btnShowFundsClick.bind(this));
  }

  cbxDragScrollChange(_action?: Action): void { Options.geoDragScrollButton = this._cbxDragScroll.getSelected(); }
  slrScrollSpeedChange(_action?: Action): void { Options.geoScrollSpeed = this._slrScrollSpeed.getValue(); }
  slrDogfightSpeedChange(_action?: Action): void { Options.dogfightSpeed = this._slrDogfightSpeed.getValue(); }
  slrClockSpeedChange(_action?: Action): void { Options.geoClockSpeed = this._slrClockSpeed.getValue(); }
  btnGlobeCountriesClick(_action?: Action): void { Options.globeDetail = this._btnGlobeCountries.getPressed(); }
  btnGlobeRadarsClick(_action?: Action): void { Options.globeRadarLines = this._btnGlobeRadars.getPressed(); }
  btnGlobePathsClick(_action?: Action): void { Options.globeFlightPaths = this._btnGlobePaths.getPressed(); }
  btnShowFundsClick(_action?: Action): void { Options.showFundsOnGeoscape = this._btnShowFunds.getPressed(); }

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
