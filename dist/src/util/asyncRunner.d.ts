/**
 * Utility class manages the execution of an asynchronous function
 *  to ensure that only one instance of the function is running at any given time.
 * If a new function call is made while the original is still running,
 *  the new call is added to a queue and is executed when the previous call is completed.
 * The result of the function call is returned as a Promise.
 */
export declare class AsyncRunner<Result> {
    private func;
    private runningTask;
    private waitingTask;
    constructor(func: () => Promise<Result>);
    run(): Promise<Result>;
}
