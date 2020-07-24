import { ChangeState, ChangeLocation } from '../types';
import { Repository } from 'type-db';
export declare const FileInfoDesc: {
    name: string;
    columns: {
        id: number;
        isFolder: boolean;
        relativePath: string;
        url: string;
        remoteRevision: string | number | null;
        localRevision: string | number | null;
        localChange: ChangeState;
        remoteChange: ChangeState;
        changeLocation: ChangeLocation;
        remoteId: string | number | null;
        watcherSynced: boolean;
    };
    primaryKey: string;
    indexColumns: string[];
    autoIncrement: boolean;
};
export declare type FileRepository = Repository<typeof FileInfoDesc>;
export declare type FileInfo = typeof FileInfoDesc['columns'];
