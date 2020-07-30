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
// TODO detect file changes
class SyncManager {
    constructor(fileRepo, fileAdapter, decideSyncMode, logger) {
        this.fileRepo = fileRepo;
        this.fileAdapter = fileAdapter;
        this.decideSyncMode = decideSyncMode;
        this.logger = logger;
        this.syncing = false;
        this.syncReserved = false;
        this.fileChanged = false; // Whether any file (not folder) is changed
    }
    syncSession() {
        return __awaiter(this, void 0, void 0, function* () {
            this.fileChanged = false;
            if (this.syncing) {
                this.syncReserved = true;
                this.logger.log('Sync session is reserved');
                return {
                    success: true,
                    fileChanged: false
                };
            }
            this.logger.log('Synchronizing files with server ...');
            this.syncing = true;
            try {
                yield this.sync();
            }
            catch (e) {
                this.syncing = false;
                this.logger.error('error in syncSession: ' + (e && e.stack));
                return {
                    success: false,
                    fileChanged: true
                };
            }
            this.syncing = false;
            if (this.syncReserved) {
                this.syncReserved = false;
                setTimeout(this.syncSession.bind(this), 0);
                return {
                    success: true,
                    fileChanged: false
                };
            }
            return {
                success: true,
                fileChanged: this.fileChanged
            };
            ;
        });
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
                }
                else {
                    file.remoteRevision = remoteFile.remoteRevision;
                    file.url = remoteFile.url;
                    if (file.localRevision !== file.remoteRevision) { // remote updated
                        file.remoteChange = 'update';
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
                syncMode = yield this.decideSyncMode(this.fileRepo.where({ 'changeLocation': 'both' }).map(file => file.relativePath));
            }
            yield new TasksExecuter(this.generateSyncTasks(syncMode)).execute();
        });
    }
    generateSyncTasks(remoteSyncMode) {
        const tasks = [];
        this.fileRepo.all().forEach(file => {
            if (file.changeLocation === 'remote' ||
                (file.changeLocation === 'both' && remoteSyncMode === 'download')) {
                tasks.push(this.syncWithRemoteTask(file));
                this.logger.log('pull: ' + file.relativePath);
                if (!file.isFolder) {
                    this.fileChanged = true;
                }
            }
            else if (file.changeLocation === 'local' ||
                (file.changeLocation === 'both' && remoteSyncMode === 'upload')) {
                tasks.push(this.syncWithLocalTask(file));
                this.logger.log('push: ' + file.relativePath);
                if (!file.isFolder) {
                    this.fileChanged = true;
                }
            }
        });
        return tasks;
    }
    syncWithLocalTask(file) {
        const priority = this.computePriority(file, 'local');
        switch (file.localChange) {
            case 'create':
                if (file.isFolder) {
                    return new PriorityTask(() => this.fileAdapter.createRemoteFolder(file), priority);
                }
                return new PriorityTask(() => this.fileAdapter.upload(file), priority);
            case 'update':
                if (file.remoteChange === 'delete') {
                    if (file.isFolder) {
                        return new PriorityTask(() => this.fileAdapter.createRemoteFolder(file), priority);
                    }
                    return new PriorityTask(() => this.fileAdapter.upload(file), priority);
                }
                return new PriorityTask(() => this.fileAdapter.updateRemote(file), priority);
            case 'delete':
                if (file.remoteChange === 'delete') {
                    // The same file is already deleted both in local and remote.
                    this.fileRepo.delete(file.id);
                    this.fileRepo.save();
                    return new PriorityTask(() => Promise.resolve(), priority);
                }
                return new PriorityTask(() => this.fileAdapter.deleteRemote(file), priority);
            case 'no':
                return new PriorityTask(() => Promise.resolve(), priority);
        }
    }
    syncWithRemoteTask(file) {
        const priority = this.computePriority(file, 'remote');
        switch (file.remoteChange) {
            case 'create':
            case 'update':
                if (file.isFolder) {
                    return new PriorityTask(() => this.fileAdapter.createLocalFolder(file), priority);
                }
                return new PriorityTask(() => this.fileAdapter.download(file), priority);
            case 'delete':
                if (file.localChange === 'delete') {
                    // The same file is already deleted both in local and remote.
                    this.fileRepo.delete(file.id);
                    this.fileRepo.save();
                    return new PriorityTask(() => Promise.resolve(), priority);
                }
                return new PriorityTask(() => this.fileAdapter.deleteLocal(file), priority);
            case 'no':
                return new PriorityTask(() => Promise.resolve(), priority);
        }
    }
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
                return -(file.relativePath.split(path.sep).length - 1);
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
                return file.relativePath.split(path.sep).length - 1;
        }
        return 0; // Default priority is 0
    }
}
exports.default = SyncManager;
class PriorityTask {
    constructor(run, priority) {
        this.run = run;
        this.priority = priority;
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
                yield task();
            }
        });
    }
}
//# sourceMappingURL=syncManager.js.map