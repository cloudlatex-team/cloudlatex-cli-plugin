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
exports.AccountService = void 0;
const fs = require("fs");
const path = require("path");
class AccountService {
    constructor(savePath) {
        this.savePath = savePath;
        this._account = null;
    }
    /**
     * save account (if savePath is undefined, only stored on memmory)
     *
     * @param account account to save
     */
    save(account) {
        this._account = account;
        if (!this.savePath) {
            return Promise.resolve();
        }
        return fs.promises.writeFile(this.savePath.replace(new RegExp(path.posix.sep, 'g'), path.sep), JSON.stringify(account));
    }
    /**
     * load account
     */
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.savePath) {
                return this._account;
            }
            try {
                this._account = JSON.parse(yield fs.promises.readFile(this.savePath.replace(new RegExp(path.posix.sep, 'g'), path.sep), 'utf-8'));
            }
            catch (e) {
                // No account file
            }
            return this._account;
        });
    }
    get account() {
        return this._account;
    }
}
exports.AccountService = AccountService;
//# sourceMappingURL=accountService.js.map