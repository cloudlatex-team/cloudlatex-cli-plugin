import * as path from 'path';
import { AppInfo, Config, LoginStatus, KeyType } from '../types';
import { FileInfo } from './../model/fileModel';
export class AppInfoService {
  private _appInfo: AppInfo;
  constructor(public readonly config: Config) {
    this._appInfo = {
      loginStatus: 'offline',
      conflictFiles: [],
      loaded: false
    };
  }

  get appInfo(): AppInfo {
    return {
      ...this._appInfo,
      conflictFiles: [...this._appInfo.conflictFiles.map(file => ({ ...file }))],
    };
  }

  setLoginStatus(loginStatus: LoginStatus): void {
    this._appInfo.loginStatus = loginStatus;
  }

  setProjectName(projectName: string): void {
    this._appInfo.projectName = projectName;
  }

  setTarget(compileTarget: KeyType, targetName: string): void {
    this._appInfo.compileTarget = compileTarget;
    this._appInfo.targetName = targetName;

    // set dependent paths
    this._appInfo.logPath = this._logPath();
    this._appInfo.pdfPath = this._pdfPath();
    this._appInfo.synctexPath = this._synctexPath();
  }

  setLoaded(): void {
    this._appInfo.loaded = true;
  }

  setConflicts(files: FileInfo[]): void {
    this._appInfo.conflictFiles = files;
  }

  private _logPath(): string {
    return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.log');
  }

  private _pdfPath(): string {
    return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.pdf');
  }

  private _synctexPath(): string {
    return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.synctex');
  }
}