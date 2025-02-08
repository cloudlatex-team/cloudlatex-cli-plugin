export function debounce(func: () => unknown, wait: number): () => void {
  let timeout: NodeJS.Timeout;
  return async () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func();
    }, wait);
  };

}