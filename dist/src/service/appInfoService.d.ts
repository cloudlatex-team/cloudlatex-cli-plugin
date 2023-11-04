import { AppInfo, Config, LoginStatus, ProjectInfo } from '../types';
import { FileRepository } from './../model/fileModel';
export declare class AppInfoService {
    readonly config: Config;
    private fileRepo;
    private projectInfo?;
    private loginStatus;
    constructor(config: Config, fileRepo: FileRepository);
    get appInfo(): AppInfo;
    setLoginStatus(loginStatus: LoginStatus): void;
    onProjectLoaded(projectInfo: ProjectInfo): void;
    private targetName;
    private targetFile;
    private _logPath;
    private _pdfPath;
    private _synctexPath;
}
