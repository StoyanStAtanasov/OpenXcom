import { fileExists } from "../Engine/CrossPlatform.ts";
import { FlcPlayer } from "../Engine/FlcPlayer.ts";
import { getFilePath, getVFolderContents } from "../Engine/FileMap.ts";
import { Music } from "../Engine/Music.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { Sound } from "../Engine/Sound.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import type { Mod } from "../Mod/Mod.ts";
import { SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import { CutsceneState } from "./CutsceneState.ts";

type SoundInFile = [string, number, number];
type IntroSoundEffect = [number, number];

const introCatOnlySounds: SoundInFile[] = [
  ["INTRO.CAT", 0x0, 32],
  ["INTRO.CAT", 0x1, 32],
  ["INTRO.CAT", 0x2, 32],
  ["INTRO.CAT", 0x3, 32],
  ["INTRO.CAT", 0x4, 32],
  ["INTRO.CAT", 0x5, 32],
  ["INTRO.CAT", 0x6, 32],
  ["INTRO.CAT", 0x7, 32],
  ["INTRO.CAT", 0x8, 32],
  ["INTRO.CAT", 0x9, 32],
  ["INTRO.CAT", 0xa, 32],
  ["INTRO.CAT", 0xb, 32],
  ["INTRO.CAT", 0xc, 32],
  ["INTRO.CAT", 0xd, 32],
  ["INTRO.CAT", 0xe, 32],
  ["INTRO.CAT", 0xf, 32],
  ["INTRO.CAT", 0x10, 32],
  ["INTRO.CAT", 0x11, 32],
  ["INTRO.CAT", 0x12, 32],
  ["INTRO.CAT", 0x13, 32],
  ["INTRO.CAT", 0x14, 32],
  ["INTRO.CAT", 0x15, 32],
  ["INTRO.CAT", 0x16, 32],
  ["INTRO.CAT", 0x17, 32],
  ["INTRO.CAT", 0x18, 32],
  ["INTRO.CAT", 0x18, 32]
];

const sample3CatOnlySounds: SoundInFile[] = [
  ["SAMPLE3.CAT", 24, 32],
  ["SAMPLE3.CAT", 5, 32],
  ["SAMPLE3.CAT", 23, 32],
  ["SAMPLE3.CAT", 6, 32],
  ["SAMPLE3.CAT", 9, 64],
  ["SAMPLE3.CAT", 7, 64],
  ["SAMPLE3.CAT", 27, 64],
  ["SAMPLE3.CAT", 4, 32],
  ["SAMPLE3.CAT", 0x8, 32],
  ["SAMPLE3.CAT", 11, 32],
  ["SAMPLE3.CAT", 4, 32],
  ["INTRO.CAT", 0xb, 32],
  ["SAMPLE3.CAT", 19, 48],
  ["INTRO.CAT", 0xd, 32],
  ["SAMPLE3.CAT", 2, 32],
  ["SAMPLE3.CAT", 30, 32],
  ["SAMPLE3.CAT", 21, 32],
  ["SAMPLE3.CAT", 0, 64],
  ["SAMPLE3.CAT", 13, 32],
  ["SAMPLE3.CAT", 14, 32],
  ["SAMPLE3.CAT", 19, 64],
  ["SAMPLE3.CAT", 3, 32],
  ["SAMPLE3.CAT", 15, 128],
  ["SAMPLE3.CAT", 12, 32],
  ["SAMPLE3.CAT", 18, 32],
  ["SAMPLE3.CAT", 20, 32]
];

const hybridIntroSounds: SoundInFile[] = [
  ["SAMPLE3.CAT", 24, 32],
  ["SAMPLE3.CAT", 5, 32],
  ["SAMPLE3.CAT", 23, 32],
  ["INTRO.CAT", 3, 32],
  ["INTRO.CAT", 0x4, 64],
  ["INTRO.CAT", 0x5, 64],
  ["INTRO.CAT", 0x6, 64],
  ["INTRO.CAT", 0x7, 32],
  ["SAMPLE3.CAT", 0x8, 32],
  ["SAMPLE3.CAT", 11, 32],
  ["SAMPLE3.CAT", 4, 32],
  ["INTRO.CAT", 0xb, 32],
  ["SAMPLE3.CAT", 19, 48],
  ["INTRO.CAT", 0xd, 32],
  ["INTRO.CAT", 0xe, 32],
  ["SAMPLE3.CAT", 30, 32],
  ["SAMPLE3.CAT", 21, 32],
  ["INTRO.CAT", 0x11, 64],
  ["SAMPLE3.CAT", 13, 32],
  ["SAMPLE3.CAT", 14, 32],
  ["SAMPLE3.CAT", 19, 64],
  ["INTRO.CAT", 0x15, 32],
  ["SAMPLE3.CAT", 15, 128],
  ["SAMPLE3.CAT", 12, 32],
  ["SAMPLE3.CAT", 18, 32],
  ["SAMPLE3.CAT", 20, 32]
];

const introSounds = [hybridIntroSounds, introCatOnlySounds, sample3CatOnlySounds];

const introSoundTrack: IntroSoundEffect[] = [
  [0, 0x200],
  [149, 0x11],
  [173, 0x0C],
  [183, 0x0E],
  [205, 0x15],
  [211, 0x201],
  [211, 0x407],
  [223, 0x7],
  [250, 0x1],
  [253, 0x1],
  [255, 0x1],
  [257, 0x1],
  [260, 0x1],
  [261, 0x3],
  [262, 0x1],
  [264, 0x1],
  [268, 0x1],
  [270, 0x1],
  [272, 0x5],
  [272, 0x1],
  [274, 0x1],
  [278, 0x1],
  [280, 0x1],
  [282, 0x8],
  [282, 0x1],
  [284, 0x1],
  [286, 0x1],
  [288, 0x1],
  [290, 0x1],
  [292, 0x6],
  [292, 0x1],
  [296, 0x1],
  [298, 0x1],
  [300, 0x1],
  [302, 0x1],
  [304, 0x1],
  [306, 0x1],
  [308, 0x1],
  [310, 0x1],
  [312, 0x1],
  [378, 0x202],
  [378, 0x9],
  [386, 0x9],
  [393, 0x9],
  [399, 0x17],
  [433, 0x17],
  [463, 0x12],
  [477, 0x12],
  [487, 0x13],
  [495, 0x16],
  [501, 0x16],
  [512, 0xd],
  [514, 0xd],
  [522, 0x0B],
  [523, 0xd],
  [525, 0xd],
  [534, 0x18],
  [535, 0x405],
  [560, 0x407],
  [577, 0x14],
  [582, 0x405],
  [582, 0x19],
  [613, 0x407],
  [615, 0x10],
  [635, 0x14],
  [638, 0x14],
  [639, 0x14],
  [644, 0x2],
  [646, 0x2],
  [648, 0x2],
  [650, 0x2],
  [652, 0x2],
  [654, 0x2],
  [656, 0x2],
  [658, 0x2],
  [660, 0x2],
  [662, 0x2],
  [664, 0x2],
  [666, 0x2],
  [668, 0x401],
  [681, 0x406],
  [687, 0x402],
  [689, 0x407],
  [694, 0x0A],
  [711, 0x407],
  [711, 0x0],
  [714, 0x0],
  [716, 0x4],
  [717, 0x0],
  [720, 0x0],
  [723, 0x0],
  [726, 0x5],
  [726, 0x0],
  [729, 0x0],
  [732, 0x0],
  [735, 0x0],
  [738, 0x0],
  [741, 0x0],
  [742, 0x6],
  [744, 0x0],
  [747, 0x0],
  [750, 0x0],
  [753, 0x0],
  [756, 0x0],
  [759, 0x0],
  [762, 0x0],
  [765, 0x0],
  [768, 0x0],
  [771, 0x0],
  [774, 0x0],
  [777, 0x0],
  [780, 0x0],
  [783, 0x0],
  [786, 0x0],
  [790, 0x15],
  [790, 0x15],
  [807, 0x2],
  [810, 0x2],
  [812, 0x2],
  [814, 0x2],
  [816, 0x0],
  [819, 0x0],
  [822, 0x0],
  [824, 0x40A],
  [824, 0x5],
  [827, 0x6],
  [835, 0x0F],
  [841, 0x0F],
  [845, 0x0F],
  [855, 0x407],
  [879, 0x0C],
  [65535, 0x0FFFF]
];

class AudioSequence {
  private _trackPosition = 0;

  constructor(private _mod: Mod | null, private _flcPlayer: FlcPlayer) {}

  run(): void {
    while (this._trackPosition < introSoundTrack.length && this._flcPlayer.getFrameCount() >= introSoundTrack[this._trackPosition][0]) {
      const command = introSoundTrack[this._trackPosition][1];
      if (command & 0x200) {
        switch (command) {
          case 0x200:
            this._mod?.getMusic("GMINTRO1", false)?.play(1);
            break;
          case 0x201:
            this._mod?.getMusic("GMINTRO2", false)?.play(1);
            break;
          case 0x202:
            this._mod?.getMusic("GMINTRO3", false)?.play(1);
            break;
        }
      } else if (command & 0x400) {
        this._flcPlayer.setHeaderSpeed(command & 0xff);
      } else if (command <= 0x19) {
        for (const sounds of introSounds) {
          const sf = sounds[command];
          if (!sf) {
            continue;
          }
          const channel = this._trackPosition % 4;
          const sound = this._mod?.getSound(sf[0], sf[1], false) || null;
          if (sound) {
            Sound.setVolume(channel, (sf[2] * Options.soundVolume) / (128 * 128));
            sound.play(channel);
            break;
          }
        }
      }
      ++this._trackPosition;
    }
  }
}

export class VideoState extends State {
  private _wasLetterboxed = false;
  private _prevMusicVol = 0;
  private _prevSoundVol = 0;
  private _flcPlayer: FlcPlayer | null = null;
  private _audioSequence: AudioSequence | null = null;
  private _videoIndex = 0;
  private _audioCounter = 0;
  private _fade = false;
  private _finished = false;
  private _postDelayUntil = 0;
  private _ufoSequenceActive = false;

  constructor(private _videos: string[], private _tracks: string[], private _useUfoAudioSequence: boolean) {
    super();
  }

  override init(): void {
    super.init();
    this._wasLetterboxed = CutsceneState.initDisplay();
    this._prevMusicVol = Options.musicVolume;
    this._prevSoundVol = Options.soundVolume;
    this._ufoSequenceActive = this._useUfoAudioSequence;

    if (this._useUfoAudioSequence) {
      const soundDir = getVFolderContents("SOUND");
      const ufoIntroSoundFileDosExists = soundDir.has("intro.cat");
      const ufoIntroSoundFileWinExists = soundDir.has("sample3.cat");

      if (!ufoIntroSoundFileDosExists && !ufoIntroSoundFileWinExists) {
        this._useUfoAudioSequence = false;
      } else {
        Options.musicVolume = Options.soundVolume = Math.max(this._prevMusicVol, this._prevSoundVol);
        this.game().setVolume(Options.soundVolume, Options.musicVolume, -1);
      }
    }

    this.game().getCursor().setVisible(false);
    this._fade = true;
    this._videoIndex = 0;
    this._audioCounter = 0;
    this.startNextVideo();
  }

  override handle(action: Action): void {
    if (action.getDetails().type === SDL_MOUSEBUTTONDOWN || action.getDetails().type === SDL_KEYDOWN) {
      if (this._flcPlayer) {
        this._flcPlayer.skip();
      }
      if (this._postDelayUntil > 0) {
        this._postDelayUntil = 0;
        this.finishCurrentVideo(true);
      }
    }
  }

  override think(): void {
    if (this._finished) {
      return;
    }

    if (this._postDelayUntil > 0) {
      if (performance.now() < this._postDelayUntil) {
        return;
      }
      this._postDelayUntil = 0;
      this.finishCurrentVideo(false);
      return;
    }

    if (!this._flcPlayer) {
      return;
    }

    const playing = this._flcPlayer.tick();
    if (!playing) {
      const skipped = this._flcPlayer.wasSkipped();
      if (this._useUfoAudioSequence && !skipped) {
        this._postDelayUntil = performance.now() + 10000;
        return;
      }
      this.finishCurrentVideo(skipped);
    }
  }

  override blit(): void {
    this._flcPlayer?.blit(this.game().getScreen().getSurface());
  }

  private startNextVideo(): void {
    while (this._videoIndex < this._videos.length) {
      let useInternalAudio = true;
      const track = this._tracks.length > this._audioCounter ? this._tracks[this._audioCounter] : "";
      if (track && this.game().getMod()?.getMusic(track, false)) {
        this.game().getMod()?.getMusic(track, false)?.play(0);
        useInternalAudio = false;
      }
      ++this._audioCounter;

      const videoFileName = getFilePath(this._videos[this._videoIndex++]);
      if (!fileExists(videoFileName)) {
        continue;
      }

      this._flcPlayer = new FlcPlayer();
      if (this._useUfoAudioSequence) {
        this._audioSequence = new AudioSequence(this.game().getMod(), this._flcPlayer);
      }

      const dx = Math.trunc((Options.baseXResolution - Screen.ORIGINAL_WIDTH) / 2);
      const dy = Math.trunc((Options.baseYResolution - Screen.ORIGINAL_HEIGHT) / 2);
      const ok = this._flcPlayer.init(
        videoFileName,
        this._useUfoAudioSequence ? () => this._audioSequence?.run() : null,
        this.game(),
        useInternalAudio,
        dx,
        dy
      );
      if (ok) {
        this._flcPlayer.play(this._useUfoAudioSequence);
        return;
      }

      this._audioSequence = null;
      this._flcPlayer.deInit();
      this._flcPlayer = null;
    }

    this.finish();
  }

  private finishCurrentVideo(skipped: boolean): void {
    this._audioSequence = null;
    this._flcPlayer?.deInit();
    this._flcPlayer = null;

    if (skipped) {
      this._fade = false;
      this.finish();
      return;
    }

    this.startNextVideo();
  }

  private finish(): void {
    if (this._finished) {
      return;
    }
    this._finished = true;

    if (this._fade) {
      Sound.stop();
      Music.stop();
    } else {
      Sound.stop();
      Music.stop();
    }

    this.game().getScreen().clear();
    this.game().getScreen().flip();

    if (this._ufoSequenceActive) {
      Options.musicVolume = this._prevMusicVol;
      Options.soundVolume = this._prevSoundVol;
      this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
    }

    this.game().getCursor().setVisible(true);
    CutsceneState.resetDisplay(this._wasLetterboxed);
    this.game().popState();
  }
}
