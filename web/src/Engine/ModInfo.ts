export class ModInfo {
  constructor(
    private _id: string,
    private _name = "",
    private _isMaster = false,
    private _engineOk = true,
    private _version = "",
    private _author = "",
    private _description = "",
    private _requiredExtendedEngine = "",
    private _master = _isMaster ? "" : "xcom1",
    private _path = `bin/standard/${_id}`,
    private _externalResourceDirs: string[] = [],
    private _resourceConfigFile = "",
    private _reservedSpace = 1
  ) {}

  getId(): string {
    return this._id;
  }

  getName(): string {
    return this._name || this._id;
  }

  getVersion(): string {
    return this._version;
  }

  getAuthor(): string {
    return this._author;
  }

  getDescription(): string {
    return this._description;
  }

  isMaster(): boolean {
    return this._isMaster;
  }

  getMaster(): string {
    return this._master;
  }

  canActivate(curMasterId: string): boolean {
    return this.isMaster() || this.getMaster() === "" || this.getMaster() === curMasterId;
  }

  isEngineOk(): boolean {
    return this._engineOk;
  }

  getRequiredExtendedEngine(): string {
    return this._requiredExtendedEngine;
  }

  getPath(): string {
    return this._path;
  }

  getExternalResourceDirs(): string[] {
    return this._externalResourceDirs;
  }

  getResourceConfigFile(): string {
    return this._resourceConfigFile;
  }

  getReservedSpace(): number {
    return this._reservedSpace;
  }
}
