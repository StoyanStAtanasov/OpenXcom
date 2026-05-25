import { Logger, LOG_INFO, LOG_VERBOSE } from "./Logger.ts";

type RulesetGroup = [string, string[]];

const rulesets: RulesetGroup[] = [];
const resources = new Map<string, string>();
const vdirs = new Map<string, Set<string>>();
const emptySet = new Set<string>();

function canonicalize(input: string): string {
  return input.replaceAll("\\", "/").toLowerCase();
}

function combinePath(prefixPath: string, appendPath: string): string {
  return prefixPath ? `${prefixPath}/${appendPath}` : appendPath;
}

function trimTrailingSlash(path: string): string {
  let ret = canonicalize(path);
  while (ret.endsWith("/")) {
    ret = ret.slice(0, -1);
  }
  return ret;
}

export function getFilePath(relativeFilePath: string): string {
  const canonicalRelativeFilePath = canonicalize(relativeFilePath);
  const mapped = resources.get(canonicalRelativeFilePath);
  if (!mapped) {
    Logger.log(LOG_INFO, `requested file not found: ${relativeFilePath}`);
    return relativeFilePath;
  }
  return mapped;
}

export function getVFolderContents(relativePath: string): Set<string> {
  return vdirs.get(trimTrailingSlash(relativePath)) || emptySet;
}

export function filterFiles(files: Iterable<string>, ext: string): Set<string> {
  const ret = new Set<string>();
  const canonicalExt = canonicalize(ext);
  for (const file of files) {
    const dotExt = file.slice(file.length - canonicalExt.length);
    if (file.length > canonicalExt.length + 1 && dotExt.toLowerCase() === canonicalExt) {
      ret.add(file);
    }
  }
  return ret;
}

export function getRulesets(): RulesetGroup[] {
  return rulesets;
}

export function recordRulesets(modId: string, files: string[]): void {
  if (files.length === 0) {
    return;
  }
  if (rulesets[0]?.[0] === modId) {
    rulesets[0][1].push(...files);
    Logger.log(LOG_VERBOSE, `  recording ${files.length} more rulesets for ${modId}`);
    return;
  }
  rulesets.unshift([modId, [...files]]);
  Logger.log(LOG_VERBOSE, `  recording ${files.length} rulesets for ${modId}`);
}

export function clear(): void {
  rulesets.length = 0;
  resources.clear();
  vdirs.clear();
}

export function mapFile(modId: string, basePath: string, relPath: string, file: string, ignoreMods = false): void {
  const canonicalFile = canonicalize(file);
  const fullPath = `${basePath.replace(/\/+$/, "")}/${combinePath(relPath, file)}`;

  if (canonicalFile === "metadata.yml") {
    return;
  }
  if (canonicalFile.endsWith(".rul")) {
    if (!ignoreMods) {
      recordRulesets(modId, [fullPath]);
    }
    return;
  }

  const canonicalRelativeFilePath = canonicalize(combinePath(relPath, file));
  if (!resources.has(canonicalRelativeFilePath)) {
    resources.set(canonicalRelativeFilePath, fullPath);
    Logger.log(LOG_VERBOSE, `  mapped resource: ${canonicalRelativeFilePath} -> ${fullPath}`);
  }

  const canonicalRelativePath = canonicalize(relPath);
  let vdir = vdirs.get(canonicalRelativePath);
  if (!vdir) {
    vdir = new Set<string>();
    vdirs.set(canonicalRelativePath, vdir);
  }
  vdir.add(canonicalFile);
}

export function load(modId: string, path: string, ignoreMods: boolean): void {
  Logger.log(LOG_VERBOSE, `  mapping resources in: ${path}`);
  // Browser builds normally use dist/resource-manifest.json. This direct loader is
  // kept as the source-shaped boundary for tests or generated manifests.
  void modId;
  void ignoreMods;
}

export function loadManifest(modId: string, manifest: Record<string, string | string[] | null | undefined>, ignoreMods = true): void {
  for (const value of Object.values(manifest)) {
    const files = Array.isArray(value) ? value : value ? [value] : [];
    for (const fullPath of files) {
      const parts = fullPath.replaceAll("\\", "/").split("/");
      const file = parts.pop() || "";
      const relPath = parts.slice(-2, -1).join("/");
      const basePath = parts.slice(0, -1).join("/");
      mapFile(modId, basePath, relPath, file, ignoreMods);
    }
  }
}

export function isResourcesEmpty(): boolean {
  return resources.size === 0;
}

export const FileMap = {
  getFilePath,
  getVFolderContents,
  filterFiles,
  getRulesets,
  recordRulesets,
  clear,
  load,
  loadManifest,
  mapFile,
  isResourcesEmpty
};
