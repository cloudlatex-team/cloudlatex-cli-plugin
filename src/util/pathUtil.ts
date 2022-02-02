import * as path from 'path';

export const wildcard2regexp = (wildcardExp: string): RegExp => {
  return new RegExp(
    '^' + wildcardExp.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '$'
  );
};

export const isChild = (base: string, target: string): boolean => {
  const relative = path.posix.relative(base, target);
  return !relative.startsWith('..');
};