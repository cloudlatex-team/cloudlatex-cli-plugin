import { Repository } from '@moritanian/type-db';
import { sync } from 'glob';

export const SYNC_DESC = {
  name: 'Sync',
  columns: {
    id: 0,
    synced: false,
  },
  primaryKey: 'id',
  autoIncrement: true
};

export type SyncRepository = Repository<typeof SYNC_DESC>;
