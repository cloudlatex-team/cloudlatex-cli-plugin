import { ConflictSolution, ChangeState } from '../../src/types';

export type TestConfig = {
  changeStates: {
    local: ChangeState,
    remote: ChangeState,
  },
  conflictSolution?: ConflictSolution,
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
        const conflictSolutions: Array<ConflictSolution | undefined> = [undefined];
        if (conflict) {
          conflictSolutions.push('push');
          conflictSolutions.push('pull');
        }
        conflictSolutions.forEach(conflictSolution => {
          const networkModeOptions: Array<TestConfig['networkMode']> = ['online', 'offline', 'offline-and-online'];
          networkModeOptions.forEach(networkMode => {
            let describe = `local: "${local}" remote: "${remote}" `;
            if (conflictOptions.length > 1) {
              describe += `conflict: "${conflict}" `;
            }
            if (conflict) {
              describe += `conflictSolution: "${conflictSolution || 'unspecified'}" `;
            }

            describe += `netowork: ${networkMode}`;
            list.push({
              changeStates: {
                local,
                remote,
              },
              conflict,
              conflictSolution,
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
