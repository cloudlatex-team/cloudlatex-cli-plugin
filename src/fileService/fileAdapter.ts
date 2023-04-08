import * as fs from 'fs';
import * as path from 'path';
import { IBackend } from '../backend/ibackend';
import { FileRepository, FileInfo } from '../model/fileModel';

/**
 * FileAdapter class
 *
 * Provide operations of remote and local files
 * The file path is expressed with `path.posix.sep` internally
 * and only convert native path (`path.sep`) when this class operates local file.
 */
export class FileAdapter {
  constructor(
    protected rootPath: string,
    private fileRepo: FileRepository,
    private backend: IBackend,
  ) {
  }

  public loadFileList(): Promise<FileInfo[]> {
    return this.backend.loadFileList();
  }

  public async download(file: FileInfo): Promise<void> {
    const stream = await this.backend.download(file);
    file.watcherSynced = false;
    try {
      await this.saveAs(file.relativePath, stream);
    } catch (e) {
      file.watcherSynced = true;
      this.fileRepo.save();
      throw e;
    }
    file.localChange = 'no';
    file.localRevision = file.remoteRevision;
    this.fileRepo.save();
  }

  public async saveAs(filePath: string, stream: NodeJS.ReadableStream): Promise<void> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.posix.join(this.rootPath, filePath);
    const dirname = path.posix.dirname(absPath);
    if (dirname !== this.rootPath) {
      try {
        await fs.promises.mkdir(dirname.replace(new RegExp(path.posix.sep, 'g'), path.sep));
      } catch (err) {
        // Already exists
      }
    }

    return await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
      stream.pipe(fileStream);

      stream.on('error', (err) => {
        reject(err);
      });

      fileStream.on('error', (err: Error) => {
        reject(err);
      });

      fileStream.on('finish', () => {
        resolve();
      });
    });
  }

  public async createLocalFolder(file: FileInfo): Promise<void> {
    const absPath = path.posix.join(this.rootPath, file.relativePath);
    try {
      await fs.promises.mkdir(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
    } catch (err) {
      // Allow only the error that file is alraady exist.
      if ((err as { code: string }).code !== 'EEXIST') {
        throw err;
      }
    }
    file.localChange = 'no';
    file.localRevision = file.remoteRevision;
    this.fileRepo.save();
    return;
  }

  public async createRemoteFolder(file: FileInfo): Promise<void> {
    const parent = this.fileRepo.findBy('relativePath', path.posix.dirname(file.relativePath));
    const { remoteId, remoteRevision } = await this.backend.createRemote(file, parent);
    file.remoteId = remoteId;
    file.localRevision = remoteRevision;
    file.localChange = 'no';
    this.fileRepo.save();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  public async upload(file: FileInfo, option?: any): Promise<void> {
    const stream = fs.createReadStream(
      path.posix.join(this.rootPath, file.relativePath).replace(new RegExp(path.posix.sep, 'g'), path.sep)
    );
    const { remoteId, remoteRevision } = await this.backend.upload(file, stream, option);
    file.remoteId = remoteId;
    file.localRevision = remoteRevision;
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async updateRemote(file: FileInfo): Promise<void> {
    const stream = fs.createReadStream(
      path.posix.join(this.rootPath, file.relativePath).replace(new RegExp(path.posix.sep, 'g'), path.sep)
    );
    file.localRevision = await this.backend.updateRemote(file, stream);
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async deleteRemote(file: FileInfo): Promise<void> {
    await this.backend.deleteRemote(file);
    this.fileRepo.delete(file.id);
    this.fileRepo.save();
  }

  public async deleteLocal(file: FileInfo): Promise<void> {
    file.watcherSynced = false;
    this.fileRepo.save();

    const absPath = path.posix.join(this.rootPath, file.relativePath);
    if (file.isFolder) {
      try {
        await fs.promises.rmdir(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
      } catch (err) {
        // Allow the error that file is already deleted
        if ((err as { code: string }).code !== 'ENOENT') {
          throw err;
        }
      }
      return;
    }

    try {
      await fs.promises.unlink(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
    } catch (err) {
      file.watcherSynced = true;
      this.fileRepo.save();
      // Allow the error that file is already deleted
      if ((err as { code: string }).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
