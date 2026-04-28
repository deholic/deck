import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/#/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("설정 다이얼로그의 shadcn 선택과 스위치가 동작한다", async ({ page }) => {
  await page.getByRole("button", { name: "설정 열기" }).click();

  const settingsDialog = page.getByRole("dialog", { name: /설정/ });
  await expect(settingsDialog).toBeVisible();
  const dialogBox = await settingsDialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);

  await page.getByRole("combobox", { name: "테마 선택" }).click();
  await page.getByRole("option", { name: "모노톤" }).click();
  await expect(page.getByRole("combobox", { name: "테마 선택" })).toContainText("모노톤");

  await page.getByRole("combobox", { name: "색상 모드 선택" }).click();
  await page.getByRole("option", { name: "다크" }).click();
  await expect(page.getByRole("combobox", { name: "색상 모드 선택" })).toContainText("다크");

  const pomodoroSwitch = page.getByRole("switch", { name: "뽀모도로 타이머 표시" });
  await pomodoroSwitch.click();
  await expect(pomodoroSwitch).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "설정 닫기" }).click();
  await expect(page.getByRole("dialog", { name: /설정/ })).toBeHidden();
});

test("섹션 설정 패널의 shadcn 스위치와 선택 박스가 메뉴 스타일에 눌리지 않는다", async ({ page }) => {
  await page.evaluate(() => {
    const account = {
      id: "account-1",
      instanceUrl: "https://example.social",
      accessToken: "token",
      platform: "mastodon",
      name: "tester",
      displayName: "테스터",
      handle: "@tester@example.social",
      url: "https://example.social/@tester",
      avatarUrl: null,
      emojis: []
    };

    localStorage.setItem("textodon.accounts", JSON.stringify([account]));
    localStorage.setItem("textodon.accounts.lastUsedAt", String(Date.now()));
    localStorage.setItem("textodon.activeAccount", account.id);
    localStorage.setItem(
      "textodon.sections",
      JSON.stringify([
        {
          id: "section-1",
          accountId: account.id,
          timelineType: "home",
          settings: {
            showProfileImages: true,
            showCustomEmojis: true,
            showReactions: true,
            sectionSize: "medium"
          }
        }
      ])
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "섹션 메뉴 열기" }).click();
  await page.getByRole("button", { name: "섹션 설정" }).click();

  const settingsPanel = page.getByRole("dialog", { name: "섹션 설정" });
  await expect(settingsPanel).toBeVisible();
  await expect(settingsPanel.getByRole("switch", { name: "프로필 이미지 표시" })).toHaveCSS("width", "32px");
  await expect(settingsPanel.getByRole("combobox", { name: "섹션 폭 설정" })).toHaveCSS("width", "84px");
});

test("계정 추가 카드와 단축키 배지 UI가 렌더링된다", async ({ page }) => {
  await page.getByRole("button", { name: "계정 추가" }).click();
  await page.getByPlaceholder("mastodon.social").fill("mastodon.social");

  await expect(page.getByPlaceholder("mastodon.social")).toHaveValue("mastodon.social");
  await expect(page.getByRole("button", { name: "OAuth로 연결" })).toBeEnabled();

  await page.getByRole("button", { name: "계정 추가 닫기" }).click();
  await expect(page.getByPlaceholder("mastodon.social")).toHaveCount(0);

  await page.getByRole("link", { name: "단축키" }).click();

  await expect(page.getByRole("dialog", { name: "단축키" })).toBeVisible();
  await expect(page.locator('[data-slot="badge"].shortcut-key')).not.toHaveCount(0);
});
