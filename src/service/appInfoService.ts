import * as path from 'path';
import { AppInfo, Config, ProjectInfo, KeyType } from  '../types';
export default class AppInfoService {
  public readonly appInfo: AppInfo;
  constructor(private config: Config) {
    this.appInfo = {
      offline: false,
      conflictFiles: [],
      loaded: false
    };
  }

  setOnline() {
    this.appInfo.offline = false;
  }

  setOffLine() {
    this.appInfo.offline = true;
  }

  setProjectName(projectName: string) {
    this.appInfo.projectName = projectName;
  }

  setTarget(compileTarget: KeyType, targetName: string) {
    this.appInfo.compileTarget = compileTarget;
    this.appInfo.targetName = targetName;

    // set dependent paths
    this.appInfo.logPath = this._logPath();
    this.appInfo.pdfPath = this._pdfPath();
    this.appInfo.synctexPath = this._synctexPath();
  }

  setLoaded() {
    this.appInfo.loaded = true;
  }

  setConflicts(files: string[]) {
    this.appInfo.conflictFiles = files;
  }

  private _logPath(): string {
    return path.join(this.config.outDir, this.appInfo.targetName + '.log');
  }

  private _pdfPath(): string {
    return path.join(this.config.outDir, this.appInfo.targetName + '.pdf');
  }

  private _synctexPath(): string {
    return path.join(this.config.outDir, this.appInfo.targetName + '.synctex');
  }
}