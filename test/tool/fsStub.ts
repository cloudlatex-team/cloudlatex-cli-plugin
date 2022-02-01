/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sinon from 'sinon';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as mockFs from 'mock-fs';

function fsStub(files: Record<string, string>): void {
  mockFs(files);
  let watcher: chokidar.FSWatcher;
  const originalChokidarWatch = chokidar.watch;
  const originalCreateWriteStream = fs.createWriteStream;
  const originalWriteFile = fs.promises.writeFile;
  const originalMkdir = fs.promises.mkdir;
  const originalUnlink = fs.promises.unlink;
  const originalRmdir = fs.promises.rmdir;

  Sinon.stub(fs, 'createWriteStream').callsFake((path: fs.PathLike, options?: any) => {
    const stream = originalCreateWriteStream(path, options);
    const statPromise = fs.promises.stat(path);
    stream.on('finish', () => {
      statPromise.then(() => {
        watcher.emit('change', path);
      }).catch(() => {
        watcher.emit('add', path);
      });
    });
    return stream;
  });

  Sinon.stub(fs.promises, 'writeFile').callsFake((path: any, data: string | Uint8Array, options?: any) => (
    fs.promises.stat(path).then(() => (
      originalWriteFile(path, data, options).then(() => 'change')
    )).catch(() => (
      originalWriteFile(path, data, options).then(() => 'add')
    )).then(eventName => {
      watcher.emit(eventName, path);
    })
  ));

  Sinon.stub(fs.promises, 'mkdir').callsFake((path: fs.PathLike, options?: any) => (
    fs.promises.stat(path).then(() => {
      throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
    }).catch(async () => {
      const str = await originalMkdir(path, options);
      watcher.emit('addDir', path);
      return str;
    })
  ));

  Sinon.stub(fs.promises, 'unlink').callsFake((path: fs.PathLike) => (
    originalUnlink(path).then(() => {
      watcher.emit('unlink', path);
    })
  ));

  Sinon.stub(fs.promises, 'rmdir').callsFake((path: fs.PathLike) => (
    originalRmdir(path).then(() => {
      watcher.emit('unlinkDir', path);
    })
  ));

  Sinon.stub(chokidar, 'watch').callsFake(
    (path: string | readonly string[], option?: chokidar.WatchOptions): chokidar.FSWatcher => {
      return watcher = originalChokidarWatch(path, option);
    }
  );
}

fsStub.restore = function () {
  mockFs.restore();
  Sinon.restore();

};

export default fsStub;
