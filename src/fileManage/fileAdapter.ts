import * as fs from 'fs';
import * as path from 'path';
import Backend from '../backend/backend';
import { FileRepository, FileInfo } from '../model/fileModel';
import Logger from '../logger';

export default class FileAdapter {
  constructor(protected rootPath: string, private fileRepo: FileRepository, private backend: Backend, protected logger: Logger) {
  }

  public loadFileList(): Promise<FileInfo[]> {
    return this.backend.loadFileList();
  }

  public async download(file: FileInfo): Promise<unknown> {
    if (file.isFolder) {
      const absPath = path.join(this.rootPath, file.relativePath);
      fs.promises.mkdir(absPath);
      return;
    }

    // # When failed download
    const stream = await this.backend.download(file);
    file.watcherSynced = false;
    this.logger.log('before download', file);
    await this.saveAs(file.relativePath, stream);
    this.logger.log('after download');
    file.localChange = 'no';
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

  public async upload(file: FileInfo, option?: any): Promise<void>  {
    if (file.isFolder) {
      const parent = this.fileRepo.findBy('relativePath', path.dirname(file.relativePath));
      if (!parent) {
        throw new Error('parent file is not found');
      }
      const { remoteId, remoteRevision } = await this.backend.createRemote(file, parent);
      file.remoteId = remoteId;
      file.remoteRevision = remoteRevision;
    } else {
      const stream = fs.createReadStream(path.join(this.rootPath, file.relativePath));
      const { remoteId, remoteRevision } = await this.backend.upload(file, stream, option);
      file.remoteId = remoteId;
      file.remoteRevision = remoteRevision;
    }
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async updateRemote(file: FileInfo): Promise<void>  {
    const stream = fs.createReadStream(path.join(this.rootPath, file.relativePath));
    const remoteRevision = await this.backend.updateRemote(file, stream);
    file.remoteRevision = remoteRevision;
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
      } catch (e) { // Already deleted
      }
      return;
    }
    file.watcherSynced = false;
    this.fileRepo.save();
    await fs.promises.unlink(absPath);
  }
}
