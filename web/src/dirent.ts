export const _DIRENT_HAVE_D_TYPE = true;
export const _DIRENT_HAVE_D_NAMLEN = true;

export const FILE_ATTRIBUTE_DEVICE = 0x40;

export const S_IFMT = 0xF000;
export const S_IFDIR = 0x4000;
export const S_IFCHR = 0x2000;
export const S_IFFIFO = 0x1000;
export const S_IFREG = 0x8000;
export const S_IREAD = 0x0100;
export const S_IWRITE = 0x0080;
export const S_IEXEC = 0x0040;
export const S_IFIFO = S_IFFIFO;
export const S_IFBLK = 0;
export const S_IFLNK = 0;
export const S_IFSOCK = 0;
export const S_IRUSR = S_IREAD;
export const S_IWUSR = S_IWRITE;
export const S_IXUSR = 0;
export const S_IRGRP = 0;
export const S_IWGRP = 0;
export const S_IXGRP = 0;
export const S_IROTH = 0;
export const S_IWOTH = 0;
export const S_IXOTH = 0;

export const PATH_MAX = 260;
export const FILENAME_MAX = PATH_MAX;
export const NAME_MAX = FILENAME_MAX;

export const DT_UNKNOWN = 0;
export const DT_REG = S_IFREG;
export const DT_DIR = S_IFDIR;
export const DT_FIFO = S_IFIFO;
export const DT_SOCK = S_IFSOCK;
export const DT_CHR = S_IFCHR;
export const DT_BLK = S_IFBLK;
export const DT_LNK = S_IFLNK;

export function IFTODT(mode: number): number {
  return mode & S_IFMT;
}

export function DTTOIF(type: number): number {
  return type;
}

export function S_ISFIFO(mode: number): boolean {
  return (mode & S_IFMT) === S_IFIFO;
}

export function S_ISDIR(mode: number): boolean {
  return (mode & S_IFMT) === S_IFDIR;
}

export function S_ISREG(mode: number): boolean {
  return (mode & S_IFMT) === S_IFREG;
}

export function S_ISLNK(mode: number): boolean {
  return (mode & S_IFMT) === S_IFLNK;
}

export function S_ISSOCK(mode: number): boolean {
  return (mode & S_IFMT) === S_IFSOCK;
}

export function S_ISCHR(mode: number): boolean {
  return (mode & S_IFMT) === S_IFCHR;
}

export function S_ISBLK(mode: number): boolean {
  return (mode & S_IFMT) === S_IFBLK;
}

export function _D_EXACT_NAMLEN(p: { d_namlen: number }): number {
  return p.d_namlen;
}

export function _D_ALLOC_NAMLEN(_p: { d_namlen: number }): number {
  return PATH_MAX;
}

export class _wdirent {
  d_ino = 0;
  d_reclen = 0;
  d_namlen = 0;
  d_type = DT_UNKNOWN;
  d_name = "";
}

export class _WDIR {
  ent = new _wdirent();
  data: unknown = null;
  cached = 0;
  handle: unknown = null;
  patt: string | null = null;
}

export class dirent {
  d_ino = 0;
  d_reclen = 0;
  d_namlen = 0;
  d_type = DT_UNKNOWN;
  d_name = "";
}

export class DIR {
  ent = new dirent();
  wdirp: _WDIR | null = null;
}

export function _wopendir(dirname: string): _WDIR | null {
  if (!dirname) {
    return null;
  }
  const dirp = new _WDIR();
  dirp.patt = dirname;
  return dirp;
}

export function _wreaddir(dirp: _WDIR | null): _wdirent | null {
  return dirp ? null : null;
}

export function _wclosedir(_dirp: _WDIR | null): number {
  return 0;
}

export function _wrewinddir(_dirp: _WDIR | null): void {
  // Browser boundary: directory streams are not backed by Win32 handles.
}

export { _wopendir as wopendir, _wreaddir as wreaddir, _wclosedir as wclosedir, _wrewinddir as wrewinddir, _wdirent as wdirent, _WDIR as WDIR };

export function opendir(dirname: string): DIR | null {
  if (!dirname) {
    return null;
  }
  const dirp = new DIR();
  dirp.wdirp = _wopendir(dirname);
  return dirp;
}

export function readdir(_dirp: DIR | null): dirent | null {
  return null;
}

export function closedir(_dirp: DIR | null): number {
  return 0;
}

export function rewinddir(_dirp: DIR | null): void {
  // Browser boundary: directory streams are not backed by Win32 handles.
}
