import * as path from 'path';
import * as pako from 'pako';
import { TextDecoder } from 'text-encoding';

import WebAppApi from './webAppApi';
import { FileInfo } from '../../model/fileModel';
import { ClFile } from './types';
import Backend from '../backend';
import { Config, ProjectInfo, KeyType } from './../../types';
import { streamToString, ReadableString } from './../../util';

export default class ClBackend extends Backend {
  private api: WebAppApi;
  constructor(config: Config) {
    super(config);
    this.api = new WebAppApi(config);
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
    const result = await this.api.uploadFile(stream, relativeDir);
    // # TODO revision is in result.file?
    return { remoteId: result.file.id, remoteRevision: result.file.revision };
  }

  public async updateRemote(file: FileInfo & {remoteId: number}, stream: NodeJS.ReadableStream): Promise<any> {
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
    // #TODO detect unauthorized and offline
    const res = await this.api?.loadFiles();
    const materialFiles: Array<ClFile> = res.material_files;

    return materialFiles.map(materialFile => {
      return {
        id: -1,
        isFolder: materialFile.is_folder,
        relativePath: materialFile.full_path,
        url: materialFile.file_url,
        remoteRevision: materialFile.revision,
        localChange: 'no',
        remoteChange: 'no',
        changeLocation: 'no',
        remoteId: materialFile.id,
        watcherSynced: false
      };
    });
  }

  public loadSynctexObject(url: string): Promise<any> {
    return this.api.loadSynctexObject(url);
  }

  public async compileProject() {
    let result = await this.api.compileProject();

    if(Number(result.exit_code) !== 0) {
      throw result;
    }

    // log
    const logStr = result.errors.join('\n') + result.warnings.join('\n') + '\n' + result.log;
    const logStream = new ReadableString(logStr);


    // pdf
    const pdfStream = await this.api.download(result.uri);

    // download synctex
    const compressed = await this.loadSynctexObject(result.synctex_uri);
    const decompressed = pako.inflate(new Uint8Array(compressed));
    let synctexStr = new TextDecoder('utf-8').decode(decompressed);
    synctexStr = synctexStr.replace(/\/data\/\./g, this.config.rootPath);
    const synctexStream = new ReadableString(synctexStr);
    return {
      pdfStream,
      logStream,
      synctexStream
    };
  }
}