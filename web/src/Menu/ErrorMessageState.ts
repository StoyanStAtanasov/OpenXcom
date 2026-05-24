import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { State } from "../Engine/State.ts";
import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import type { PaletteColor } from "../types.ts";

export class ErrorMessageState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtMessage: Text;

  constructor(msg: string, palette: PaletteColor[] | null, color: number, bg: string, bgColor: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 160, 32, 20, POPUP_BOTH);
    this._btnOk = new TextButton(120, 18, 100, 154);
    this._txtMessage = new Text(246, 80, 37, 50);

    if (palette) {
      this.setPalette(palette);
    }
    if (bgColor !== -1) {
      const backpals = this.game().getMod()?.getPalette("BACKPALS.DAT");
      if (backpals) {
        const source = Palette.blockOffset(bgColor);
        this.setPalette(backpals.slice(source, source + 16), Palette.backPos, 16, false);
      }
    }

    this.add(this._window);
    this.add(this._btnOk);
    this.add(this._txtMessage);

    this.centerAllSurfaces();

    this._window.setColor(color);
    const background = this.game().getMod()?.getSurface(bg);
    if (background) {
      this._window.setBackground(background);
    }

    this._btnOk.setColor(color);
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtMessage.setColor(color);
    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setVerticalAlign(ALIGN_MIDDLE);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(msg);

    if (bgColor === -1) {
      this._window.setHighContrast(true);
      this._btnOk.setHighContrast(true);
      this._txtMessage.setHighContrast(true);
    }
  }

  btnOkClick(): void {
    this.game().popState();
  }
}
