export interface ClFile {
    is_folder: boolean;
    id: number;
    name: string;
    revision: string;
    size: number;
    mimetype: string;
    belonging_to: number;
    full_path: string;
    file_url: string;
    thumbnail_url?: string;
}
export interface CompileResult {
    exit_code: string;
    uri: string;
    synctex_uri: string;
    errors: Array<string>;
    warnings: Array<string>;
    log: string;
}
