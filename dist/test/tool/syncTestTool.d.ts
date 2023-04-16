import { SyncMode, ChangeState } from '../../src/types';
export declare type TestConfig = {
    changeStates: {
        local: ChangeState;
        remote: ChangeState;
    };
    syncMode: SyncMode;
    conflict: boolean;
    networkMode: 'online' | 'offline' | 'offline-and-online' /** sync under offline and after that sync under onine */;
    describe: string;
};
export declare const TEST_CONFIG_LIST: TestConfig[];
export declare function sleep(ms: number): Promise<void>;
