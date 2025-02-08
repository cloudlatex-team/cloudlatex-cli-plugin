import { ActivationStatus, AppInfo, Config, LoginStatus, ProjectInfo } from '../types';
import { FileRepository } from './../model/fileModel';
export declare class AppInfoService {
    readonly config: Config;
    private fileRepo;
    private projectInfo?;
    private activationStatus;
    private loginStatus;
    constructor(config: Config, fileRepo: FileRepository);
    get appInfo(): AppInfo;
    setActivationStatus(activationStatus: ActivationStatus): void;
    setLoginStatus(loginStatus: LoginStatus): void;
    onProjectLoaded(projectInfo: ProjectInfo): void;
    private targetName;
    private targetFile;
    private _logPath;
    private _pdfPath;
    private _synctexPath;
}
