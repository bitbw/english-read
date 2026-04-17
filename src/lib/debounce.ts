export type Debounced<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void };

/** 尾部防抖；返回函数带 `cancel()`，用于卸载时清除待执行定时器。 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let t: ReturnType<typeof setTimeout> | null = null;
  function run(...args: A) {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  }
  run.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return run as Debounced<A>;
}
