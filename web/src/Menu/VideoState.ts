import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { CutsceneState } from "./CutsceneState.ts";

export class VideoState extends State {
  constructor(private _videos: string[], private _tracks: string[], private _useUfoAudioSequence: boolean) {
    super();
  }

  override init(): void {
    super.init();
    const wasLetterboxed = CutsceneState.initDisplay();
    const prevMusicVol = Options.musicVolume;
    const prevSoundVol = Options.soundVolume;
    if (this._useUfoAudioSequence) {
      Options.musicVolume = Options.soundVolume = Math.max(prevMusicVol, prevSoundVol);
      this.game().setVolume(Options.soundVolume, Options.musicVolume, -1);
    }
    this.game().getCursor().setVisible(false);
    for (let i = 0; i < this._videos.length; ++i) {
      const video = this._videos[i];
      const track = this._tracks[i];
      if (track) {
        this.game().getMod()?.playMusic(track);
      }
      console.log(`FlcPlayer browser boundary: ${video}`);
    }
    this.game().getScreen().clear();
    this.game().getScreen().flip();
    if (this._useUfoAudioSequence) {
      Options.musicVolume = prevMusicVol;
      Options.soundVolume = prevSoundVol;
      this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
    }
    this.game().getCursor().setVisible(true);
    CutsceneState.resetDisplay(wasLetterboxed);
    this.game().popState();
  }
}
