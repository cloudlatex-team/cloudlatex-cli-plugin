"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncRunner = void 0;
/**
 * Utility class manages the execution of an asynchronous function
 *  to ensure that only one instance of the function is running at any given time.
 * If a new function call is made while the original is still running,
 *  the new call is added to a queue and is executed when the previous call is completed.
 * The result of the function call is returned as a Promise.
 */
class AsyncRunner {
    constructor(func) {
        this.func = func;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.runningTask) {
                if (!this.waitingTask) {
                    this.waitingTask = new Promise((resolve, reject) => {
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
        });
    }
}
exports.AsyncRunner = AsyncRunner;
//# sourceMappingURL=asyncRunner.js.map