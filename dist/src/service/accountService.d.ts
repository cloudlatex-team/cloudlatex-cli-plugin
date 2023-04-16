export declare class AccountService<Account> {
    private savePath?;
    private _account;
    constructor(savePath?: string | undefined);
    /**
     * save account (if savePath is undefined, only stored on memmory)
     *
     * @param account account to save
     */
    save(account: Account): Promise<void>;
    /**
     * load account
     */
    load(): Promise<Account | null>;
    get account(): Account | null;
}
