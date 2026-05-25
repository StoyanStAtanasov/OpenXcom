export type SoundDefinitionNode = {
  soundRanges?: Array<[number, number] | number[]>;
  sounds?: number[];
  file?: string;
};

export class SoundDefinition {
  private _catFile = "";
  private _soundList: number[] = [];

  constructor(private _type: string) {}

  load(node: SoundDefinitionNode): void {
    for (const range of node.soundRanges || []) {
      const first = Math.trunc(range[0] ?? 0);
      const second = Math.trunc(range[1] ?? 0);
      for (let i = first; i <= second; ++i) {
        this._soundList.push(i);
      }
    }
    for (const sound of node.sounds || []) {
      this._soundList.push(Math.trunc(sound));
    }
    this._catFile = node.file ?? this._catFile;
  }

  getType(): string {
    return this._type;
  }

  getSoundList(): number[] {
    return this._soundList;
  }

  getCATFile(): string {
    return this._catFile;
  }
}
