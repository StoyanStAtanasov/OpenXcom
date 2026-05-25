import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsNoAudioState extends OptionsBaseState {
  private _txtError: Text;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnAudio);
    this._txtError = new Text(218, 136, 94, 8);
    this.add(this._txtError, "text", "audioMenu");
    this.centerAllSurfaces();
    this._txtError.setAlign(ALIGN_CENTER);
    this._txtError.setVerticalAlign(ALIGN_MIDDLE);
    this._txtError.setBig();
    this._txtError.setWordWrap(true);
    this._txtError.setText(String(this.tr("STR_NO_AUDIO_HARDWARE_DETECTED")));
  }
}
