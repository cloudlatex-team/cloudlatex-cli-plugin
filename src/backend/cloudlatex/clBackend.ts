import * as path from 'path';
import * as pako from 'pako';
import { TextDecoder } from 'text-encoding';

import WebAppApi from './webAppApi';
import { FileInfo } from '../../model/fileModel';
import { ClFile } from './types';
import IBackend from '../ibackend';
import { Config, ProjectInfo, KeyType, Account, CompileResult } from './../../types';
import { streamToString, ReadableString } from '../../util/stream';
import AccountService from '../../service/accountService';

export default class ClBackend implements IBackend {
  private api: WebAppApi;
  private config: Config;
  constructor(config: Config, accountService: AccountService<Account>) {
    this.config = config;
    this.api = new WebAppApi(config, accountService);
  }

  public validateToken() {
    return this.api.validateToken();
  }

  public download(file: FileInfo) {
    return this.api.download(file.url);
  }

  public async upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{remoteId: KeyType, remoteRevision: any}> {
    let relativeDir = path.dirname(file.relativePath);
    if (relativeDir.length > 1 && relativeDir[0] === '/') {
      relativeDir = relativeDir.slice(1);
    }
    if (relativeDir === '.') {
      relativeDir = '';
    }
    const result = await this.api.uploadFile(stream, relativeDir);
    return { remoteId: result.file.id, remoteRevision: result.file.revision };
  }

  public async createRemote(file: FileInfo, parent: FileInfo | null): Promise<{remoteId: KeyType, remoteRevision: any}> {
    const belongs = parent && Number(parent.remoteId);
    const result = await this.api.createFile(path.basename(file.relativePath), belongs, file.isFolder);
    return { remoteId: result.file.id, remoteRevision: result.file.revision };
  }

  public async updateRemote(file: FileInfo & {remoteId: number}, stream: NodeJS.ReadableStream): Promise<KeyType> {
    const content = await streamToString(stream);

    const result = await this.api.updateFile(file.remoteId, {
      content,
      revision: file.remoteRevision
    });
    return result.revision;
  }

  public async deleteRemote(file: FileInfo & {remoteId: number}) {
    return this.api.deleteFile(file.remoteId);
  }

  public loadProjectInfo(): Promise<ProjectInfo> {
    return this.api.loadProjectInfo();
  }

  public async loadFileList(): Promise<FileInfo[]> {
    const res = await this.api?.loadFiles();
    const materialFiles: Array<ClFile> = res.material_files;

    return materialFiles.map(materialFile => {
      return {
        id: -1,
        isFolder: !!materialFile.is_folder,
        relativePath: String(materialFile.full_path),
        url: String(materialFile.file_url),
        remoteRevision: String(materialFile.revision),
        localRevision: String(materialFile.revision),
        localChange: 'no',
        remoteChange: 'no',
        changeLocation: 'no',
        remoteId: Number(materialFile.id),
        watcherSynced: false
      };
    });
  }

  public loadSynctexObject(url: string): Promise<any> {
    return this.api.loadSynctexObject(url);
  }

  public async compileProject(): Promise<{
    logStream: NodeJS.ReadableStream,
    pdfStream?: NodeJS.ReadableStream,
    synctexStream?: NodeJS.ReadableStream,
  } & CompileResult> {
    const result = await this.api.compileProject();
    const exitCode = Number(result.exit_code);
    const logStream = new ReadableString( result.log );
    const logs: CompileResult['logs'] = [...result.errors.map(err => ({
      line: err.line || 1,
      message: err.error_log,
      type: 'error' as const,
      file: path.join(this.config.rootPath, err.filename || '')
    })), ...result.warnings.map(warn => ({
      line: warn.line || 1,
      message: warn.warning_log,
      type: 'warning' as const,
      file: path.join(this.config.rootPath, warn.filename || '')
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