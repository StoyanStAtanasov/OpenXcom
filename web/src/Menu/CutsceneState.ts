import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { fileExists } from "../Engine/CrossPlatform.ts";
import { getFilePath } from "../Engine/FileMap.ts";
import type { RuleVideo } from "../Mod/RuleVideo.ts";
import { GoToMainMenuState } from "./MainMenuState.ts";
import { SlideshowState } from "./SlideshowState.ts";
import { StatisticsState } from "./StatisticsState.ts";
import { VideoState } from "./VideoState.ts";

export class CutsceneState extends State {
  static WIN_GAME = "winGame";
  static LOSE_GAME = "loseGame";

  constructor(private _cutsceneId: string) {
    super();
  }

  override init(): void {
    super.init();
    this.game().popState();
    if (this._cutsceneId === CutsceneState.WIN_GAME || this._cutsceneId === CutsceneState.LOSE_GAME) {
      if ((this.game().getSavedGame()?.getMonthsPassed?.() ?? -1) > -1) {
        this.game().setState(new StatisticsState());
      } else {
        this.game().setSavedGame(null);
        this.game().setState(new GoToMainMenuState());
      }
    }
    const videoRule = (this.game().getMod() as { getVideo?: (id: string) => RuleVideo | null } | null)?.getVideo?.(this._cutsceneId);
    if (!videoRule) {
      return;
    }
    let fmv = false;
    let slide = false;
    if (videoRule.getVideos().length > 0) {
      fmv = fileExists(getFilePath(videoRule.getVideos()[0]));
    }
    if (videoRule.getSlides().length > 0) {
      slide = fileExists(getFilePath(videoRule.getSlides()[0].imagePath));
    }
    if (fmv && (!slide || Options.preferredVideo === 0)) {
      this.game().pushState(new VideoState(videoRule.getVideos(), videoRule.getAudioTracks(), videoRule.useUfoAudioSequence()));
    } else if (slide && (!fmv || Options.preferredVideo === 1)) {
      this.game().pushState(new SlideshowState(videoRule.getSlideshowHeader(), videoRule.getSlides()));
    } else {
      console.warn(`cutscene definition empty: ${this._cutsceneId}`);
    }
  }

  static initDisplay(): boolean {
    const letterboxed = Options.keepAspectRatio;
    Options.keepAspectRatio = true;
    Options.baseXResolution = Screen.ORIGINAL_WIDTH;
    Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
    CutsceneState._game.getScreen().resetDisplay();
    return letterboxed;
  }

  static resetDisplay(wasLetterboxed: boolean): void {
    Options.keepAspectRatio = wasLetterboxed;
    const width = { value: Options.baseXGeoscape };
    const height = { value: Options.baseYGeoscape };
    Screen.updateScale(Options.geoscapeScale, width, height, true);
    Options.baseXGeoscape = width.value;
    Options.baseYGeoscape = height.value;
    CutsceneState._game.getScreen().resetDisplay();
  }
}
