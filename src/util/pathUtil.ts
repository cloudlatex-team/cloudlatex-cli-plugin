import path from 'path';

export const isChild = (base: string, target: string): boolean => {
  const relative = path.posix.relative(base, target);
  return !relative.startsWith('..');
};