import type { EnvSnapshot, HostName } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const fallbackPlainRule: HostRule = {
  name: 'fallback-plain',
  match(snapshot: EnvSnapshot): HostRuleResult {
    const isPs = snapshot.names.some(n => n === 'PSModulePath' || n === 'POWERSHELL_DISTRIBUTION_CHANNEL');
    if (isPs) {
      return {
        host: 'powershell',
        kind: 'plain-terminal',
        confidence: 'high',
        matchedSignals: snapshot.names.filter(n => n === 'PSModulePath' || n === 'POWERSHELL_DISTRIBUTION_CHANNEL')
      };
    }

    const isBash = snapshot.names.some(n => n === 'BASH' || n === 'BASH_VERSION');
    if (isBash) {
      return {
        host: 'bash',
        kind: 'plain-terminal',
        confidence: 'high',
        matchedSignals: snapshot.names.filter(n => n === 'BASH' || n === 'BASH_VERSION')
      };
    }

    const isZsh = snapshot.names.some(n => n === 'ZSH_NAME' || n === 'ZSH_VERSION');
    if (isZsh) {
      return {
        host: 'zsh',
        kind: 'plain-terminal',
        confidence: 'high',
        matchedSignals: snapshot.names.filter(n => n === 'ZSH_NAME' || n === 'ZSH_VERSION')
      };
    }

    const isCmd = snapshot.names.some(n => n === 'PROMPT' || (snapshot.platform === 'win32' && n === 'COMSPEC'));
    if (isCmd) {
      return {
        host: 'cmd',
        kind: 'plain-terminal',
        confidence: 'medium',
        matchedSignals: snapshot.names.filter(n => n === 'PROMPT' || n === 'COMSPEC')
      };
    }

    let detectedHost: HostName = 'unknown';
    if (snapshot.isWsl) {
      detectedHost = 'bash';
    } else if (snapshot.platform === 'win32') {
      detectedHost = 'cmd';
    }

    return {
      host: detectedHost,
      kind: 'plain-terminal',
      confidence: detectedHost === 'unknown' ? 'low' : 'low',
      matchedSignals: []
    };
  }
};
