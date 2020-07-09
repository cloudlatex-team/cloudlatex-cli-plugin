import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, ProjectInfo, AppInfo, SyncMode, DecideSyncMode } from './types';
import Manager from './fileManage/index';

export default class LatexApp extends EventEmitter {
  private projectInfo?: ProjectInfo;
  private loggedIn :boolean = false;
  private manager: Manager;

  constructor(private config: Config, decideSyncMode: DecideSyncMode, private logger: Logger = new Logger()) {
    super();
    this.manager = new Manager(config, decideSyncMode, 
      relativePath => {
        return ![this.logPath, this.pdfPath, this.synctexPath].includes(relativePath);
      }, 
      logger);
  }

  async launch() {
    await this.manager.init();
    this.manager.on('successfully-synced', () => {
      this.compile();
    });

    // #TODO offline 時を現在のstate machineに統合
    try {
      const result = await this.manager.backend.validateToken();
      if(!result) {
        this.logger.error('Your account is invalid.');
        return;
      }
    } catch(err) {
      this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server.`);
    }
    this.projectInfo = await this.manager.backend.loadProjectInfo();
    if (!this.projectInfo) {
      this.logger.error('Failed to load Project info.');
      return;
    }
    this.logger.log('project info', this.projectInfo);
    this.loggedIn = true;
    this.emit('appinfo-updated');

    await this.manager.startSync();
    /*
    try {
      const result = await this.manager.backend.validateToken();
      if (!result.success) {
        throw new result;
      }
    } catch(err) {
      return;
    }
    */
  }

  get targetName(): string {
    if(!this.projectInfo) {
      throw new Error('Project info is not defined');
    }
    const file = this.manager.fileRepo.findBy('remoteId', this.projectInfo.compile_target_file_id);
    if(!file) {
      throw new Error('target file is not found');
    }
    return path.basename(file.relativePath, '.tex');
  }

  get logPath(): string {
    return path.join(this.config.outDir, this.targetName + '.log');
  }

  get pdfPath(): string {
    return path.join(this.config.outDir, this.targetName + '.pdf');
  }

  get synctexPath(): string {
    return path.join(this.config.outDir, this.targetName + '.synctex');
  }

  get appInfo(): AppInfo {
    return {
      loggedIn: this.loggedIn,
      backend: this.config.backend,
      projectName: this.projectInfo?.title,
      projectId: this.projectInfo?.id ? String(this.projectInfo.id) : ''
    };
  }

  public async reload() {
    await this.manager.fileAdapter.loadFileList();
  }

  public async compile() {
    this.logger.info('compile...');
    try {
      const { pdfStream, logStream, synctexStream } = await this.manager.backend.compileProject();
      this.logger.info('Successfully Compiled.');
      // log
      this.manager.fileAdapter.saveAs(this.logPath, logStream);

      // download pdf
      this.manager.fileAdapter.saveAs(this.pdfPath, pdfStream).catch(err => {
        this.logger.error('Some error occurred with downloading the compiled pdf file.', err);
      }).then(() => {
        this.emit('successfully-compiled');
        return;
      });

      // download synctex
      if(synctexStream) {
        this.manager.fileAdapter.saveAs(this.synctexPath, synctexStream);
      }
    } catch(err) {
      console.error(err);
      this.logger.warn('Some error occured with compilation.', err);
    }
  }
}