import fetch, { RequestInit, Headers } from 'node-fetch';
import * as https from 'https';
import { CompileResult } from './types';
import * as FormData from 'form-data';
import { Config, ProjectInfo, Account } from '../../types';
import AccountManager from '../../accountManager';

export default class CLWebAppApi {
  private APIRoot: string;
  private APIProjects: string;
  constructor(private config: Config, private accountManager: AccountManager<Account>) {
    this.APIRoot = config.endpoint;
    this.APIProjects = config.endpoint + '/projects';
  }

  private headers(option: {json?: boolean, form?: boolean} = {}): Headers {
    if (!this.accountManager.account) {
      throw new Error('account is not defined');
    }
    const headers: any = {
      'uid': this.accountManager.account.email,
      'access-token': this.accountManager.account.token,
      'client': this.accountManager.account.client,
      // 'accept-language': 'ja,en-US;q=0.9,en;q=0.8'
    };
    if (option.json) {
      headers['Content-Type'] = 'application/json';
    }
    if (option.form) {
      headers['Content-Type'] = 'multipart/form-data';
    }
    return headers;
  }

  private fetchOption(option: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    headerOption?: {json?: boolean, form?: boolean},
    headers?: Headers | { [key: string]: string;}
  } = {}): RequestInit {
    const params: RequestInit = {
      headers: {
        ... this.headers(option && option.headerOption),
        ... (option.headers || {})
      }
    };
    if (option.method) {
      params.method = option.method;
    }
    if (option.body) {
      params.body = option.body;
    }

    // Use insecure mode in qa env
    if (this.APIRoot === 'https://qa.cloudlatex.io/api') {
      params.agent = new https.Agent({
        rejectUnauthorized: false,
      });
    }
    return params;
  }

  async validateToken() {
    let params;
    try {
      params = this.fetchOption();
    } catch (err) {
      console.error(err);
      return false; // account is not defined;
    }
    const res = await fetch(`${this.APIRoot}/auth/validate_token`, params);
    if (!res.ok) {
      return false;
    }
    const json = await res.json();
    return !!json['success'];
  }

  async loadProjects() {
    const res = await fetch(this.APIProjects, this.fetchOption());
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.json());
  }

  async loadProjectInfo() {
    const res = await fetch(`${this.APIProjects}/${this.config.projectId}`, this.fetchOption() );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    const text = await res.text();
    return JSON.parse(text)['project'] as ProjectInfo;
  }

  async loadFiles() {
    const res = await fetch(`${this.APIProjects}/${this.config.projectId}/files`, this.fetchOption() );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async createFile(name: string, belonging_to: number | null, is_folder: boolean) {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files`,
      this.fetchOption({
        method: 'POST',
        body: JSON.stringify({ name, is_folder, belonging_to }),
        headerOption: { json: true } })
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async deleteFile(id: number) {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/${id}`,
      this.fetchOption({ method: 'DELETE' })
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async updateFile(id: number, params: any): Promise<{revision: string}> {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/${id}`,
      this.fetchOption({
        method: 'PUT',
        body: JSON.stringify({ material_file: params }),
        headerOption: { json: true }
      })
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async compileProject(): Promise<CompileResult> {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/compile`,
      this.fetchOption({
        method: 'POST',
      })
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async uploadFile(stream: NodeJS.ReadableStream, relativeDir: string) {
    const form = new FormData();
    form.append('relative_path', relativeDir);
    form.append('file', stream);
    const headers = form.getHeaders();
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/upload`,
      this.fetchOption({
        method: 'POST',
        body: form,
        headers
      })

    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async download(url: string): Promise<NodeJS.ReadableStream> {
    const res = await fetch(
      `${url}`
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return res.body;
  }

  async loadSynctexObject(url: string) {
    const res = await fetch(
      `${url}`
    );
    return await res.arrayBuffer();
  }
};
