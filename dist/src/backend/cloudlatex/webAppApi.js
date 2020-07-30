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
const node_fetch_1 = require("node-fetch");
const FormData = require("form-data");
class CLWebAppApi {
    constructor(config, accountManager) {
        this.config = config;
        this.accountManager = accountManager;
        this.APIRoot = config.endpoint;
        this.APIProjects = config.endpoint + '/projects';
    }
    headers(option = {}) {
        if (!this.accountManager.account) {
            throw new Error('account is not defined');
        }
        const headers = {
            'uid': this.accountManager.account.email,
            'access-token': this.accountManager.account.token,
            'client': this.accountManager.account.client,
        };
        if (option.json) {
            headers['Content-Type'] = 'application/json';
        }
        if (option.form) {
            headers['Content-Type'] = 'multipart/form-data';
        }
        return headers;
    }
    validateToken() {
        return __awaiter(this, void 0, void 0, function* () {
            let headers;
            try {
                headers = this.headers();
            }
            catch (err) {
                return false; // account is not defined;
            }
            const res = yield node_fetch_1.default(`${this.APIRoot}/auth/validate_token`, { headers });
            if (!res.ok) {
                return false;
            }
            const json = yield res.json();
            return !!json['success'];
        });
    }
    loadProjects() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(this.APIProjects, { headers: this.headers() });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.json());
        });
    }
    loadProjectInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}`, { headers: this.headers() });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            const text = yield res.text();
            return JSON.parse(text)['project'];
        });
    }
    loadFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/files`, { headers: this.headers() });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    createFile(name, belonging_to, is_folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/files`, { headers: this.headers({ json: true }),
                method: 'POST',
                body: JSON.stringify({ name, is_folder, belonging_to }) });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    deleteFile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/files/${id}`, { headers: this.headers(),
                method: 'DELETE' });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    updateFile(id, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/files/${id}`, { headers: this.headers({ json: true }),
                body: JSON.stringify({ material_file: params }),
                method: 'PUT' });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    compileProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/compile`, { headers: this.headers(),
                method: 'POST' });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    uploadFile(stream, relativeDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new FormData();
            form.append('relative_path', relativeDir);
            form.append('file', stream);
            const headers = form.getHeaders();
            const res = yield node_fetch_1.default(`${this.APIProjects}/${this.config.projectId}/files/upload`, { headers: Object.assign(Object.assign({}, this.headers()), headers), body: form,
                method: 'POST' });
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return JSON.parse(yield res.text());
        });
    }
    download(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${url}`);
            if (!res.ok) {
                throw new Error(JSON.stringify(res));
            }
            return res.body;
        });
    }
    loadSynctexObject(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${url}`);
            return yield res.arrayBuffer();
        });
    }
}
exports.default = CLWebAppApi;
;
//# sourceMappingURL=webAppApi.js.map