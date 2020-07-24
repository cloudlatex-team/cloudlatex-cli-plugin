"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileInfoDesc = void 0;
exports.FileInfoDesc = {
    name: 'FileInfo',
    columns: {
        id: 0,
        isFolder: false,
        relativePath: '',
        url: '',
        remoteRevision: '',
        localRevision: '',
        localChange: 'no',
        remoteChange: 'no',
        changeLocation: 'no',
        remoteId: null,
        watcherSynced: false
    },
    primaryKey: 'id',
    indexColumns: ['remoteId'],
    autoIncrement: true
};
//# sourceMappingURL=fileModel.js.map