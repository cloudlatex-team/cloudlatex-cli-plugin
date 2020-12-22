import { SyncMode, ChangeState } from '../../src/types';
export declare type TestConfig = {
    changeStates: {
        local: ChangeState;
        remote: ChangeState;
    };
    syncMode: SyncMode;
    conflict: boolean;
    isOffline: boolean;
    describe: string;
};
export declare const TestConfigList: TestConfig[];
export declare function sleep(ms: number): Promise<unknown>;