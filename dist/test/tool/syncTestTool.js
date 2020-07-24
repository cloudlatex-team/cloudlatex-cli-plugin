"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.TestConfigList = void 0;
exports.TestConfigList = (() => {
    let list = [];
    const changeOptions = ['no', 'create', 'update', 'delete'];
    changeOptions.forEach(local => {
        changeOptions.forEach(remote => {
            let conflictOptions = [false];
            if ((local === 'update' || local === 'delete') &&
                (remote === 'update' || remote === 'delete')) {
                conflictOptions.push(true);
            }
            conflictOptions.forEach(conflict => {
                let syncModeOptions = ['upload'];
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
function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=syncTestTool.js.map