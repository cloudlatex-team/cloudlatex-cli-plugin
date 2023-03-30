import * as chai from 'chai';
import { AsyncRunner } from '../../src/util/asyncRunner';

import { sleep } from '../tool/syncTestTool';


describe('100ms sleep task', () => {
  let cnt = 0;
  const task = async () => {
    await sleep(100);
    return cnt++;
  };

  let runner: AsyncRunner<number>;
  beforeEach(() => {
    cnt = 0;
    runner = new AsyncRunner(task);
  });

  it('Single execution', async () => {
    let resolved = false;
    const p = runner.run();
    p.then(() => {
      resolved = true;
    });
    chai.assert.isFalse(resolved);
    const ret = await p;
    chai.assert.strictEqual(ret, 0);
  });

  it('Sequential execution', async () => {
    const p1 = runner.run();
    const p2 = runner.run();
    const ret1 = await p1;
    const ret2 = await p2;
    chai.assert.strictEqual(ret1, 0);
    chai.assert.strictEqual(ret2, 1);
  });

  it('Execute again 200ms later', async () => {
    const p1 = runner.run();
    await sleep(200);
    const p2 = runner.run();

    const ret1 = await p1;
    const ret2 = await p2;
    chai.assert.strictEqual(ret1, 0);
    chai.assert.strictEqual(ret2, 1);
  });

  it('Execute with 30ms interval', async () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(runner.run());
      await sleep(30);
    }

    const results = await Promise.all(tasks);
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
  });
});