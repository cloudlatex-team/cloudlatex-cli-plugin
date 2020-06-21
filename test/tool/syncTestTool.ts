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

export const TestConfigList = (() => {
  let list: TestConfig[] = [];
  const changeOptions: ChangeState[] = ['no', 'create', 'update', 'delete'];
  changeOptions.forEach(local => {
    changeOptions.forEach(remote => {
      let conflictOptions = [false];
      if((local === 'update' || local === 'delete') &&
        (remote === 'update' || remote === 'delete')) {
        conflictOptions.push(true);
      }
      conflictOptions.forEach(conflict => {
        let syncModeOptions: SyncMode[] = ['upload'];
        if(conflict) {
          syncModeOptions.push('download');
        }
        syncModeOptions.forEach(syncMode => {
          let describe = `local: "${local}" remote: "${remote}" `;
          if(conflictOptions.length > 1) {
            describe += `conflict: "${conflict}" `;
          }
          if(conflict) {
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
  return list;
})();

export function sleep(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}
