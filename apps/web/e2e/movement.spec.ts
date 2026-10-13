import { test, expect } from "@playwright/test";

test.describe("Geospatial Movement Synchronization (Phase 2 Gate)", () => {
  test("two browser sessions join office and synchronize avatar movement in real-time", async ({
    browser,
  }) => {
    const timestamp = Date.now();
    const aliceEmail = `alice_${timestamp}@test.com`;
    const bobEmail = `bob_${timestamp}@test.com`;

    // 1. Create two isolated browser contexts (Alice and Bob)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // 2. Register & connect User 1 (Alice)
      await pageA.goto("/register");
      await pageA.fill('[data-testid="register-name"]', "Alice");
      await pageA.fill('[data-testid="register-email"]', aliceEmail);
      await pageA.fill('[data-testid="register-password"]', "password123");
      await pageA.click('[data-testid="register-submit"]');

      // Wait for Alice to enter office and connect to real-time gateway
      await expect(pageA).toHaveURL(/\/office\//, { timeout: 15000 });
      await expect(pageA.locator('[data-testid="connection-status"]')).toContainText(
        "Realtime Synced",
        { timeout: 15000 },
      );
      await expect(pageA.locator('[data-testid="local-avatar-pos"]')).toBeVisible();

      // Get Alice's initial position on pageA
      const initialPosTextA = await pageA
        .locator('[data-testid="local-avatar-pos"]')
        .innerText();
      const matchA = initialPosTextA.match(/Pos:\s*\((-?\d+),\s*(-?\d+)\)/);
      expect(matchA).not.toBeNull();
      const initialAliceX = parseInt(matchA![1], 10);
      const initialAliceY = parseInt(matchA![2], 10);

      // 3. Register & connect User 2 (Bob)
      await pageB.goto("/register");
      await pageB.fill('[data-testid="register-name"]', "Bob");
      await pageB.fill('[data-testid="register-email"]', bobEmail);
      await pageB.fill('[data-testid="register-password"]', "password123");
      await pageB.click('[data-testid="register-submit"]');

      // Wait for Bob to enter office and connect to real-time gateway
      await expect(pageB).toHaveURL(/\/office\//, { timeout: 15000 });
      await expect(pageB.locator('[data-testid="connection-status"]')).toContainText(
        "Realtime Synced",
        { timeout: 15000 },
      );
      await expect(pageB.locator('[data-testid="local-avatar-pos"]')).toBeVisible();

      // 4. Verify cross-client visibility in peer lists
      // On Alice's screen (pageA), Bob should appear as a colleague
      await expect(pageA.locator("text=Bob")).toBeVisible({ timeout: 10000 });

      // On Bob's screen (pageB), Alice should appear as a colleague
      await expect(pageB.locator("text=Alice")).toBeVisible({ timeout: 10000 });

      // 5. Test Alice moving Right (KeyD) and Bob observing the update
      await pageA.locator("canvas").click();
      await pageA.keyboard.down("KeyD");
      await pageA.waitForTimeout(600); // 600ms of right movement
      await pageA.keyboard.up("KeyD");

      // Give server 20 Hz broadcast cycle time to send update
      await pageA.waitForTimeout(200);

      // Verify Alice's local avatar moved right
      await expect
        .poll(
          async () => {
            const pos = await pageA.evaluate(() => {
              const state = (window as any).__OFFICE_STORE__?.getState();
              return state?.localAvatar?.position?.x ?? 0;
            });
            return pos;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(initialAliceX + 20);

      // Verify Bob observed Alice's movement synchronized via Socket.IO
      await expect
        .poll(
          async () => {
            const remoteAlice = await pageB.evaluate(() => {
              const state = (window as any).__OFFICE_STORE__?.getState();
              const remotes = state?.remoteAvatars ?? {};
              const alice = Object.values(remotes).find(
                (a: any) => a.displayName === "Alice",
              ) as any;
              return alice?.position?.x ?? 0;
            });
            return remoteAlice;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(initialAliceX + 20);

      // 6. Test Alice moving Down (KeyS) and Bob observing the update
      await pageA.keyboard.down("KeyS");
      await pageA.waitForTimeout(600); // 600ms of downward movement
      await pageA.keyboard.up("KeyS");
      await pageA.waitForTimeout(200);

      await expect
        .poll(
          async () => {
            const remoteAlice = await pageB.evaluate(() => {
              const state = (window as any).__OFFICE_STORE__?.getState();
              const remotes = state?.remoteAvatars ?? {};
              const alice = Object.values(remotes).find(
                (a: any) => a.displayName === "Alice",
              ) as any;
              return alice?.position?.y ?? 0;
            });
            return remoteAlice;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(initialAliceY + 20);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
