import { expect, test } from "bun:test";
import { AsyncEventQueue } from "../src/event-queue";

test("adapter event queue preserves order across large buffered drains", async () => {
  const queue = new AsyncEventQueue<number>(2_000);
  for (let index = 0; index < 1_500; index += 1) queue.push(index);
  queue.close();

  expect(await queue.collect()).toEqual(Array.from({ length: 1_500 }, (_unused, index) => index));
});

test("adapter event queue bounds only the unread backlog", async () => {
  const queue = new AsyncEventQueue<number | undefined>(2);
  queue.push(undefined);
  queue.push(1);
  expect(() => queue.push(2)).toThrow("Adapter event backlog exceeded");

  const iterator = queue[Symbol.asyncIterator]();
  expect(await iterator.next()).toEqual({ value: undefined, done: false });
  queue.push(2);
  queue.close();

  expect(await iterator.next()).toEqual({ value: 1, done: false });
  expect(await iterator.next()).toEqual({ value: 2, done: false });
  expect(await iterator.next()).toEqual({ value: undefined, done: true });
});
