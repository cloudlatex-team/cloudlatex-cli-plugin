import { ChangeState, ChangeLocation } from '../types';
import { Repository } from 'type-db';

export const FileInfoDesc = {
  name: 'FileInfo',
  columns: {
    id: 0,
    isFolder: false,
    relativePath: '',
    url: '',
    remoteRevision: ('' as string | number),
    localChange: ('no' as ChangeState),
    remoteChange: ('no' as ChangeState),
    changeLocation: ('no' as ChangeLocation),
    remoteId: (null as string | number | null),
    watcherSynced: false
  },
  primaryKey: 'id',
  indexColumns: ['remoteId'],
  autoIncrement: true
};

export type FileRepository = Repository<typeof FileInfoDesc>;
export type FileInfo = typeof FileInfoDesc['columns'];
