import * as path from 'path';
import { AppInfo, Config, KeyType } from '../types';
import { FileInfo } from './../model/fileModel';
export default class AppInfoService {
  public readonly appInfo: AppInfo;
  constructor(private config: Config) {
    this.appInfo = {
      offline: false,
      conflictFiles: [],
      loaded: false
    };
  }

  setOnline(): void {
    this.appInfo.offline = false;
  }

  setOffLine(): void {
    this.appInfo.offline = true;
  }

  setProjectName(projectName: string): void {
    this.appInfo.projectName = projectName;
  }

  setTarget(compileTarget: KeyType, targetName: string): void {
    this.appInfo.compileTarget = compileTarget;
    this.appInfo.targetName = targetName;

    // set dependent paths
    this.appInfo.logPath = this._logPath();
    this.appInfo.pdfPath = this._pdfPath();
    this.appInfo.synctexPath = this._synctexPath();
  }

  setLoaded(): void {
    this.appInfo.loaded = true;
  }

  setConflicts(files: FileInfo[]): void {
    this.appInfo.conflictFiles = files;
  }

  private _logPath(): string {
    return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.log');
  }

  private _pdfPath(): string {
    return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.pdf');
  }

  private _synctexPath(): string {
    return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.synctex');
  }
}