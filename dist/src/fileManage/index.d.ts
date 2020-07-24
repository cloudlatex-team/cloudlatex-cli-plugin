import { Repository } from '@moritanian/type-db';
import { Config, DecideSyncMode } from './../types';
import Backend from './../backend/backend';
import FileAdapter from './FileAdapter';
import Logger from './../logger';
import * as EventEmitter from 'eventemitter3';
export default class FileManager extends EventEmitter {
    private config;
    private decideSyncMode;
    private fileFilter;
    private logger;
    readonly backend: Backend;
    private _fileAdapter;
    private _fileRepo;
    private syncManager;
    get fileAdapter(): FileAdapter;
    get fileRepo(): Repository<{
        name: string;
        columns: {
            id: number;
            isFolder: boolean;
            relativePath: string;
            url: string;
            remoteRevision: string | number | null;
            localRevision: string | number | null;
            localChange: import("../types").ChangeState;
            remoteChange: import("../types").ChangeState;
            changeLocation: import("../types").ChangeLocation;
            remoteId: string | number | null;
            watcherSynced: boolean;
        };
        primaryKey: string;
        indexColumns: string[];
        autoIncrement: boolean;
    }>;
    constructor(config: Config, decideSyncMode: DecideSyncMode, fileFilter: (relativePath: string) => boolean, logger: Logger);
    init(): Promise<void>;
    startSync(): Promise<void>;
}
