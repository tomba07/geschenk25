import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3000';
const DEV_ACCOUNT = {
  email: process.env.PLAYWRIGHT_DEV_EMAIL || 'dev.alex@geschenk.test',
  password: process.env.PLAYWRIGHT_DEV_PASSWORD || 'password123',
  username: 'dev_alex',
};

test.describe('Geschenk smoke tests', () => {
  test('shows the public landing page and password login form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Secret Santa, neatly organized' })).toBeVisible();
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('logs in with a seeded dev account and shows the sample group', async ({ page, request }) => {
    await signInAsDevUser(page, request);

    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();
    await expect(sampleGroupCard(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /New Group/ }).first()).toBeVisible();
  });

  test('opens the seeded group detail screen', async ({ page, request }) => {
    await signInAsDevUser(page, request);

    await sampleGroupCard(page).click();

    await expect(page.getByRole('button', { name: 'Back to groups' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open group details/ })).toContainText('Dev Gift Exchange');
    await expect(page.getByRole('heading', { name: 'Assignment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My Gift Ideas' })).toBeVisible();
  });

  test('keeps long gift idea lists compact and opens the full list in a dialog', async ({ page, request }) => {
    const session = await signInAsDevUser(page, request);
    const headers = { Authorization: `Bearer ${session.token}` };
    const groupsResponse = await request.get(`${API_URL}/api/groups`, { headers });
    expect(groupsResponse.ok()).toBeTruthy();
    const { groups } = await groupsResponse.json() as { groups: Array<{ id: number; name: string }> };
    const sampleGroup = groups.find((group) => group.name === 'Dev Gift Exchange');
    expect(sampleGroup).toBeTruthy();

    const ideasResponse = await request.get(`${API_URL}/api/groups/${sampleGroup!.id}/gift-ideas`, { headers });
    expect(ideasResponse.ok()).toBeTruthy();
    const { gift_ideas: existingIdeas } = await ideasResponse.json() as {
      gift_ideas: Array<{ id: number; created_by_id: number }>;
    };
    const existingOwnedIdeaCount = existingIdeas.filter((idea) => idea.created_by_id === session.user.id).length;
    const createdIdeaIds: number[] = [];

    try {
      for (let index = existingOwnedIdeaCount; index < 5; index += 1) {
        const createResponse = await request.post(`${API_URL}/api/groups/${sampleGroup!.id}/gift-ideas`, {
          headers,
          data: {
            for_user_id: session.user.id,
            idea: `Playwright overflow idea ${index + 1}`,
          },
        });
        expect(createResponse.ok()).toBeTruthy();
        const createdIdea = await createResponse.json() as { gift_idea: { id: number } };
        createdIdeaIds.push(createdIdea.gift_idea.id);
      }

      await sampleGroupCard(page).click();
      const myIdeasPanel = page.locator('.ideas-section');
      const viewMoreButton = myIdeasPanel.getByRole('button', { name: /View \d+ more ideas?/ });
      await expect(viewMoreButton).toBeVisible();
      await expect(myIdeasPanel.locator('.idea-native-card')).toHaveCount(4);

      await viewMoreButton.click();
      const dialog = page.getByRole('dialog', { name: 'My Gift Ideas' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.idea-native-card')).toHaveCount(Math.max(existingOwnedIdeaCount, 5));

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Add Idea' })).toBeVisible();
    } finally {
      await Promise.all(createdIdeaIds.map((ideaId) => (
        request.delete(`${API_URL}/api/groups/${sampleGroup!.id}/gift-ideas/${ideaId}`, { headers })
      )));
    }
  });

  test('navigates core authenticated screens', async ({ page, request }) => {
    await signInAsDevUser(page, request);

    await page.getByRole('button', { name: /^Friends$/ }).click();
    await expect(page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your friends' })).toBeVisible();
    await expect(page.getByText('@dev_bailey')).toBeVisible();

    await page.getByRole('button', { name: /^Settings$/ }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText(`@${DEV_ACCOUNT.username}`)).toBeVisible();

    await page.getByRole('button', { name: /^Dev$/ }).click();
    await expect(page.getByRole('heading', { name: 'Dev Admin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Group Workbench' })).toBeVisible();
  });
});

function sampleGroupCard(page: Page) {
  return page.getByRole('button', { name: /Dev Gift Exchange/ }).first();
}

async function signInAsDevUser(page: Page, request: APIRequestContext) {
  const session = await waitForDevSession(request);

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('geschenk.auth_token', token);
    window.localStorage.setItem('geschenk.auth_user', JSON.stringify(user));
    window.localStorage.setItem('geschenk.install_hint_dismissed', 'true');
    window.localStorage.setItem('geschenk.push_hint_dismissed', 'true');
  }, session);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();
  return session;
}

async function waitForDevSession(request: APIRequestContext) {
  const deadline = Date.now() + 30_000;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          email: DEV_ACCOUNT.email,
          password: DEV_ACCOUNT.password,
        },
      });

      if (response.ok()) {
        return await response.json() as {
          token: string;
          user: {
            id: number;
            email: string;
            username: string;
            image_url?: string | null;
            profile_complete?: boolean;
          };
        };
      }

      lastError = `${response.status()} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Could not log in as ${DEV_ACCOUNT.email}. Is the local API running and seeded? ${lastError}`);
}
