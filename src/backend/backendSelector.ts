
import ClBackend from './cloudlatex/clBackend';
import { Config, Account } from './../types';
import IBackend from './ibackend';
import AccountManager from '../manager/accountManager';

export default function backendSelector(config: Config, accountManager: AccountManager<Account>): IBackend {
  if (config.backend === 'cloudlatex') {
    return new ClBackend(config, accountManager);
  } else {
    throw new Error('Unknown backend detected: ' + config.backend);
  }
}