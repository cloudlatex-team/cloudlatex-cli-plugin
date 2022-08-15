import * as path from 'path';
import * as url from 'url';
import * as pako from 'pako';
import { TextDecoder } from 'text-encoding';

import { CLWebAppApi } from './webAppApi';
import { FileInfo, Revision } from '../../model/fileModel';
import { ClFile } from './types';
import { IBackend } from '../ibackend';
import { Config, ProjectInfo, KeyType, Account, CompileResult } from './../../types';
import { streamToString, ReadableString } from '../../util/stream';
import { AccountService } from '../../service/accountService';

export class ClBackend implements IBackend {
  private api: CLWebAppApi;
  private config: Config;
  constructor(config: Config, accountService: AccountService<Account>) {
    this.config = config;
    this.api = new CLWebAppApi(config, accountService);
  }

  public validateToken(): Promise<boolean> {
    return this.api.validateToken();
  }

  public download(file: FileInfo): Promise<NodeJS.ReadableStream> {
    /*
     * url of some files such as pdf begins with '/'
     *    like '/projects/180901/files/1811770/preview'
     */
    if (file.url[0] === '/') {
      const fileUrl = url.resolve(url.resolve(this.config.endpoint, '..'), file.url);
      return this.api.downdloadPreview(fileUrl);
    }

    return this.api.download(file.url);
  }

  public async upload(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    file: FileInfo, stream: NodeJS.ReadableStream, option?: unknown
  ): Promise<{ remoteId: KeyType, remoteRevision: Revision }> {
    let relativeDir = path.posix.dirname(file.relativePath);
    if (relativeDir.length > 1 && relativeDir[0] === '/') {
      relativeDir = relativeDir.slice(1);
    }
    if (relativeDir === '.') {
      relativeDir = '';
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await this.api.uploadFile(stream, relativeDir);
    return { remoteId: result.file.id, remoteRevision: result.file.revision };
  }

  public async createRemote(
    file: FileInfo, parent: FileInfo | null
  ): Promise<{ remoteId: KeyType, remoteRevision: Revision }> {
    const belongs = parent && Number(parent.remoteId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await this.api.createFile(path.posix.basename(file.relativePath), belongs, file.isFolder);
    return { remoteId: result.file.id, remoteRevision: result.file.revision };
  }

  public async updateRemote(file: FileInfo & { remoteId: number }, stream: NodeJS.ReadableStream): Promise<KeyType> {
    const content = await streamToString(stream);

    const result = await this.api.updateFile(file.remoteId, {
      content,
      revision: file.remoteRevision
    });
    return result.revision;
  }

  public async deleteRemote(file: FileInfo & { remoteId: number }): Promise<unknown> {
    return this.api.deleteFile(file.remoteId);
  }

  public loadProjectInfo(): Promise<ProjectInfo> {
    return this.api.loadProjectInfo();
  }

  public async loadFileList(): Promise<FileInfo[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await this.api.loadFiles();
    const materialFiles: Array<ClFile> = res.material_files;

    return materialFiles.map(materialFile => {
      return {
        id: -1,
        isFolder: !!materialFile.is_folder,
        relativePath: String(materialFile.full_path),
        url: String(materialFile.file_url),
        remoteRevision: materialFile.revision,
        localRevision: materialFile.revision,
        localChange: 'no',
        remoteChange: 'no',
        changeLocation: 'no',
        remoteId: Number(materialFile.id),
        watcherSynced: false
      };
    });
  }

  public loadSynctexObject(url: string): Promise<ArrayBuffer> {
    return this.api.loadSynctexObject(url);
  }

  public async compileProject(): Promise<{
    logStream: NodeJS.ReadableStream,
    pdfStream?: NodeJS.ReadableStream,
    synctexStream?: NodeJS.ReadableStream,
  } & CompileResult> {
    const result = await this.api.compileProject();
    const exitCode = Number(result.exit_code);
    const logStream = new ReadableString(result.log);
    const logs: CompileResult['logs'] = [...result.errors.map(err => ({
      line: err.line || 1,
      message: err.error_log,
      type: 'error' as const,
      file: path.posix.join(this.config.rootPath, err.filename || '')
    })), ...result.warnings.map(warn => ({
      line: warn.line || 1,
      message: warn.warning_log,
      type: 'warning' as const,
      file: path.posix.join(this.config.rootPath, warn.filename || '')
    }))];

    if (exitCode !== 0) {
      return {
        status: 'compiler-error',
        logStream,
        logs
      };
    }

    // pdf
    const pdfStream = await this.api.download(result.uri);

    // download synctex
    const compressed = await this.loadSynctexObject(result.synctex_uri);
    const decompressed = pako.inflate(new Uint8Array(compressed));
    let synctexStr = new TextDecoder('utf-8').decode(decompressed);
    synctexStr = synctexStr.replace(/\/data\/\./g, this.config.rootPath);
    const synctexStream = new ReadableString(synctexStr);

    return {
      status: 'success',
      logStream,
      logs,
      pdfStream,
      synctexStream
    };
  }
}