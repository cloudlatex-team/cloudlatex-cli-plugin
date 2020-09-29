import * as fs from 'fs';
import * as path from 'path';
import Backend from '../backend/ibackend';
import { FileRepository, FileInfo } from '../model/fileModel';
import Logger from '../util/logger';

export default class FileAdapter {
  constructor(
    protected rootPath: string,
    private fileRepo: FileRepository,
    private backend: Backend,
    protected logger: Logger
  ) {
  }

  public loadFileList(): Promise<FileInfo[]> {
    return this.backend.loadFileList();
  }

  public async download(file: FileInfo): Promise<void> {
    const stream = await this.backend.download(file);
    file.watcherSynced = false;
    await this.saveAs(file.relativePath, stream);
    file.localChange = 'no';
    file.localRevision = file.remoteRevision;
    this.fileRepo.save();
  }

  public async saveAs(relativePath: string, stream: NodeJS.ReadableStream): Promise<void> {
    const absPath = path.join(this.rootPath, relativePath);
    const dirname = path.dirname(absPath);
    if (dirname !== relativePath) {
      try {
        await fs.promises.mkdir(dirname);
      } catch (err) {
      }
    }

    return await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(absPath);
      stream.pipe(fileStream);
      stream.on('error', (err) => {
        reject(err);
      });
      fileStream.on('finish', () => {
        resolve();
      });
    });
  }

  public async createLocalFolder(file: FileInfo): Promise<void> {
    const absPath = path.join(this.rootPath, file.relativePath);
    try {
      await fs.promises.mkdir(absPath);
    } catch (err) {
      // Allow only the error that file is alraady exist.
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    file.localChange = 'no';
    file.localRevision = file.remoteRevision;
    this.fileRepo.save();
    return;
  };

  public async createRemoteFolder(file: FileInfo): Promise<void> {
    const parent = this.fileRepo.findBy('relativePath', path.dirname(file.relativePath));
    const { remoteId, remoteRevision } = await this.backend.createRemote(file, parent);
    file.remoteId = remoteId;
    file.localRevision = remoteRevision;
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async upload(file: FileInfo, option?: any): Promise<void>  {
    const stream = fs.createReadStream(path.join(this.rootPath, file.relativePath));
    const { remoteId, remoteRevision } = await this.backend.upload(file, stream, option);
    file.remoteId = remoteId;
    file.localRevision = remoteRevision;
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async updateRemote(file: FileInfo): Promise<void>  {
    const stream = fs.createReadStream(path.join(this.rootPath, file.relativePath));
    file.localRevision  = await this.backend.updateRemote(file, stream);
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async deleteRemote(file: FileInfo): Promise<void>  {
    await this.backend.deleteRemote(file);
    this.fileRepo.delete(file.id);
    this.fileRepo.save();
  }

  public async deleteLocal(file: FileInfo): Promise<void> {
    const absPath = path.join(this.rootPath, file.relativePath);
    if (file.isFolder) {
      try {
        fs.promises.rmdir(absPath);
      } catch (err) {
        // Allow the error that file is already deleted
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
      return;
    }
    file.watcherSynced = false;
    this.fileRepo.save();
    try {
      await fs.promises.unlink(absPath);
    } catch (err) {
      // Allow the error that file is already deleted
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
