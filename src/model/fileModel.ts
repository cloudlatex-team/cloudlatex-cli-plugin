import { ChangeState, ChangeLocation } from '../types.ts';
import { Repository } from 'npm:@moritanian/type-db';

export type Revision = string | number | null;
export const FILE_INFO_DESC = {
  name: 'FileInfo',
  columns: {
    id: 0,
    isFolder: false,
    relativePath: '',
    url: '',
    remoteRevision: (null as Revision),
    localRevision: (null as Revision),
    localChange: ('no' as ChangeState),
    remoteChange: ('no' as ChangeState),
    changeLocation: ('no' as ChangeLocation),
    remoteId: (null as Revision),
    watcherSynced: false
  },
  primaryKey: 'id',
  indexColumns: ['remoteId'],
  autoIncrement: true
};

export type FileRepository = Repository<typeof FILE_INFO_DESC>;
export type FileInfo = typeof FILE_INFO_DESC['columns'];
