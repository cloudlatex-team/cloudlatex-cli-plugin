import { AppInfo, Config, KeyType } from '../types';
export default class AppInfoService {
    private config;
    readonly appInfo: AppInfo;
    constructor(config: Config);
    setOnline(): void;
    setOffLine(): void;
    setProjectName(projectName: string): void;
    setTarget(compileTarget: KeyType, targetName: string): void;
    setLoaded(): void;
    setConflicts(files: string[]): void;
    private _logPath;
    private _pdfPath;
    private _synctexPath;
}
