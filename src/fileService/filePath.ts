import { Matcher } from 'npm:anymatch';
import anymatch from 'npm:anymatch';
import path from 'node:path';
import { FileInfo } from '../model/fileModel.ts';
import { AppInfoService } from '../service/appInfoService.ts';
import { Config } from '../types.ts';
const SYSTEM_IGNORED_FILES = [
  '**/.git/**',
  '**/node_modules/**',
  '**/.DS_Store',
];

const DEFAULT_USER_IGNORED_FILES = [
  '**/*.aux',
  '**/*.bbl',
  '**/*.bcf',
  '**/*.blg',
  '**/*.idx',
  '**/*.ind',
  '**/*.lof',
  '**/*.lot',
  '**/*.out',
  '**/*.toc',
  '**/*.acn',
  '**/*.acr',
  '**/*.alg',
  '**/*.glg',
  '**/*.glo',
  '**/*.gls',
  '**/*.ist',
  '**/*.fls',
  '**/*.log',
  '**/*.nav',
  '**/*.snm',
  '**/*.fdb_latexmk',
  '**/*.synctex.gz',
  '**/*.run.xml',
];

export const dotFileExceptLatexmkrc = '**/.!(latexmkrc)';

function mergeMatcher(...macthers: Matcher[]): Matcher {
  return macthers.reduce<Matcher & Array<unknown>>((merged, matcher) => {
    if (Array.isArray(matcher)) {
      merged.push(...matcher);
    } else {
      merged.push(matcher);
    }
    return merged;
  }, []);
}

export function toAbsolutePath(config: Config, relativePath: string): string {
  return path.posix.join(config.rootPath, relativePath);
}

export function toRelativePath(config: Config, absolutePath: string): string {
  return path.posix.relative(config.rootPath, absolutePath);
}

// Absolute path pattern
function calcIgnoredFilesByConfig(userIgnoredFiles?: Matcher): Matcher {
  if (userIgnoredFiles) {
    return mergeMatcher(SYSTEM_IGNORED_FILES, userIgnoredFiles);
  } else {
    return mergeMatcher(SYSTEM_IGNORED_FILES, DEFAULT_USER_IGNORED_FILES);
  }
}

// Absoulte path pattern
function calcIgnoredFilesByArtifacts(appInfoService: AppInfoService): Matcher {
  return (absPath) => [
    appInfoService.appInfo.logPath,
    appInfoService.appInfo.pdfPath,
    appInfoService.appInfo.synctexPath
  ].includes(toRelativePath(appInfoService.config, absPath));
}

// Absoulte path pattern
export function calcIgnoredFiles(appInfoService: AppInfoService): Matcher {
  return mergeMatcher(
    calcIgnoredFilesByConfig(appInfoService.config.ignoredFiles),
    calcIgnoredFilesByArtifacts(appInfoService)
  );
}

export function checkIgnoredByFileInfo(config: Config, file: FileInfo, ignoredFiles: Matcher): boolean {
  const absPath = toAbsolutePath(config, file.relativePath);
  return anymatch(ignoredFiles, absPath);
}

export function getDBFilePath(config: Config): string | undefined {
  return config.storagePath ? path.join(
    config.storagePath, `.${config.projectId}-${config.backend}.json`
  ) : undefined;
}

export function toPosixPath(p: string): string {
  return p.replace(/\\/g, path.posix.sep); // for windows
}

export function calcRelativeOutDir(config: Config): string {
  const outDir = config.outDir || config.rootPath;
  let relativeOutDir = path.isAbsolute(outDir) ?
    path.relative(config.rootPath, outDir) :
    path.join(outDir);
  relativeOutDir = toPosixPath(relativeOutDir);
  if (relativeOutDir === path.posix.sep || relativeOutDir === `.${path.posix.sep}`) {
    relativeOutDir = '';
  }
  return relativeOutDir;
}