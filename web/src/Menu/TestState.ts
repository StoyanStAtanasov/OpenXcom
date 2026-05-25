import { Palette } from "../Engine/Palette.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Slider } from "../Interface/Slider.ts";
import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";

export class TestState extends State {
  private _set: { getFrame?: (index: number) => Surface | null } | null;
  private _button: TextButton;
  private _window: Window;
  private _text: Text;
  private _number: Text;
  private _list: TextList;
  private _slider: Slider;
  private _comboBox: ComboBox;
  private _i = 0;

  constructor() {
    super();
    this._window = new Window(this, 300, 180, 10, 10);
    this._text = new Text(280, 120, 20, 50);
    this._button = new TextButton(100, 20, 110, 150);
    this._list = new TextList(300, 180, 10, 10);
    this._number = new Text(50, 5, 200, 25);
    this._set = this.game().getMod()?.getSurfaceSet("BASEBITS.PCK") || null;
    this._slider = new Slider(100, 15, 50, 50);
    this._comboBox = new ComboBox(this, 80, 16, 98, 100);
    this.setPaletteByName("PAL_BASESCAPE");
    this.add(this._window);
    this.add(this._button);
    this.add(this._text);
    this.add(this._list);
    this.add(this._number);
    this.add(this._slider);
    this.add(this._comboBox);
    this.centerAllSurfaces();
    this._window.setColor(Palette.blockOffset(15) + 1);
    const back04 = this.game().getMod()?.getSurface("BACK04.SCR");
    if (back04) this._window.setBackground(back04);
    this._button.setColor(Palette.blockOffset(15) + 1);
    this._button.setText("LOLOLOL");
    this._text.setColor(Palette.blockOffset(15) + 1);
    this._text.setWordWrap(true);
    this._text.setAlign(ALIGN_CENTER);
    this._text.setVerticalAlign(ALIGN_MIDDLE);
    this._list.setColor(Palette.blockOffset(15) + 1);
    this._list.setColumns(3, 100, 50, 100);
    this._list.addRow(2, "a", "b");
    this._list.addRow(3, "lol", "welp", "yo");
    this._list.addRow(1, "0123456789");
    this._number.setColor(Palette.blockOffset(15) + 1);
    this._number.setText("1234567890");
    this._slider.setColor(Palette.blockOffset(15) + 1);
    const difficulty: string[] = [];
    for (let i = 0; i !== 3; ++i) {
      difficulty.push(String(this.tr("STR_1_BEGINNER")), String(this.tr("STR_2_EXPERIENCED")), String(this.tr("STR_3_VETERAN")), String(this.tr("STR_4_GENIUS")), String(this.tr("STR_5_SUPERHUMAN")));
    }
    this._comboBox.setColor(Palette.blockOffset(15) + 1);
    this._comboBox.setOptions(difficulty);
  }

  override think(): void {
    super.think();
    this._i++;
  }

  override blit(): void {
    super.blit();
    this._set?.getFrame?.(0)?.blit(this.game().getScreen().getSurface());
  }

  testSurface(): Surface {
    const surface = new Surface(256, 25);
    for (let y = 0; y < 25; ++y) {
      for (let x = 0; x < 256; ++x) {
        surface.setPixel(x, y, x);
      }
    }
    return surface;
  }
}
