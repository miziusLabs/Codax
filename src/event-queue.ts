export class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly buffered: T[] = [];
  private bufferedOffset = 0;
  private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  constructor(private readonly maxBuffered = 10_000) {}

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    if (this.buffered.length - this.bufferedOffset >= this.maxBuffered) {
      throw new Error("Adapter event backlog exceeded");
    }
    this.buffered.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) this.waiters.shift()!({ value: undefined, done: true });
  }

  async collect(): Promise<T[]> {
    const values: T[] = [];
    for await (const value of this) values.push(value);
    return values;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.bufferedOffset < this.buffered.length) {
          const value = this.buffered[this.bufferedOffset++]!;
          // Avoid Array.shift()'s O(n) copy on every streamed event. Compact only after a
          // meaningful consumed prefix has accumulated, keeping steady-state dequeue amortized O(1).
          if (this.bufferedOffset >= 1_024 && this.bufferedOffset * 2 >= this.buffered.length) {
            this.buffered.splice(0, this.bufferedOffset);
            this.bufferedOffset = 0;
          }
          return Promise.resolve({ value, done: false });
        }
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise(resolve => this.waiters.push(resolve));
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
