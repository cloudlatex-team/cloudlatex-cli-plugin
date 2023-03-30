/**
 * Utility class manages the execution of an asynchronous function
 *  to ensure that only one instance of the function is running at any given time.
 * If a new function call is made while the original is still running,
 *  the new call is added to a queue and is executed when the previous call is completed.
 * The result of the function call is returned as a Promise.
 */
export class AsyncRunner<Result> {
  private runningTask: Promise<Result> | undefined;
  private waitingTask: Promise<Result> | undefined;

  constructor(private func: () => Promise<Result>) {
  }

  public async run(): Promise<Result> {
    if (this.runningTask) {
      if (!this.waitingTask) {
        this.waitingTask = new Promise<Result>((resolve, reject) => {
          if (!this.runningTask) {
            return this.run();
          }
          this.runningTask.finally(() => {
            this.waitingTask = undefined;
            this.runningTask = undefined;
            this.run().then(resolve).catch(reject);
          });
        });
      }
      return this.waitingTask;
    }

    // If there is no running task, start a new one
    this.runningTask = this.func();
    this.runningTask.finally(() => {
      this.runningTask = undefined;
    });
    return this.runningTask;
  }
}
