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
export interface ResultError {
    error_log: string;
    url?: string;
    answer?: string;
    filename?: string;
    line?: number;
}
export interface ResultWarning {
    warning_log: string;
    url?: string;
    answer?: string;
    filename?: string;
    line?: number;
}
export interface CompileResult {
    exit_code: string;
    timestamp: number;
    synctex_uri: string;
    uri: string;
    errors: Array<ResultError>;
    warnings: Array<ResultWarning>;
    log: string;
}
