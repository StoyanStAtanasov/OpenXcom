import { Options } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text } from "../Interface/Text.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { OPT_MENU, OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

const SDL_MIX_MAXVOLUME = 128;

export class OptionsAudioState extends OptionsBaseState {
  private _txtMusicVolume: Text;
  private _txtSoundVolume: Text;
  private _txtUiVolume: Text;
  private _slrMusicVolume: Slider;
  private _slrSoundVolume: Slider;
  private _slrUiVolume: Slider;
  private _txtMusicFormat: Text;
  private _txtCurrentMusic: Text;
  private _txtSoundFormat: Text;
  private _txtCurrentSound: Text;
  private _txtVideoFormat: Text;
  private _cbxMusicFormat: ComboBox;
  private _cbxSoundFormat: ComboBox;
  private _cbxVideoFormat: ComboBox;
  private _txtOptions: Text;
  private _btnBackgroundMute: ToggleTextButton;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnAudio);

    this._txtMusicVolume = new Text(114, 9, 94, 8);
    this._slrMusicVolume = new Slider(104, 16, 94, 18);
    this._txtSoundVolume = new Text(114, 9, 94, 40);
    this._slrSoundVolume = new Slider(104, 16, 94, 50);
    this._txtUiVolume = new Text(114, 9, 94, 72);
    this._slrUiVolume = new Slider(104, 16, 94, 82);
    this._txtMusicFormat = new Text(114, 9, 206, 40);
    this._cbxMusicFormat = new ComboBox(this, 104, 16, 206, 50);
    this._txtCurrentMusic = new Text(114, 9, 206, 68);
    this._txtSoundFormat = new Text(114, 9, 206, 82);
    this._cbxSoundFormat = new ComboBox(this, 104, 16, 206, 92);
    this._txtCurrentSound = new Text(114, 9, 206, 110);
    this._txtVideoFormat = new Text(114, 9, 206, 8);
    this._cbxVideoFormat = new ComboBox(this, 104, 16, 206, 18);
    this._txtOptions = new Text(114, 9, 94, 104);
    this._btnBackgroundMute = new ToggleTextButton(104, 16, 94, 114);

    for (const surface of [
      this._txtMusicVolume, this._slrMusicVolume, this._txtSoundVolume, this._slrSoundVolume,
      this._txtUiVolume, this._slrUiVolume, this._txtVideoFormat, this._txtMusicFormat,
      this._txtCurrentMusic, this._txtSoundFormat, this._txtCurrentSound, this._cbxSoundFormat,
      this._cbxMusicFormat, this._cbxVideoFormat, this._txtOptions, this._btnBackgroundMute
    ]) {
      this.add(surface, surface instanceof Text ? "text" : "button", "audioMenu");
    }
    this.centerAllSurfaces();

    this._txtMusicVolume.setText(String(this.tr("STR_MUSIC_VOLUME")));
    this.setupSlider(this._slrMusicVolume, 0, SDL_MIX_MAXVOLUME, Options.musicVolume, "STR_MUSIC_VOLUME_DESC", this.slrMusicVolumeChange.bind(this));
    this._txtSoundVolume.setText(String(this.tr("STR_SFX_VOLUME")));
    this.setupSlider(this._slrSoundVolume, 0, SDL_MIX_MAXVOLUME, Options.soundVolume, "STR_SFX_VOLUME_DESC", this.slrSoundVolumeChange.bind(this));
    this._slrSoundVolume.onMouseRelease(this.slrSoundVolumeRelease.bind(this));
    this._txtUiVolume.setText(String(this.tr("STR_UI_VOLUME")));
    this.setupSlider(this._slrUiVolume, 0, SDL_MIX_MAXVOLUME, Options.uiVolume, "STR_UI_VOLUME_DESC", this.slrUiVolumeChange.bind(this));
    this._slrUiVolume.onMouseRelease(this.slrUiVolumeRelease.bind(this));

    this._txtMusicFormat.setText(String(this.tr("STR_PREFERRED_MUSIC_FORMAT")));
    this._cbxMusicFormat.setOptions([String(this.tr("STR_PREFERRED_FORMAT_AUTO")), "FLAC", "OGG", "MP3", "MOD", "WAV", "Adlib", "GM", "MIDI"]);
    this._cbxMusicFormat.setSelected(Number(Options.preferredMusic) || 0);
    this.setupCombo(this._cbxMusicFormat, "STR_PREFERRED_MUSIC_FORMAT_DESC", this.cbxMusicFormatChange.bind(this));
    this._txtCurrentMusic.setText(String(this.tr("STR_CURRENT_FORMAT")).replace("{0}", "browser"));

    this._txtSoundFormat.setText(String(this.tr("STR_PREFERRED_SFX_FORMAT")));
    this._cbxSoundFormat.setOptions([String(this.tr("STR_PREFERRED_FORMAT_AUTO")), "1.4", "1.0"]);
    this._cbxSoundFormat.setSelected(Options.preferredSound);
    this.setupCombo(this._cbxSoundFormat, "STR_PREFERRED_SFX_FORMAT_DESC", this.cbxSoundFormatChange.bind(this));
    this._txtCurrentSound.setText(String(this.tr("STR_CURRENT_FORMAT")).replace("{0}", "browser"));

    this._txtVideoFormat.setText(String(this.tr("STR_PREFERRED_VIDEO_FORMAT")));
    this._cbxVideoFormat.setOptions([String(this.tr("STR_PREFERRED_VIDEO_ANIMATION")), String(this.tr("STR_PREFERRED_VIDEO_SLIDESHOW"))]);
    this._cbxVideoFormat.setSelected(Options.preferredVideo);
    this.setupCombo(this._cbxVideoFormat, "STR_PREFERRED_VIDEO_FORMAT_DESC", this.cbxVideoFormatChange.bind(this));
    this._txtMusicFormat.setVisible(origin === OPT_MENU);
    this._cbxMusicFormat.setVisible(origin === OPT_MENU);
    this._txtCurrentMusic.setVisible(origin === OPT_MENU);
    this._txtSoundFormat.setVisible(origin === OPT_MENU);
    this._cbxSoundFormat.setVisible(origin === OPT_MENU);
    this._txtCurrentSound.setVisible(origin === OPT_MENU);

    this._txtOptions.setText(String(this.tr("STR_SOUND_OPTIONS")));
    this._btnBackgroundMute.setText(String(this.tr("STR_BACKGROUND_MUTE")));
    this._btnBackgroundMute.setPressed(Options.backgroundMute);
    this._btnBackgroundMute.onMouseClick(this.btnBackgroundMuteClick.bind(this));
    this._btnBackgroundMute.setTooltip("STR_BACKGROUND_MUTE_DESC");
    this._btnBackgroundMute.onMouseIn(this.txtTooltipIn.bind(this));
    this._btnBackgroundMute.onMouseOut(this.txtTooltipOut.bind(this));
  }

  slrMusicVolumeChange(_action?: Action): void {
    Options.musicVolume = this._slrMusicVolume.getValue();
    this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
  }

  slrSoundVolumeChange(_action?: Action): void {
    Options.soundVolume = this._slrSoundVolume.getValue();
    this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
  }

  slrSoundVolumeRelease(_action?: Action): void {}

  slrUiVolumeChange(_action?: Action): void {
    Options.uiVolume = this._slrUiVolume.getValue();
    this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
  }

  slrUiVolumeRelease(_action?: Action): void {}

  cbxVideoFormatChange(_action?: Action): void {
    Options.preferredVideo = this._cbxVideoFormat.getSelected();
  }

  cbxMusicFormatChange(_action?: Action): void {
    Options.preferredMusic = this._cbxMusicFormat.getSelected() as never;
    Options.reload = true;
  }

  cbxSoundFormatChange(_action?: Action): void {
    Options.preferredSound = this._cbxSoundFormat.getSelected();
    Options.reload = true;
  }

  btnBackgroundMuteClick(_action?: Action): void {
    Options.backgroundMute = this._btnBackgroundMute.getPressed();
  }

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
}
