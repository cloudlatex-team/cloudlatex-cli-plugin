"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadableString = exports.streamToString = void 0;
const stream_1 = require("stream");
function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        // stream.on('data', chunk => chunks.push(chunk.toString('utf-8')));
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        // stream.on('end', () => resolve(chunks.join()));
        // stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('end', () => {
            if (typeof chunks[0] === 'string') {
                resolve(chunks.map(chunk => chunk.toString('utf-8')).join());
            }
            else {
                resolve(Buffer.concat(chunks).toString('utf8'));
            }
        });
    });
}
exports.streamToString = streamToString;
class ReadableString extends stream_1.Readable {
    constructor(str) {
        super();
        this.str = str;
        this.sent = false;
    }
    _read() {
        if (!this.sent) {
            this.push(Buffer.from(this.str));
            this.sent = true;
        }
        else {
            this.push(null);
        }
    }
}
exports.ReadableString = ReadableString;
//# sourceMappingURL=util.js.map