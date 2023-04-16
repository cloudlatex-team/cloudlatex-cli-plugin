declare function fsStub(files: Record<string, string>): void;
declare namespace fsStub {
    var restore: () => void;
}
export default fsStub;
