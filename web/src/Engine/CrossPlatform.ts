import { Options } from "./Options.ts";
import { Logger, LOG_ERROR, LOG_INFO } from "./Logger.ts";
import { SDL_KEYDOWN, KMOD_ALT, type SdlEvent } from "../types.ts";

export const PATH_SEPARATOR = "/";

let errorDlg = "";

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function storageKey(path: string): string {
  return `openxcom.file:${normalizePath(path)}`;
}

export function getErrorDialog(): void {
  errorDlg = "browser-console";
}

export function showError(error: string): void {
  Logger.log(LOG_ERROR, error);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(error);
  }
}

export function findDataFolders(): string[] {
  return [Options.assetBase, "../XCOM/", "../TFD/", "../bin/"].map(endPath);
}

export function findUserFolders(): string[] {
  return [Options.getUserFolder ? Options.getUserFolder() : "browser://localStorage/openxcom/"];
}

export function findConfigFolder(): string {
  return Options.getConfigFolder ? Options.getConfigFolder() : "browser://localStorage/openxcom/options/";
}

export function searchDataFile(filename: string): string {
  const name = normalizePath(filename);
  const dataFolder = endPath(Options.getDataFolder ? Options.getDataFolder() : Options.assetBase);
  return `${dataFolder}${name}`.replace(/^\.\.\//, "");
}

export function searchDataFolder(foldername: string, _size = 0): string {
  const name = normalizePath(foldername);
  const dataFolder = endPath(Options.getDataFolder ? Options.getDataFolder() : Options.assetBase);
  return endPath(`${dataFolder}${name}`.replace(/^\.\.\//, ""));
}

export function createFolder(_path: string): boolean {
  return true;
}

export function endPath(path: string): string {
  if (path && !path.endsWith("/") && !path.endsWith("\\")) {
    return `${path}/`;
  }
  return path;
}

export function getFolderContents(path: string, ext = ""): string[] {
  const prefix = storageKey(endPath(path));
  const files: string[] = [];
  for (let i = 0; i < localStorage.length; ++i) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith(prefix)) {
      continue;
    }
    const file = baseFilename(key.slice(prefix.length));
    if (file && compareExt(file, ext)) {
      files.push(file);
    }
  }
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function folderMinSize(path: string, size: number): boolean {
  if (size === 0) {
    return true;
  }
  return getFolderContents(path).length >= size;
}

export function folderExists(path: string): boolean {
  if (normalizePath(path).startsWith("browser://")) {
    return true;
  }
  return true;
}

export function fileExists(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized.startsWith("browser://")) {
    return localStorage.getItem(storageKey(normalized)) != null;
  }
  return true;
}

export function deleteFile(path: string): boolean {
  localStorage.removeItem(storageKey(path));
  return true;
}

export function baseFilename(path: string): string {
  const trimmed = normalizePath(path).replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/?\\]/g, "_");
}

export function noExt(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? file : file.slice(0, dot);
}

export function getExt(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
}

export function compareExt(file: string, extension: string): boolean {
  if (!extension) {
    return true;
  }
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  return file.toLowerCase().endsWith(`.${ext.toLowerCase()}`);
}

export function getLocale(): string {
  return navigator.language || "en-US";
}

export function isQuitShortcut(ev: SdlEvent): boolean {
  return ev.type === SDL_KEYDOWN && ev.key?.keysym.sym === "F4" && !!(ev.key.keysym.mod & KMOD_ALT);
}

export function getDateModified(_path: string): number {
  return Date.now();
}

export function timeToString(time: number): [string, string] {
  const date = new Date(time);
  const yyyy = date.getFullYear().toString().padStart(4, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const hh = date.getHours().toString().padStart(2, "0");
  const mi = date.getMinutes().toString().padStart(2, "0");
  return [`${yyyy}-${mm}-${dd}`, `${hh}:${mi}`];
}

export function moveFile(src: string, dest: string): boolean {
  const srcKey = storageKey(src);
  const data = localStorage.getItem(srcKey);
  if (data == null) {
    return false;
  }
  localStorage.setItem(storageKey(dest), data);
  localStorage.removeItem(srcKey);
  return true;
}

export function flashWindow(): void {
  Logger.log(LOG_INFO, "CrossPlatform::flashWindow browser boundary.");
}

export function getDosPath(): string {
  return "C:\\GAMES\\OPENXCOM";
}

export function setWindowIcon(_winResource: number, _unixPath: string): void {}

export function stackTrace(_ctx: unknown): void {
  Logger.log(LOG_ERROR, new Error().stack || "No stack trace available.");
}

export function now(): string {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function crashDump(_ex: unknown, err: string): void {
  showError(`OpenXcom has crashed: ${err}`);
}

export function openExplorer(url: string): boolean {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}

export function getExeFolder(): string {
  return "";
}

export function putBrowserFile(path: string, data: string): void {
  localStorage.setItem(storageKey(path), data);
}

export function getBrowserFile(path: string): string | null {
  return localStorage.getItem(storageKey(path));
}

export const CrossPlatform = {
  PATH_SEPARATOR,
  getErrorDialog,
  showError,
  findDataFolders,
  findUserFolders,
  findConfigFolder,
  searchDataFile,
  searchDataFolder,
  createFolder,
  endPath,
  getFolderContents,
  folderMinSize,
  folderExists,
  fileExists,
  deleteFile,
  baseFilename,
  sanitizeFilename,
  noExt,
  getExt,
  compareExt,
  getLocale,
  isQuitShortcut,
  getDateModified,
  timeToString,
  moveFile,
  flashWindow,
  getDosPath,
  setWindowIcon,
  stackTrace,
  now,
  crashDump,
  openExplorer,
  getExeFolder,
  putBrowserFile,
  getBrowserFile,
  get errorDlg() {
    return errorDlg;
  }
};
