
import ClBackend from './cloudlatex/clBackend';
import { Config, Account } from './../types';
import IBackend from './ibackend';
import AccountService from '../service/accountService';

export default function backendSelector(config: Config, accountService: AccountService<Account>): IBackend {
  if (config.backend === 'cloudlatex') {
    return new ClBackend(config, accountService);
  } else {
    throw new Error('Unknown backend detected: ' + config.backend);
  }
}