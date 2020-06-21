
import ClBackend from './cloudlatex/clBackend';
import { Config } from './../types';
import Backend from './backend';

export default function backendSelector(config: Config): Backend {
  if(config.backend === 'cloudlatex') {
    return new ClBackend(config);
  } else {
    throw new Error('Unknown backend detected: ' + config.backend);
  }
}