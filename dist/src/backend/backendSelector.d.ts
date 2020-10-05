import { Config, Account } from './../types';
import IBackend from './ibackend';
import AccountService from '../service/accountService';
export default function backendSelector(config: Config, accountService: AccountService<Account>): IBackend;
