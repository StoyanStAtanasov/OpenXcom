import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import type { SlideshowHeader, SlideshowSlide } from "../Mod/RuleVideo.ts";
import { CutsceneState } from "./CutsceneState.ts";

export class SlideshowState extends State {
  private _wasLetterboxed: boolean;
  private _slides: InteractiveSurface[] = [];
  private _captions: Text[] = [];
  private _curScreen = -1;
  private _transitionTimer: Timer;

  constructor(private _slideshowHeader: SlideshowHeader, private _slideshowSlides: SlideshowSlide[]) {
    super();
    this._wasLetterboxed = CutsceneState.initDisplay();
    for (const rule of this._slideshowSlides) {
      const slide = new InteractiveSurface(Screen.ORIGINAL_WIDTH, Screen.ORIGINAL_HEIGHT, 0, 0);
      void slide.loadImage(`${Options.assetBase}/${rule.imagePath}`);
      slide.onMouseClick(this.screenClick.bind(this));
      slide.onKeyboardPress(this.screenClick.bind(this), Options.keyOk);
      slide.onKeyboardPress(this.screenSkip.bind(this), Options.keyCancel);
      slide.setVisible(false);
      this._slides.push(slide);
      this.add(slide);

      const caption = new Text(rule.w, rule.h, rule.x, rule.y);
      caption.setColor(rule.color);
      caption.setText(String(this.tr(rule.caption)));
      caption.setAlign(String(rule.align));
      caption.setWordWrap(true);
      caption.setVisible(false);
      this._captions.push(caption);
      this.add(caption);
    }
    this.centerAllSurfaces();
    const transitionSeconds = this._slideshowSlides[0]?.transitionSeconds || this._slideshowHeader.transitionSeconds || 30;
    this._transitionTimer = new Timer(transitionSeconds * 1000);
    this._transitionTimer.onTimer(this.screenTimer.bind(this));
    this.game().getMod()?.playMusic(this._slideshowHeader.musicId);
    this.game().getCursor().setVisible(false);
    this.screenClick();
  }

  override think(): void {
    this._transitionTimer.think(this, null);
  }

  screenTimer(): void {
    this.screenClick();
  }

  screenClick(_action?: Action): void {
    if (this._curScreen >= 0) {
      this._slides[this._curScreen]?.setVisible(false);
      this._captions[this._curScreen]?.setVisible(false);
    }
    this._curScreen++;
    if (this._curScreen < this._slideshowSlides.length) {
      const seconds = this._slideshowSlides[this._curScreen].transitionSeconds || this._slideshowHeader.transitionSeconds || 30;
      this._transitionTimer.setInterval(seconds * 1000);
      this._transitionTimer.start();
      this.setPalette(this._slides[this._curScreen].getPalette());
      this._slides[this._curScreen].setVisible(true);
      this._captions[this._curScreen].setVisible(true);
      this.init();
    } else {
      this.screenSkip();
    }
  }

  screenSkip(_action?: Action): void {
    this.game().getCursor().setVisible(true);
    CutsceneState.resetDisplay(this._wasLetterboxed);
    this.game().popState();
  }
}
