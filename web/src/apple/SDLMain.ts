export const SDL_USE_NIB_FILE = 0;

export let gArgc = 0;
export let gArgv: string[] = [];
export let gFinderLaunch = false;
export let gCalledAppMainline = false;

export function getApplicationName(): string {
  return (typeof document !== "undefined" && document.title) ? document.title : "OpenXcom";
}

export class SDLMain {
  setupWorkingDirectory(_shouldChdir: boolean): void {
    // Browser boundary: the app directory model is managed by the web runtime.
  }

  openFile(filename: string): boolean {
    if (!gFinderLaunch || gCalledAppMainline) {
      return false;
    }
    gArgv.push(filename);
    gArgc = gArgv.length;
    return true;
  }

  applicationDidFinishLaunching(_note?: unknown): void {
    gCalledAppMainline = true;
  }
}

export function setApplicationMenu(): void {
  // Browser boundary: native menu creation is not available.
}

export function setupWindowMenu(): void {
  // Browser boundary: native menu creation is not available.
}

export function CustomApplicationMain(_argc: number, _argv: string[]): void {
  const sdlMain = new SDLMain();
  sdlMain.applicationDidFinishLaunching();
}

export function IsRootCwd(): boolean {
  return false;
}

export function IsFinderLaunch(argc: number, argv: string[]): boolean {
  if (argc >= 2 && argv[1]?.startsWith("-psn")) {
    return true;
  }
  return argc === 1 && IsRootCwd();
}

export function main(argc: number, argv: string[]): number {
  if (IsFinderLaunch(argc, argv)) {
    gArgv = [argv[0]];
    gArgc = 1;
    gFinderLaunch = true;
  } else {
    gArgv = [...argv];
    gArgc = argc;
    gFinderLaunch = false;
  }
  CustomApplicationMain(argc, argv);
  return 0;
}
