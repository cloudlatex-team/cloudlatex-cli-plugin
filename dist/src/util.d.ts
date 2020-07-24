/// <reference types="node" />
import { Readable } from 'stream';
export declare function streamToString(stream: NodeJS.ReadableStream): Promise<string>;
export declare class ReadableString extends Readable {
    private str;
    private sent;
    constructor(str: string);
    _read(): void;
}
