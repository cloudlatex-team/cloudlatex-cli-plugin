import { SyncMode, ChangeState } from '../../src/types';

export type TestConfig = {
  changeStates: {
    local: ChangeState,
    remote: ChangeState,
  },
  syncMode: SyncMode,
  conflict: boolean,
  networkMode: 'online' | 'offline'
  | 'offline-and-online' /** sync under offline and after that sync under onine */,
  describe: string
};

export const TEST_CONFIG_LIST = (() => {
  const list: TestConfig[] = [];
  const changeOptions: ChangeState[] = ['no', 'create', 'update', 'delete'];
  changeOptions.forEach(local => {
    changeOptions.forEach(remote => {
      const conflictOptions = [false];
      if (((local === 'update' || local === 'delete') &&
        (remote === 'update' || remote === 'delete')) ||
        (local === 'create' && remote === 'create')) {
        conflictOptions.push(true);
      }
      conflictOptions.forEach(conflict => {
        const syncModeOptions: SyncMode[] = ['upload'];
        if (conflict) {
          syncModeOptions.push('download');
        }
        syncModeOptions.forEach(syncMode => {
          const networkModeOptions: Array<TestConfig['networkMode']> = ['online', 'offline', 'offline-and-online'];
          networkModeOptions.forEach(networkMode => {
            let describe = `local: "${local}" remote: "${remote}" `;
            if (conflictOptions.length > 1) {
              describe += `conflict: "${conflict}" `;
            }
            if (conflict) {
              describe += `mode: "${syncMode}" `;
            }

            describe += `netowork: ${networkMode}`;
            list.push({
              changeStates: {
                local,
                remote,
              },
              conflict,
              syncMode,
              networkMode,
              describe
            });
          });

        });
      });
    });
  });

  return list;
})();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
