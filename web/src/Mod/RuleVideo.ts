import { ALIGN_LEFT, type ALIGN_CENTER, type ALIGN_RIGHT } from "../Interface/Text.ts";

export type TextHAlign = typeof ALIGN_LEFT | typeof ALIGN_CENTER | typeof ALIGN_RIGHT;

export type SlideshowHeader = {
  musicId: string;
  transitionSeconds: number;
};

export type SlideshowSlide = {
  imagePath: string;
  caption: string;
  w: number;
  h: number;
  x: number;
  y: number;
  color: number;
  align: TextHAlign | number;
  transitionSeconds: number;
};

export type RuleVideoNode = {
  useUfoAudioSequence?: boolean;
  videos?: string[];
  audioTracks?: string[];
  slideshow?: {
    musicId?: string;
    transitionSeconds?: number;
    slides?: Array<{
      imagePath?: string;
      caption?: string;
      captionSize?: [number, number] | number[];
      captionPos?: [number, number] | number[];
      captionColor?: number;
      captionAlign?: TextHAlign | number;
      transitionSeconds?: number;
    }>;
  };
};

type SlideshowSlideNode = NonNullable<NonNullable<RuleVideoNode["slideshow"]>["slides"]>[number];

export class RuleVideo {
  private _useUfoAudioSequence = false;
  private _videos: string[] = [];
  private _audioTracks: string[] = [];
  private _slideshowHeader: SlideshowHeader = { musicId: "", transitionSeconds: 30 };
  private _slides: SlideshowSlide[] = [];

  constructor(private _id: string) {}

  load(node: RuleVideoNode): void {
    this._useUfoAudioSequence = node.useUfoAudioSequence ?? false;
    for (const video of node.videos || []) {
      this._videos.push(video);
    }
    for (const track of node.audioTracks || []) {
      this._audioTracks.push(track);
    }
    if (node.slideshow) {
      this._slideshowHeader.musicId = node.slideshow.musicId ?? "";
      this._slideshowHeader.transitionSeconds = node.slideshow.transitionSeconds ?? 30;
      for (const entry of node.slideshow.slides || []) {
        this._slides.push(loadSlide(entry));
      }
    }
  }

  getId(): string {
    return this._id;
  }

  useUfoAudioSequence(): boolean {
    return this._useUfoAudioSequence;
  }

  getVideos(): string[] {
    return this._videos;
  }

  getSlideshowHeader(): SlideshowHeader {
    return this._slideshowHeader;
  }

  getSlides(): SlideshowSlide[] {
    return this._slides;
  }

  getAudioTracks(): string[] {
    return this._audioTracks;
  }
}

function loadSlide(node: SlideshowSlideNode): SlideshowSlide {
  const size = node.captionSize || [320, 200];
  const pos = node.captionPos || [0, 0];
  return {
    imagePath: node.imagePath ?? "",
    caption: node.caption ?? "",
    w: size[0] ?? 320,
    h: size[1] ?? 200,
    x: pos[0] ?? 0,
    y: pos[1] ?? 0,
    color: node.captionColor ?? Number.MAX_SAFE_INTEGER,
    transitionSeconds: node.transitionSeconds ?? 0,
    align: node.captionAlign ?? ALIGN_LEFT
  };
}
