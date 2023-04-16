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
exports.CLWebAppApi = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const node_fetch_1 = require("node-fetch");
const FormData = require("form-data");
class CLWebAppApi {
    constructor(config, accountService) {
        this.config = config;
        this.accountService = accountService;
        this.apiRoot = config.endpoint;
        this.apiProjects = config.endpoint + '/projects';
    }
    headers(option = {}) {
        if (!this.accountService.account) {
            throw new Error('account is not defined');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers = {
            'uid': this.accountService.account.email,
            'access-token': this.accountService.account.token,
            'client': this.accountService.account.client,
        };
        if (option.json) {
            headers['Content-Type'] = 'application/json';
        }
        if (option.form) {
            headers['Content-Type'] = 'multipart/form-data';
        }
        return headers;
    }
    fetchOption(option = {}) {
        const params = {
            headers: Object.assign(Object.assign({}, this.headers(option && option.headerOption)), (option.headers || {}))
        };
        if (option.method) {
            params.method = option.method;
        }
        if (option.body) {
            params.body = option.body;
        }
        return params;
    }
    validateToken() {
        return __awaiter(this, void 0, void 0, function* () {
            let params;
            try {
                params = this.fetchOption();
            }
            catch (err) {
                return false; // account is not defined;
            }
            const res = yield node_fetch_1.default(`${this.apiRoot}/auth/validate_token`, params);
            if (!res.ok) {
                return false;
            }
            const json = (yield res.json());
            return !!json['success'];
        });
    }
    loadProjects() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(this.apiProjects, this.fetchOption());
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse((yield res.json()));
        });
    }
    loadProjectInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}`, this.fetchOption());
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            const text = yield res.text();
            return JSON.parse(text)['project'];
        });
    }
    loadFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/files`, this.fetchOption());
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse(yield res.text());
        });
    }
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    createFile(name, belonging_to, is_folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/files`, this.fetchOption({
                method: 'POST',
                body: JSON.stringify({ name, is_folder, belonging_to }),
                headerOption: { json: true }
            }));
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse(yield res.text());
        });
    }
    deleteFile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/files/${id}`, this.fetchOption({ method: 'DELETE' }));
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse(yield res.text());
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    updateFile(id, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/files/${id}`, this.fetchOption({
                method: 'PUT',
                body: JSON.stringify({ material_file: params }),
                headerOption: { json: true }
            }));
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse(yield res.text());
        });
    }
    compileProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/compile`, this.fetchOption({
                method: 'POST',
            }));
            if (!res.ok) {
                throw new Error(yield res.text());
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
            const res = yield node_fetch_1.default(`${this.apiProjects}/${this.config.projectId}/files/upload`, this.fetchOption({
                method: 'POST',
                body: form,
                headers
            }));
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            return JSON.parse(yield res.text());
        });
    }
    download(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(`${url}`);
            if (!res.ok) {
                throw new Error(yield res.text());
            }
            if (!res.body) {
                throw new Error('res.body is null');
            }
            return res.body;
        });
    }
    downdloadPreview(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield node_fetch_1.default(url, this.fetchOption());
            if (!res.body) {
                throw new Error('res.body is null');
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
exports.CLWebAppApi = CLWebAppApi;
//# sourceMappingURL=webAppApi.js.map