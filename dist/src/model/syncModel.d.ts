import { Repository } from '@moritanian/type-db';
export declare const SYNC_DESC: {
    name: string;
    columns: {
        id: number;
        synced: boolean;
    };
    primaryKey: string;
    autoIncrement: boolean;
};
export declare type SyncRepository = Repository<typeof SYNC_DESC>;
