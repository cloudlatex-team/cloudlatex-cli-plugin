
import { ClBackend } from './cloudlatex/clBackend.ts';
import { Config, Account } from './../types.ts';
import { IBackend } from './ibackend.ts';
import { AccountService } from '../service/accountService.ts';

export function backendSelector(config: Config, accountService: AccountService<Account>): IBackend {
  if (config.backend === 'cloudlatex') {
    return new ClBackend(config, accountService);
  } else {
    throw new Error('Unknown backend detected: ' + config.backend);
  }
}