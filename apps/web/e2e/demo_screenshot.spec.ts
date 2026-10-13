import { test } from "@playwright/test";
import path from "path";

const ARTIFACTS_DIR = "C:\\Users\\karthik\\.gemini\\antigravity-ide\\brain\\3c23c18d-1e56-4feb-90ef-ca9dbde21498";

test("Capture live application screenshots for user", async ({ page }) => {
  // 1. Landing Page
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_landing_page.png"),
    fullPage: true,
  });

  // 2. Register User "Karthik"
  await page.goto("/register");
  await page.fill('[data-testid="register-name"]', "Karthik");
  await page.fill('[data-testid="register-email"]', `karthik_${Date.now()}@proxispeak.local`);
  await page.fill('[data-testid="register-password"]', "password123");
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_register_form.png"),
  });
  await page.click('[data-testid="register-submit"]');

  // 3. Virtual Office Lobby
  await page.waitForURL(/\/office\//, { timeout: 15000 });
  await page.waitForSelector('[data-testid="local-avatar-pos"]', { timeout: 15000 });
  await page.waitForTimeout(1000); // Wait for canvas initial render
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_office_lobby.png"),
  });

  // 4. Movement on Canvas
  await page.locator("canvas").click();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyD");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_office_moved.png"),
  });

  // 5. Spatial Radar Tab
  await page.click("button:has-text('Spatial Radar')");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_office_spatial_radar.png"),
  });

  // 6. Telemetry Panel
  await page.click("button:has-text('Telemetry')");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "demo_office_diagnostics.png"),
  });
});
