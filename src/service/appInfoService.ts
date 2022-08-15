import * as path from 'path';
import { AppInfo, Config, LoginStatus, KeyType } from '../types';
import { FileInfo } from './../model/fileModel';
export class AppInfoService {
  public readonly appInfo: AppInfo;
  constructor(private config: Config) {
    this.appInfo = {
      loginStatus: 'offline',
      conflictFiles: [],
      loaded: false
    };
  }

  setLoginStatus(loginStatus: LoginStatus): void {
    this.appInfo.loginStatus = loginStatus;
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