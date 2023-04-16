import { ChangeState, ChangeLocation } from '../types';
import { Repository } from '@moritanian/type-db';
export declare type Revision = string | number | null;
export declare const FILE_INFO_DESC: {
    name: string;
    columns: {
        id: number;
        isFolder: boolean;
        relativePath: string;
        url: string;
        remoteRevision: Revision;
        localRevision: Revision;
        localChange: ChangeState;
        remoteChange: ChangeState;
        changeLocation: ChangeLocation;
        remoteId: Revision;
        watcherSynced: boolean;
    };
    primaryKey: string;
    indexColumns: string[];
    autoIncrement: boolean;
};
export declare type FileRepository = Repository<typeof FILE_INFO_DESC>;
export declare type FileInfo = typeof FILE_INFO_DESC['columns'];
