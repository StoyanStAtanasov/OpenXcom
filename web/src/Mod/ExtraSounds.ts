export type ModDataLike = {
  name: string;
  offset: number;
  size: number;
};

export type ExtraSoundsNode = {
  type?: string;
  files?: Record<string, string> | Map<number, string>;
};

export class ExtraSounds {
  private _type = "";
  private _sounds = new Map<number, string>();
  private _current: ModDataLike | null = null;

  load(node: ExtraSoundsNode, current: ModDataLike | null): void {
    this._type = node.type ?? this._type;
    this._sounds = node.files instanceof Map
      ? new Map(node.files)
      : new Map(Object.entries(node.files || {}).map(([key, value]) => [Number(key), value]));
    this._current = current;
  }

  getType(): string {
    return this._type;
  }

  getSounds(): Map<number, string> {
    return this._sounds;
  }

  loadSoundSet<T extends SoundSetLike>(set: T | null): T | null {
    for (const [index, fileName] of this._sounds) {
      this.loadSound(set, index, fileName);
    }
    return set;
  }

  private loadSound<T extends SoundSetLike>(set: T | null, index: number, fileName: string): void {
    if (!set) {
      return;
    }
    let indexWithOffset = index;
    const maxShared = set.getMaxSharedSounds?.() ?? Number.MAX_SAFE_INTEGER;
    if (indexWithOffset >= maxShared && this._current) {
      if (indexWithOffset >= this._current.size) {
        throw new Error(`ExtraSounds '${this._type}' sound '${indexWithOffset}' exceeds mod '${this._current.name}' size limit ${this._current.size}`);
      }
      indexWithOffset += this._current.offset;
    }
    const sound = set.getSound?.(indexWithOffset) || set.addSound?.(indexWithOffset);
    sound?.load?.(fileName);
  }
}

type SoundLike = { load?: (path: string) => void };
type SoundSetLike = {
  getMaxSharedSounds?: () => number;
  getSound?: (index: number) => SoundLike | null;
  addSound?: (index: number) => SoundLike;
};
