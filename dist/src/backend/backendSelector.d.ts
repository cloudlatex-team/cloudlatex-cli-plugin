import { Config, Account } from './../types';
import Backend from './backend';
import AccountManager from '../accountManager';
export default function backendSelector(config: Config, accountManager: AccountManager<Account>): Backend;
