import { AppInfo, Config, LoginStatus, KeyType } from '../types';
import { FileInfo } from './../model/fileModel';
export declare class AppInfoService {
    private config;
    readonly appInfo: AppInfo;
    constructor(config: Config);
    setLoginStatus(loginStatus: LoginStatus): void;
    setProjectName(projectName: string): void;
    setTarget(compileTarget: KeyType, targetName: string): void;
    setLoaded(): void;
    setConflicts(files: FileInfo[]): void;
    private _logPath;
    private _pdfPath;
    private _synctexPath;
}
