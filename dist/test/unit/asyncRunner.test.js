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
const chai = require("chai");
const asyncRunner_1 = require("../../src/util/asyncRunner");
const syncTestTool_1 = require("../tool/syncTestTool");
describe('AsyncRunner with 100ms sleep task', () => {
    let cnt = 0;
    const task = () => __awaiter(void 0, void 0, void 0, function* () {
        yield syncTestTool_1.sleep(100);
        return cnt++;
    });
    let runner;
    beforeEach(() => {
        cnt = 0;
        runner = new asyncRunner_1.AsyncRunner(task);
    });
    it('Single execution', () => __awaiter(void 0, void 0, void 0, function* () {
        let resolved = false;
        const p = runner.run();
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        p.then(() => {
            resolved = true;
        });
        chai.assert.isFalse(resolved);
        const ret = yield p;
        chai.assert.strictEqual(ret, 0);
    }));
    it('Sequential execution', () => __awaiter(void 0, void 0, void 0, function* () {
        const p1 = runner.run();
        const p2 = runner.run();
        const ret1 = yield p1;
        const ret2 = yield p2;
        chai.assert.strictEqual(ret1, 0);
        chai.assert.strictEqual(ret2, 1);
    }));
    it('Execute again 200ms later', () => __awaiter(void 0, void 0, void 0, function* () {
        const p1 = runner.run();
        yield syncTestTool_1.sleep(200);
        const p2 = runner.run();
        const ret1 = yield p1;
        const ret2 = yield p2;
        chai.assert.strictEqual(ret1, 0);
        chai.assert.strictEqual(ret2, 1);
    }));
    it('Execute with 30ms interval', () => __awaiter(void 0, void 0, void 0, function* () {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
            tasks.push(runner.run());
            yield syncTestTool_1.sleep(30);
        }
        const results = yield Promise.all(tasks);
        chai.assert.strictEqual(results[0], 0);
        chai.assert.strictEqual(results[1], 1);
        chai.assert.strictEqual(results[2], 1);
        chai.assert.strictEqual(results[3], 1);
        chai.assert.strictEqual(results[4], 2);
        chai.assert.strictEqual(results[5], 2);
        chai.assert.strictEqual(results[6], 2);
        chai.assert.strictEqual(results[7], 3);
        chai.assert.strictEqual(results[8], 3);
        chai.assert.strictEqual(results[9], 3);
    }));
});
//# sourceMappingURL=asyncRunner.test.js.map