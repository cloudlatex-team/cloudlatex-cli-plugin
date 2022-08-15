import { Readable } from 'stream';

export function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = [];
  return new Promise((resolve, reject) => {
    // stream.on('data', chunk => chunks.push(chunk.toString('utf-8')));
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    // stream.on('end', () => resolve(chunks.join()));
    // stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('end', () => {
      if (typeof chunks[0] === 'string') {
        resolve(chunks.map(chunk => chunk.toString('utf-8')).join());

      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
  });
}

export class ReadableString extends Readable {
  private sent = false;

  constructor(private str: string) {
    super();
  }

  _read(): void {
    if (!this.sent) {
      this.push(Buffer.from(this.str));
      this.sent = true;
    }
    else {
      this.push(null);
    }
  }
}
