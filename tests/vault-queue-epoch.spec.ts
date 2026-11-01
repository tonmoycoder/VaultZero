import { test, expect } from "@playwright/test";

test.describe("SerializedMutationQueue & Session Epoch Safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?unlocked=false");
  });

  test("runs tasks sequentially and maintains epoch consistency", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { SerializedMutationQueue } = await import("./src/lib/storage");
      const queue = new SerializedMutationQueue();

      const log: number[] = [];
      const task1 = queue.run(async () => {
        await new Promise((r) => setTimeout(r, 50));
        log.push(1);
        return "result-1";
      });

      const task2 = queue.run(async () => {
        log.push(2);
        return "result-2";
      });

      const res1 = await task1;
      const res2 = await task2;

      return {
        log,
        res1,
        res2,
        finalEpoch: queue.getEpoch(),
      };
    });

    expect(result.log).toEqual([1, 2]);
    expect(result.res1).toBe("result-1");
    expect(result.res2).toBe("result-2");
    expect(result.finalEpoch).toBe(0);
  });

  test("aborts queued mutation if epoch is bumped (vault locked) before or during task", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { SerializedMutationQueue } = await import("./src/lib/storage");
      const queue = new SerializedMutationQueue();

      let taskRan = false;
      let caughtError: any = null;

      // Start a slow task
      const slowTask = queue.run(async () => {
        await new Promise((r) => setTimeout(r, 60));
        return "slow-finished";
      });

      // Queue a second task that should be cancelled by epoch bump
      const secondTask = queue.run(async () => {
        taskRan = true;
        return "second-finished";
      }).catch((err) => {
        caughtError = err;
        return "caught";
      });

      // Bump epoch while slowTask is running (simulating vault lock)
      queue.bumpEpoch();

      await slowTask.catch(() => {});
      await secondTask;

      return {
        taskRan,
        errorCode: caughtError?.code,
        errorMessage: caughtError?.safeMessage,
        currentEpoch: queue.getEpoch(),
      };
    });

    expect(result.errorCode).toBe("LOCKED");
    expect(result.taskRan).toBe(false);
    expect(result.currentEpoch).toBe(1);
  });
});

