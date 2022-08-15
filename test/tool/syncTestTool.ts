import { SyncMode, ChangeState } from '../../src/types';

export type TestConfig = {
  changeStates: {
    local: ChangeState,
    remote: ChangeState,
  },
  syncMode: SyncMode,
  conflict: boolean,
  isOffline: boolean,
  describe: string
};

export const TEST_CONFIG_LIST = (() => {
  const list: TestConfig[] = [];
  const changeOptions: ChangeState[] = ['no', 'create', 'update', 'delete'];
  changeOptions.forEach(local => {
    changeOptions.forEach(remote => {
      const conflictOptions = [false];
      if ((local === 'update' || local === 'delete') &&
        (remote === 'update' || remote === 'delete')) {
        conflictOptions.push(true);
      }
      conflictOptions.forEach(conflict => {
        const syncModeOptions: SyncMode[] = ['upload'];
        if (conflict) {
          syncModeOptions.push('download');
        }
        syncModeOptions.forEach(syncMode => {
          let describe = `local: "${local}" remote: "${remote}" `;
          if (conflictOptions.length > 1) {
            describe += `conflict: "${conflict}" `;
          }
          if (conflict) {
            describe += `mode: "${syncMode}" `;
          }
          list.push({
            changeStates: {
              local,
              remote,
            },
            conflict,
            syncMode,
            isOffline: false,
            describe
          });
        });
      });
    });
  });
  // offline
  list.push({
    changeStates: {
      local: 'update',
      remote: 'no',
    },
    conflict: false,
    syncMode: 'upload',
    isOffline: true,
    describe: 'offline'
  });
  return list;
})();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
