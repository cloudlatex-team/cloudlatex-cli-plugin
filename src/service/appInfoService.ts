import * as path from 'path';
import { AppInfo, Config, LoginStatus, ProjectInfo } from '../types';
import { FileRepository, FileInfo } from './../model/fileModel';
export class AppInfoService {
  private projectInfo?: ProjectInfo;
  private loginStatus: LoginStatus;
  constructor(public readonly config: Config, private fileRepo: FileRepository) {
    this.loginStatus = 'offline';
  }

  get appInfo(): AppInfo {
    const files = this.fileRepo.all();
    const targetFile = this.targetFile();
    const targetFileCandidates = files.filter(
      file => file.relativePath.split(path.posix.sep).length === 1
        && path.posix.extname(file.relativePath) === '.tex'
    );

    return {
      loginStatus: this.loginStatus,
      projectName: this.projectInfo?.title,
      logPath: this._logPath(),
      pdfPath: this._pdfPath(),
      synctexPath: this._synctexPath(),
      loaded: !!this.projectInfo,
      conflictFiles: this.fileRepo.where({ 'changeLocation': 'both' }),
      targetFile,
      files,
      targetFileCandidates
    };
  }

  setLoginStatus(loginStatus: LoginStatus): void {
    this.loginStatus = loginStatus;
  }

  onProjectLoaded(projectInfo: ProjectInfo): void {
    this.projectInfo = projectInfo;
  }

  private targetName(): string {
    if (!this.projectInfo) {
      return '';
    }
    return path.posix.basename(this.targetFile()?.relativePath || 'main', '.tex');
  }

  private targetFile(): FileInfo | undefined {
    return this.projectInfo?.compileTargetFileRemoteId !== undefined
      && this.fileRepo.findBy('remoteId', this.projectInfo.compileTargetFileRemoteId)
      || undefined;
  }

  private _logPath(): string {
    return path.posix.join(this.config.outDir || '', this.targetName() + '.log');
  }

  private _pdfPath(): string {
    return path.posix.join(this.config.outDir || '', this.targetName() + '.pdf');
  }

  private _synctexPath(): string {
    return path.posix.join(this.config.outDir || '', this.targetName() + '.synctex');
  }
}