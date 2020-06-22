import * as fs from 'fs';
import * as path from 'path';
import { KeyType } from '../types';
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
    if(file.isFolder) {
      return;
    } 

    // # When failed download 
    const stream = await this.backend.download(file);
    file.watcherSynced = false;
    await this.saveAs(file.relativePath, stream);
    file.localChange = 'no';
    this.fileRepo.save();
  }

  public async saveAs(relativePath: string, stream: NodeJS.ReadableStream): Promise<void> {
    const absPath = path.join(this.rootPath, relativePath);
    const dirname = path.dirname(absPath);
    if(dirname !== relativePath) {
      try {
        await fs.promises.mkdir(dirname, { recursive: true });
      } catch(err) {
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
    const stream = fs.createReadStream(path.join(this.rootPath, file.relativePath));
    const { remoteId, remoteRevision } = await this.backend.upload(file, stream, option);
    file.remoteId = remoteId;
    file.remoteRevision = remoteRevision;
    file.localChange = 'no';
    file.watcherSynced = true;
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
    file.watcherSynced = false;
    this.fileRepo.save();
    const absPath = path.join(this.rootPath, file.relativePath);
    await fs.promises.unlink(absPath);
  }
}
