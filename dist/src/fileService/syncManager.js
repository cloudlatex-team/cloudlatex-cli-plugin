"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const EventEmitter = require("eventemitter3");
const _ = require("lodash");
const logger_1 = require("../util/logger");
class SyncManager extends EventEmitter {
    constructor(fileRepo, fileAdapter, decideSyncMode, logger) {
        super();
        this.fileRepo = fileRepo;
        this.fileAdapter = fileAdapter;
        this.decideSyncMode = decideSyncMode;
        this.logger = logger;
        this.syncing = false;
        this.fileChanged = false; // Whether any file (not folder) is changed
        this.syncSession = _.debounce(this._syncSession.bind(this), 5000, { trailing: true, leading: true });
    }
    _syncSession() {
        return __awaiter(this, void 0, void 0, function* () {
            this.fileChanged = false;
            if (this.syncing) {
                this.syncSession();
                return;
            }
            this.logger.log('Synchronizing files with server ...');
            this.syncing = true;
            try {
                const result = yield this.sync();
                if (result.success) {
                    this.logger.log('Successfully synchronized!');
                }
                else if (result.canceled) {
                    this.logger.log('Synchronizing is canceled');
                }
                this.syncing = false;
                this.emitSyncResult(result);
            }
            catch (e) {
                this.syncing = false;
                this.logger.log('Failed to sync: ' + logger_1.getErrorTraceStr(e));
                this.emitSyncResult({
                    success: false,
                    canceled: false,
                    fileChanged: this.fileChanged,
                    errors: [logger_1.getErrorTraceStr(e)]
                });
            }
        });
    }
    emitSyncResult(result) {
        this.emit('sync-finished', result);
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            const remoteFileList = yield this.fileAdapter.loadFileList();
            const remoteFileDict = remoteFileList.reduce((dict, file) => {
                if (file.remoteId === null) {
                    throw new Error('remoteId is null');
                }
                dict[file.remoteId] = file;
                return dict;
            }, {});
            // Reset remote change state and change location
            this.fileRepo.all().forEach(file => {
                file.remoteChange = 'no';
                file.changeLocation = 'no';
            });
            /*
             * Compare remote and local file
             */
            // Remote to local
            remoteFileList.forEach(remoteFile => {
                let file = this.fileRepo.findBy('remoteId', remoteFile.remoteId);
                if (!file) { // created in remote
                    file = this.fileRepo.new(remoteFile);
                    file.remoteChange = 'create';
                    return;
                }
                file.remoteRevision = remoteFile.remoteRevision;
                file.url = remoteFile.url;
                if (file.localRevision !== file.remoteRevision) { // updated in remote
                    file.remoteChange = 'update';
                }
                else if (file.relativePath !== remoteFile.relativePath) { // renamed in remote
                    if (file.localChange === 'no') {
                        // express rename as deleting original file and creating renamed file
                        file.remoteChange = 'delete';
                        const renamedFile = this.fileRepo.new(remoteFile);
                        renamedFile.remoteChange = 'create';
                    }
                    else if (file.localChange === 'create') {
                        this.logger.error(`Unexpected situation is detected: remote file is renamed and local file is created: ${file.relativePath}`);
                    }
                    else if (file.localChange === 'delete') {
                        this.logger.error(`Unsupported situation is detected: remote file is renamed and local file is deleted: ${file.relativePath}`);
                    }
                    else if (file.localChange === 'update') {
                        this.logger.error(`Unsupported situation is detected: remote file is renamed and local file is updated: ${file.relativePath}`);
                    }
                }
            });
            // Local to remote
            this.fileRepo.all().forEach(file => {
                let remoteFile = file.remoteId && remoteFileDict[file.remoteId];
                if (!remoteFile) { // remote file does not exist
                    if (file.remoteId) { // remote file is deleted
                        file.remoteChange = 'delete';
                        file.remoteId = null;
                    }
                }
                // update changeLocation
                if (file.remoteChange !== 'no' && file.localChange !== 'no') {
                    file.changeLocation = 'both';
                }
                else if (file.remoteChange !== 'no') {
                    file.changeLocation = 'remote';
                }
                else if (file.localChange !== 'no') {
                    file.changeLocation = 'local';
                }
            });
            this.fileRepo.save();
            let syncMode = 'download';
            if (this.fileRepo.findBy('changeLocation', 'both')) {
                try {
                    syncMode = yield this.decideSyncMode(this.fileRepo.where({ 'changeLocation': 'both' }));
                }
                catch (e) {
                    return {
                        success: false,
                        canceled: true,
                        fileChanged: this.fileChanged,
                        errors: []
                    };
                }
            }
            const results = yield new TasksExecuter(this.generateSyncTasks(syncMode)).execute();
            const fails = results.filter(result => !result.success);
            if (fails.length > 0) {
                return {
                    success: false,
                    canceled: false,
                    fileChanged: this.fileChanged,
                    errors: fails.map(result => result.message)
                };
            }
            return {
                success: true,
                canceled: false,
                fileChanged: this.fileChanged,
                errors: fails.map(result => result.message)
            };
        });
    }
    generateSyncTasks(remoteSyncMode) {
        const tasks = [];
        this.fileRepo.all().forEach(file => {
            if (file.changeLocation === 'remote' ||
                (file.changeLocation === 'both' && remoteSyncMode === 'download')) {
                tasks.push(this.syncWithRemoteTask(file));
                this.logger.log('Pull: ' + file.relativePath);
                if (!file.isFolder) {
                    this.fileChanged = true;
                }
            }
            else if (file.changeLocation === 'local' ||
                (file.changeLocation === 'both' && remoteSyncMode === 'upload')) {
                const task = this.syncWithLocalTask(file);
                tasks.push(task);
                this.logger.log(`Push: ${file.relativePath} ${task.name}`);
                if (!file.isFolder) {
                    this.fileChanged = true;
                }
            }
        });
        return tasks;
    }
    /**
     * Return task of applying local file change to remote file
     *
     * @param file FileInfo
     */
    syncWithLocalTask(file) {
        const priority = this.computePriority(file, 'local');
        switch (file.localChange) {
            case 'create':
                if (file.isFolder) {
                    return this.createPriorityTask('createRemoteFolder', file, priority);
                }
                return this.createPriorityTask('upload', file, priority);
            case 'update':
                if (file.remoteChange === 'delete') {
                    if (file.isFolder) {
                        return this.createPriorityTask('createRemoteFolder', file, priority);
                    }
                    return this.createPriorityTask('upload', file, priority);
                }
                return this.createPriorityTask('updateRemote', file, priority);
            case 'delete':
                if (file.remoteChange === 'delete') {
                    // The same file is already deleted both in local and remote.
                    this.fileRepo.delete(file.id);
                    this.fileRepo.save();
                    return this.createPriorityTask('no', file, priority);
                }
                return this.createPriorityTask('deleteRemote', file, priority);
            case 'no':
                return this.createPriorityTask('no', file, priority);
        }
    }
    /**
     * Return task of applying remote file change to local file
     *
     * @param file FileInfo
     */
    syncWithRemoteTask(file) {
        const priority = this.computePriority(file, 'remote');
        switch (file.remoteChange) {
            case 'create':
            case 'update':
                if (file.isFolder) {
                    return this.createPriorityTask('createLocalFolder', file, priority);
                }
                return this.createPriorityTask('download', file, priority);
            case 'delete':
                if (file.localChange === 'delete') {
                    // The same file is already deleted both in local and remote.
                    this.fileRepo.delete(file.id);
                    this.fileRepo.save();
                    return this.createPriorityTask('no', file, priority);
                }
                return this.createPriorityTask('deleteLocal', file, priority);
            case 'no':
                return this.createPriorityTask('no', file, priority);
        }
    }
    /**
     * Create priorityTask
     *
     * @param task syncTask
     * @param file file to sync
     * @param priority priority of the task
     */
    createPriorityTask(task, file, priority) {
        return new PriorityTask(this.wrapSyncTask(task, file), priority, task);
    }
    /**
     * Wrap sync task for exceptions
     *
     * @param syncTask
     * @param file FileInfo
     */
    wrapSyncTask(task, file) {
        return () => __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
            if (task === 'no') {
                return {
                    success: true,
                    message: '',
                };
            }
            try {
                yield this.fileAdapter[task](file);
            }
            catch (e) {
                return {
                    success: false,
                    message: `${task} : '${file.relativePath}' : ${file.url} : ${(e && e.stack || '')}`
                };
            }
            return {
                success: true,
                message: ''
            };
        });
    }
    /**
     * Compute priority to handle file change
     *
     * @param file FileInfo
     * @param syncDestination 'local' | 'remote'
     */
    computePriority(file, syncDestination) {
        let change = syncDestination === 'local' ?
            file.localChange :
            file.remoteChange;
        switch (change) {
            case 'create':
            case 'update':
                /*
                *  Creation priority is inversely correlated with the depth of the path
                *  because folder should be created from the root.
                *
                *  For example (priority : relativePath):
                *    0 : folder1/
                *    -1: folder1/folder2/
                *    -2: folder1/folder2/folder3/
                */
                return -(file.relativePath.split(path.posix.sep).length - 1);
            case 'delete':
                /*
                *  Deletion priority is correlated with the depth of the path
                *  because folder should be deleted from the deep end.
                *
                *  For example (priority : relativePath):
                *    2: folder1/folder2/folder3/
                *    1: folder1/folder2/
                *    0: folder1/
                */
                return file.relativePath.split(path.posix.sep).length - 1;
        }
        return 0; // Default priority is 0
    }
}
exports.default = SyncManager;
class PriorityTask {
    constructor(run, priority, name = '') {
        this.run = run;
        this.priority = priority;
        this.name = name;
    }
}
/*
 * TasksExecuter class
 *
 * Execute tasks which have the same priority concurently
 * and execute tasks which have different priority in series in order of the priority.
 */
class TasksExecuter {
    constructor(taskList) {
        this.taskList = taskList;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            const taskSeries = [];
            const sortedTaskList = this.taskList.sort((task1, task2) => task1.priority - task2.priority);
            // sortedTaskList[0] has lowest priority and sortedTaskList[-1] has highest priority.
            while (sortedTaskList.length > 0) {
                const priority = sortedTaskList[0].priority;
                const concurrentTasks = [];
                while (sortedTaskList.length > 0 && sortedTaskList[0].priority === priority) {
                    concurrentTasks.push(sortedTaskList.shift());
                }
                taskSeries.push(() => Promise.all(concurrentTasks.map(task => task.run())));
            }
            let task;
            while (task = taskSeries.pop()) {
                results.push(...yield task());
            }
            return results;
        });
    }
}
//# sourceMappingURL=syncManager.js.map