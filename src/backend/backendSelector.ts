
import ClBackend from './cloudlatex/clBackend';
import { Config, Account } from './../types';
import Backend from './backend';
import AccountManager from '../accountManager';

export default function backendSelector(config: Config, accountManager: AccountManager<Account>): Backend {
  if (config.backend === 'cloudlatex') {
    return new ClBackend(config, accountManager);
  } else {
    throw new Error('Unknown backend detected: ' + config.backend);
  }
}