"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_INFO_DESC = void 0;
exports.FILE_INFO_DESC = {
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