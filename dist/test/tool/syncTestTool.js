"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.TEST_CONFIG_LIST = void 0;
exports.TEST_CONFIG_LIST = (() => {
    const list = [];
    const changeOptions = ['no', 'create', 'update', 'delete'];
    changeOptions.forEach(local => {
        changeOptions.forEach(remote => {
            const conflictOptions = [false];
            if (((local === 'update' || local === 'delete') &&
                (remote === 'update' || remote === 'delete')) ||
                (local === 'create' && remote === 'create')) {
                conflictOptions.push(true);
            }
            conflictOptions.forEach(conflict => {
                const conflictSolutions = [undefined];
                if (conflict) {
                    conflictSolutions.push('push');
                    conflictSolutions.push('pull');
                }
                conflictSolutions.forEach(conflictSolution => {
                    const networkModeOptions = ['online', 'offline', 'offline-and-online'];
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
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=syncTestTool.js.map