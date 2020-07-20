import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, ProjectInfo, AppInfo, DecideSyncMode } from './types';
import Manager from './fileManage/index';

// #TODO return from offline (will catch project info is not found error)
export default class LatexApp extends EventEmitter {
  private manager: Manager;
  public readonly appInfo: AppInfo;

  constructor(private config: Config, decideSyncMode: DecideSyncMode, private logger: Logger = new Logger()) {
    super();
    this.appInfo = {
      offline: false,
      conflictFiles: []
    };
    this.manager = new Manager(config,
      async (conflictFiles) => {
        this.appInfo.conflictFiles = conflictFiles;
        return decideSyncMode(conflictFiles);
      },
      relativePath => {
        if (!this.appInfo.projectName) {
          return ![this.config.outDir].includes(relativePath);
        }
        return ![this.config.outDir, this.logPath, this.pdfPath, this.synctexPath].includes(relativePath);
      },
      logger);
  }

  async launch() {
    await this.manager.init();
    this.manager.on('request-autobuild', () => {
      if (this.config.autoBuild) {
        this.compile();
      }
    });
    this.manager.on('offline', this.onOffline.bind(this));
    this.manager.on('online', this.onOnline.bind(this));
    await this.manager.startSync();
  }

  get targetName(): string {
    if (!this.appInfo.compileTarget) {
      this.logger.error('Project info is not defined');
      throw new Error('Project info is not defined');
    }
    const file = this.manager.fileRepo.findBy('remoteId', this.appInfo.compileTarget);
    if (!file) {
      this.logger.error('Target file is not found');
      throw new Error('Target file is not found');
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

  private onOnline() {
    this.appInfo.offline = false;
    this.emit('appinfo-updated');
  }

  private onOffline() {
    if (this.appInfo.offline) {
      return;
    }
    this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
    this.appInfo.offline = true;
    this.emit('appinfo-updated');
  }

  public async reload() {
    await this.manager.startSync();
  }

  public async compile() {
    this.emit('start-compile');
    try {
      if (!this.appInfo.compileTarget) {
        const projectInfo = await this.manager.backend.loadProjectInfo();
        this.appInfo.compileTarget = projectInfo.compile_target_file_id;
        this.appInfo.projectName = projectInfo.title;
      }

      const { pdfStream, logStream, synctexStream } = await this.manager.backend.compileProject();
      // log
      this.manager.fileAdapter.saveAs(this.logPath, logStream).catch(err => {
        this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
      });

      // download pdf
      this.manager.fileAdapter.saveAs(this.pdfPath, pdfStream).catch(err => {
        this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
      });

      // download synctex
      if (synctexStream) {
        this.manager.fileAdapter.saveAs(this.synctexPath, synctexStream).catch(err => {
          this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
        });
      }
    } catch (err) {
      this.logger.warn('Some error occured with compilation.' + JSON.stringify(err));
      this.emit('failed-compile');
      return;
    }
    this.emit('successfully-compiled');
  }
}