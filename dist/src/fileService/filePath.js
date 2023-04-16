"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcRelativeOutDir = exports.toPosixPath = exports.getDBFilePath = exports.checkIgnoredByFileInfo = exports.calcIgnoredFiles = exports.toRelativePath = exports.toAbsolutePath = exports.dotFileExceptLatexmkrc = void 0;
const anymatch_1 = require("anymatch");
const path = require("path");
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
exports.dotFileExceptLatexmkrc = '**/.!(latexmkrc)';
function mergeMatcher(...macthers) {
    return macthers.reduce((merged, matcher) => {
        if (Array.isArray(matcher)) {
            merged.push(...matcher);
        }
        else {
            merged.push(matcher);
        }
        return merged;
    }, []);
}
function toAbsolutePath(config, relativePath) {
    return path.posix.join(config.rootPath, relativePath);
}
exports.toAbsolutePath = toAbsolutePath;
function toRelativePath(config, absolutePath) {
    return path.posix.relative(config.rootPath, absolutePath);
}
exports.toRelativePath = toRelativePath;
// Absolute path pattern
function calcIgnoredFilesByConfig(userIgnoredFiles) {
    if (userIgnoredFiles) {
        return mergeMatcher(SYSTEM_IGNORED_FILES, userIgnoredFiles);
    }
    else {
        return mergeMatcher(SYSTEM_IGNORED_FILES, DEFAULT_USER_IGNORED_FILES);
    }
}
// Absoulte path pattern
function calcIgnoredFilesByArtifacts(appInfoService) {
    return (absPath) => [
        appInfoService.appInfo.logPath,
        appInfoService.appInfo.pdfPath,
        appInfoService.appInfo.synctexPath
    ].includes(toRelativePath(appInfoService.config, absPath));
}
// Absoulte path pattern
function calcIgnoredFiles(appInfoService) {
    return mergeMatcher(calcIgnoredFilesByConfig(appInfoService.config.ignoredFiles), calcIgnoredFilesByArtifacts(appInfoService));
}
exports.calcIgnoredFiles = calcIgnoredFiles;
function checkIgnoredByFileInfo(config, file, ignoredFiles) {
    const absPath = toAbsolutePath(config, file.relativePath);
    return anymatch_1.default(ignoredFiles, absPath);
}
exports.checkIgnoredByFileInfo = checkIgnoredByFileInfo;
function getDBFilePath(config) {
    return config.storagePath ? path.join(config.storagePath, `.${config.projectId}-${config.backend}.json`) : undefined;
}
exports.getDBFilePath = getDBFilePath;
function toPosixPath(p) {
    return p.replace(/\\/g, path.posix.sep); // for windows
}
exports.toPosixPath = toPosixPath;
function calcRelativeOutDir(config) {
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
exports.calcRelativeOutDir = calcRelativeOutDir;
//# sourceMappingURL=filePath.js.map