import { Config, Account } from './../types';
import { IBackend } from './ibackend';
import { AccountService } from '../service/accountService';
export declare function backendSelector(config: Config, accountService: AccountService<Account>): IBackend;
