import * as fs from 'fs';
import * as path from 'path';

export class AccountService<Account> {
  private _account: Account | null = null;
  constructor(private savePath?: string) {

  }

  /**
   * save account (if savePath is undefined, only stored on memmory)
   *
   * @param account account to save
   */
  public save(account: Account): Promise<void> {
    this._account = account;
    if (!this.savePath) {
      return Promise.resolve();
    }
    return fs.promises.writeFile(
      this.savePath.replace(new RegExp(path.posix.sep, 'g'), path.sep), JSON.stringify(account)
    );
  }

  /**
   * load account
   */
  public async load(): Promise<Account | null> {
    if (!this.savePath) {
      return this._account;
    }
    try {
      this._account = JSON.parse(
        await fs.promises.readFile(
          this.savePath.replace(new RegExp(path.posix.sep, 'g'), path.sep), 'utf-8')
      );
    } catch (e) {
      // No account file
    }
    return this._account;
  }

  public get account(): Account | null {
    return this._account;
  }
}
