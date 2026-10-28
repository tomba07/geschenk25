import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3000';
const DEV_ACCOUNT = {
  email: process.env.PLAYWRIGHT_DEV_EMAIL || 'dev.alex@geschenk.test',
  password: process.env.PLAYWRIGHT_DEV_PASSWORD || 'password123',
  username: 'dev_alex',
};

test.describe('Geschenk smoke tests', () => {
  test('archives personally after a draw and restores without changing assignments', async ({ page, request }) => {
    const owner = await waitForDevSession(request);
    const member = await waitForDevSession(request, 'dev.bailey@geschenk.test');
    const third = await waitForDevSession(request, 'dev.casey@geschenk.test');
    const outsider = await waitForDevSession(request, 'dev.elliot@geschenk.test');
    const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
    const memberHeaders = { Authorization: `Bearer ${member.token}` };
    const name = `Archive test ${Date.now()}`;
    const created = await request.post(`${API_URL}/api/groups`, { headers: ownerHeaders, data: { name, member_ids: [member.user.id, third.user.id] } });
    expect(created.ok()).toBeTruthy();
    const { group } = await created.json();
    const url = `${API_URL}/api/groups/${group.id}`;
    try {
      expect((await request.post(`${url}/assign`, { headers: ownerHeaders })).ok()).toBeTruthy();
      const assignments = await (await request.get(`${url}/assignments`, { headers: ownerHeaders })).json();
      await installSession(page, member);
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(name) }).first().click();
      await page.getByRole('button', { name: 'Open group details' }).click();
      await expect(page.getByRole('button', { name: 'Leave Group', exact: true })).toHaveCount(0);
      await expect(page.getByText(/Contact the organizer/)).toBeVisible();
      await page.getByRole('button', { name: 'Archive group', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your gift exchanges' })).toBeVisible();
      await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
      await page.reload();
      await page.getByRole('button', { name: /^Archived/ }).click();
      await page.getByRole('button', { name: new RegExp(name) }).first().click();
      await expect(page.getByRole('heading', { name: 'Assignment', exact: true })).toBeVisible();
      const memberDetail = await (await request.get(url, { headers: memberHeaders })).json();
      const ownerDetail = await (await request.get(url, { headers: ownerHeaders })).json();
      expect(memberDetail.group.is_archived).toBe(true);
      expect(ownerDetail.group.is_archived).toBe(false);
      expect(await (await request.get(`${url}/assignments`, { headers: ownerHeaders })).json()).toEqual(assignments);
      expect((await request.patch(`${url}/archive`, { headers: { Authorization: `Bearer ${outsider.token}` }, data: { archived: true } })).status()).toBe(404);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Open group details' }).click();
      await page.getByRole('button', { name: 'Restore group', exact: true }).click();
      await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      expect((await request.patch(`${url}/archive`, { headers: ownerHeaders, data: { archived: true } })).ok()).toBeTruthy();
      expect((await (await request.get(url, { headers: ownerHeaders })).json()).group.is_archived).toBe(true);
    } finally {
      await request.delete(url, { headers: ownerHeaders });
    }
  });

  test('allows leaving before a draw and rejects archive access after leaving', async ({ request, page }) => {
    const owner = await waitForDevSession(request);
    const member = await waitForDevSession(request, 'dev.bailey@geschenk.test');
    const headers = { Authorization: `Bearer ${owner.token}` };
    const memberHeaders = { Authorization: `Bearer ${member.token}` };
    const created = await request.post(`${API_URL}/api/groups`, { headers, data: { name: `Leave test ${Date.now()}`, member_ids: [member.user.id] } });
    expect(created.ok()).toBeTruthy();
    const { group } = await created.json();
    const url = `${API_URL}/api/groups/${group.id}`;
    try {
      await installSession(page, member);
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(group.name) }).first().click();
      await page.getByRole('button', { name: 'Open group details' }).click();
      await expect(page.getByRole('button', { name: 'Leave Group', exact: true })).toBeVisible();
      expect((await request.patch(`${url}/archive`, { headers: memberHeaders, data: { archived: true } })).ok()).toBeTruthy();
      expect((await request.post(`${url}/leave`, { headers: memberHeaders })).ok()).toBeTruthy();
      expect((await request.get(url, { headers: memberHeaders })).status()).toBe(404);
      expect((await request.patch(`${url}/archive`, { headers: memberHeaders, data: { archived: false } })).status()).toBe(404);
      const listing = await (await request.get(`${API_URL}/api/groups`, { headers: memberHeaders })).json();
      expect(listing.groups.some((item: { id: number }) => item.id === group.id)).toBe(false);
      expect((await request.post(`${url}/leave`, { headers })).status()).toBe(400);
    } finally { await request.delete(url, { headers }); }
  });

  test('validates archive requests and makes repeated archive and restore safe', async ({ request }) => {
    const owner = await waitForDevSession(request);
    const headers = { Authorization: `Bearer ${owner.token}` };
    const created = await request.post(`${API_URL}/api/groups`, { headers, data: { name: `Archive validation ${Date.now()}` } });
    expect(created.ok()).toBeTruthy();
    const { group } = await created.json();
    const url = `${API_URL}/api/groups/${group.id}`;
    try {
      expect((await request.patch(`${url}/archive`, { data: { archived: true } })).status()).toBe(401);
      for (const data of [{}, { archived: 'true' }, { archived: null }, { archived: 1 }]) {
        expect((await request.patch(`${url}/archive`, { headers, data })).status()).toBe(400);
      }
      expect((await request.patch(`${API_URL}/api/groups/invalid/archive`, { headers, data: { archived: true } })).status()).toBe(400);
      for (const archived of [true, true, false, false]) {
        expect((await request.patch(`${url}/archive`, { headers, data: { archived } })).ok()).toBeTruthy();
        const detail = await (await request.get(url, { headers })).json();
        expect(detail.group.is_archived).toBe(archived);
        expect(detail.group.members.map((item: { id: number }) => item.id)).toEqual([owner.user.id]);
      }
    } finally { await request.delete(url, { headers }); }
  });

  test('organizer can reset, remove a participant and redraw while archive preserves messages and ideas', async ({ request }) => {
    const owner = await waitForDevSession(request);
    const member = await waitForDevSession(request, 'dev.bailey@geschenk.test');
    const third = await waitForDevSession(request, 'dev.casey@geschenk.test');
    const fourth = await waitForDevSession(request, 'dev.drew@geschenk.test');
    const headers = { Authorization: `Bearer ${owner.token}` };
    const memberHeaders = { Authorization: `Bearer ${member.token}` };
    const created = await request.post(`${API_URL}/api/groups`, { headers, data: { name: `Withdrawal ${Date.now()}`, member_ids: [member.user.id, third.user.id, fourth.user.id] } });
    expect(created.ok()).toBeTruthy();
    const { group } = await created.json();
    const url = `${API_URL}/api/groups/${group.id}`;
    try {
      expect((await request.post(`${url}/assign`, { headers })).ok()).toBeTruthy();
      expect((await request.post(`${url}/gift-ideas`, { headers: memberHeaders, data: { for_user_id: member.user.id, idea: 'A book' } })).ok()).toBeTruthy();
      const ideas = await (await request.get(`${url}/gift-ideas`, { headers: memberHeaders })).json();
      const { chats } = await (await request.get(`${url}/assignment-chats`, { headers: memberHeaders })).json();
      const chatUrl = `${url}/assignment-chats/${chats[0].assignment_id}/messages`;
      expect((await request.post(chatUrl, { headers: memberHeaders, data: { body: 'Still participating' } })).ok()).toBeTruthy();
      const messages = await (await request.get(chatUrl, { headers: memberHeaders })).json();
      expect((await request.patch(`${url}/archive`, { headers: memberHeaders, data: { archived: true } })).ok()).toBeTruthy();
      expect(await (await request.get(`${url}/gift-ideas`, { headers: memberHeaders })).json()).toEqual(ideas);
      expect(await (await request.get(chatUrl, { headers: memberHeaders })).json()).toEqual(messages);
      expect((await request.post(`${url}/leave`, { headers: memberHeaders })).status()).toBe(400);
      expect((await request.delete(`${url}/members/${member.user.id}`, { headers })).status()).toBe(400);
      expect((await request.delete(`${url}/assignments`, { headers: memberHeaders })).status()).toBe(403);
      expect((await request.delete(`${url}/assignments`, { headers })).ok()).toBeTruthy();
      expect((await request.delete(`${url}/members/${member.user.id}`, { headers })).ok()).toBeTruthy();
      expect((await request.post(`${url}/assign`, { headers })).ok()).toBeTruthy();
      const { assignments } = await (await request.get(`${url}/assignments`, { headers })).json();
      expect(assignments).toHaveLength(3);
      for (const assignment of assignments) {
        expect(assignment.giver_id).not.toBe(member.user.id);
        expect(assignment.receiver_id).not.toBe(member.user.id);
        expect(assignment.giver_id).not.toBe(assignment.receiver_id);
      }
      expect((await request.get(chatUrl, { headers: memberHeaders })).ok()).toBe(false);
    } finally { await request.delete(url, { headers }); }
  });

  test('creates a group with friends selected across searches', async ({ page, request }) => {
    const session = await signInAsDevUser(page, request);
    const headers = { Authorization: `Bearer ${session.token}` };
    const name = `Search selection ${Date.now()}`;
    let groupId: number | undefined;
    try {
      await page.getByRole('button', { name: 'New Group', exact: true }).first().click();
      const search = page.getByRole('searchbox', { name: 'Search friends' });
      await search.fill('  @DEV_BAILEY  ');
      await expect(page.locator('.create-friend-option')).toHaveCount(1);
      await page.locator('.create-friend-option').click();
      await search.fill('no-such-friend');
      await expect(page.getByRole('status')).toContainText('No friends match');
      await search.fill('casey');
      await page.locator('.create-friend-option').click();
      await search.fill('');
      await expect(page.getByRole('checkbox', { name: 'Add @dev_bailey', exact: true })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Add @dev_casey', exact: true })).toBeChecked();
      await search.press('Enter');
      await expect(page.getByRole('searchbox', { name: 'Search friends' })).toBeVisible();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'Add @dev_bailey', exact: true })).toBeChecked();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Group Name', { exact: true }).fill(name);
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/groups') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create Group', exact: true }).click();
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();
      groupId = (await response.json()).group.id;
      await expect(page.getByRole('heading', { name: 'Members (3)' })).toBeVisible();
      const detail = await (await request.get(`${API_URL}/api/groups/${groupId}`, { headers })).json();
      expect(detail.group.members.map((member: { username: string }) => member.username).sort()).toEqual(['dev_alex', 'dev_bailey', 'dev_casey']);
    } finally {
      if (groupId) await request.delete(`${API_URL}/api/groups/${groupId}`, { headers });
    }
  });

  test('exchange invite previews, login, pending privacy and organizer approval', async ({ page, request, browser }) => {
    const owner = await waitForDevSession(request);
    const guest = await waitForDevSession(request, 'dev.elliot@geschenk.test');
    const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
    const guestHeaders = { Authorization: `Bearer ${guest.token}` };
    const created = await request.post(`${API_URL}/api/groups`, { headers: ownerHeaders, data: { name: `Invite flow ${Date.now()}` } });
    expect(created.ok()).toBeTruthy();
    const { group } = await created.json(); const url = `${API_URL}/api/groups/${group.id}`;
    const ownerPage = await browser.newPage();
    try {
      const { invite_token: token } = await (await request.get(`${url}/invite-link`, { headers: ownerHeaders })).json();
      const preview = await (await request.get(`${API_URL}/api/groups/invite/${token}`)).json();
      expect(Object.keys(preview.invite).sort()).toEqual(['closed', 'id', 'name', 'organizer']);
      await page.goto(`/invite/${token}`);
      await expect(page.getByRole('heading', { name: `Join ${group.name}` })).toBeVisible();
      await page.getByRole('button', { name: 'Sign in to request to join' }).click();
      await page.getByLabel('Email', { exact: true }).fill('dev.elliot@geschenk.test');
      await page.getByLabel('Password', { exact: true }).fill(DEV_ACCOUNT.password);
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.getByRole('button', { name: 'Request to join', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Awaiting organizer approval');
      expect((await request.get(url, { headers: guestHeaders })).status()).toBe(404);
      const duplicate = await request.post(`${API_URL}/api/groups/join/${token}`, { headers: guestHeaders });
      expect((await duplicate.json()).status).toBe('pending');
      expect((await request.get(`${url}/join-requests`, { headers: guestHeaders })).status()).toBe(403);
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers: guestHeaders, data: { action: 'approve' } })).status()).toBe(403);
      await installSession(ownerPage, owner);
      await ownerPage.goto(`/groups/${group.id}`);
      await expect(ownerPage.getByRole('heading', { name: 'Join requests (1)' })).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Approve @dev_elliot' }).click();
      await expect(ownerPage.getByRole('heading', { name: 'Members (2)' })).toBeVisible();
      expect((await request.get(url, { headers: guestHeaders })).ok()).toBeTruthy();
      await page.reload();
      await page.getByRole('button', { name: 'Request to join', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/groups/${group.id}$`));
      await ownerPage.setViewportSize({ width: 390, height: 844 });
      await ownerPage.getByRole('button', { name: 'Invite people', exact: true }).click();
      await expect(ownerPage.getByLabel('Exchange invite link')).toHaveValue(new RegExp(`/invite/${token}$`));
      expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    } finally { await ownerPage.close(); await request.delete(url, { headers: ownerHeaders }); }
  });

  test('exchange invites enforce rejection cooldown, revocation and draw cutoff', async ({ request }) => {
    const owner = await waitForDevSession(request);
    const guest = await waitForDevSession(request, 'dev.elliot@geschenk.test');
    const second = await waitForDevSession(request, 'dev.bailey@geschenk.test');
    const third = await waitForDevSession(request, 'dev.casey@geschenk.test');
    const headers = { Authorization: `Bearer ${owner.token}` };
    const guestHeaders = { Authorization: `Bearer ${guest.token}` };
    const created = await request.post(`${API_URL}/api/groups`, { headers, data: { name: `Invite rules ${Date.now()}`, member_ids: [second.user.id, third.user.id] } });
    const { group } = await created.json(); const url = `${API_URL}/api/groups/${group.id}`;
    try {
      const { invite_token: oldToken } = await (await request.get(`${url}/invite-link`, { headers })).json();
      expect((await request.post(`${API_URL}/api/groups/join/${oldToken}`)).status()).toBe(401);
      expect((await request.patch(`${url}/invite-link`, { headers: guestHeaders, data: { action: 'disable' } })).status()).toBe(403);
      expect((await request.post(`${API_URL}/api/groups/join/${oldToken}`, { headers: guestHeaders })).ok()).toBeTruthy();
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers, data: { action: 'block' } })).ok()).toBeTruthy();
      const blocked = await request.post(`${API_URL}/api/groups/join/${oldToken}`, { headers: guestHeaders });
      expect(blocked.status()).toBe(403);
      expect(blocked.headers()['retry-after']).toBeUndefined();
      const requests = await (await request.get(`${url}/join-requests`, { headers })).json();
      expect(requests.requests).toContainEqual({ user_id: guest.user.id, username: guest.user.username, blocked: true });
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers: guestHeaders, data: { action: 'unblock' } })).status()).toBe(403);
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers, data: { action: 'unblock' } })).ok()).toBeTruthy();
      expect((await request.post(`${API_URL}/api/groups/join/${oldToken}`, { headers: guestHeaders })).ok()).toBeTruthy();
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers, data: { action: 'reject' } })).ok()).toBeTruthy();
      const declinedRetry = await request.post(`${API_URL}/api/groups/join/${oldToken}`, { headers: guestHeaders });
      expect(declinedRetry.status()).toBe(429);
      const wait = Number(declinedRetry.headers()['retry-after']);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(10);
      expect((await declinedRetry.json()).retry_after_seconds).toBe(wait);
      const reset = await request.patch(`${url}/invite-link`, { headers, data: { action: 'reset' } });
      const { invite_token: token } = await reset.json(); expect(token).not.toBe(oldToken);
      expect((await request.get(`${API_URL}/api/groups/invite/${oldToken}`)).status()).toBe(404);
      expect((await request.post(`${API_URL}/api/groups/join/${oldToken}`, { headers: guestHeaders })).status()).toBe(404);
      expect((await request.post(`${API_URL}/api/groups/join/${token}`, { headers: guestHeaders })).status()).toBe(429);
      await request.patch(`${url}/invite-link`, { headers, data: { action: 'disable' } });
      expect((await request.get(`${API_URL}/api/groups/invite/${token}`)).status()).toBe(404);
      expect((await request.post(`${API_URL}/api/groups/join/${token}`, { headers: guestHeaders })).status()).toBe(404);
      await request.patch(`${url}/invite-link`, { headers, data: { action: 'enable' } });
      expect((await request.post(`${url}/assign`, { headers })).ok()).toBeTruthy();
      expect((await (await request.get(`${API_URL}/api/groups/invite/${token}`)).json()).invite.closed).toBe(true);
      expect((await request.post(`${API_URL}/api/groups/join/${token}`, { headers: guestHeaders })).status()).toBe(409);
      expect((await request.patch(`${url}/join-requests/${guest.user.id}`, { headers, data: { action: 'approve' } })).status()).toBe(409);
    } finally { await request.delete(url, { headers }); }
  });

  test('limits concurrent join requests to ten per account', async ({ request }) => {
    const owner = await waitForDevSession(request);
    const guest = await waitForDevSession(request, 'dev.elliot@geschenk.test');
    const headers = { Authorization: `Bearer ${owner.token}` };
    const guestHeaders = { Authorization: `Bearer ${guest.token}` };
    const groups: { id: number; token: string }[] = [];
    try {
      for (let index = 0; index < 11; index++) {
        const created = await request.post(`${API_URL}/api/groups`, { headers, data: { name: `Request limit ${Date.now()}-${index}` } });
        expect(created.ok()).toBeTruthy();
        const { group } = await created.json();
        groups.push({ id: group.id, token: '' });
        const link = await request.get(`${API_URL}/api/groups/${group.id}/invite-link`, { headers });
        groups[index].token = (await link.json()).invite_token;
      }
      const responses = await Promise.all(groups.map(group => request.post(`${API_URL}/api/groups/join/${group.token}`, { headers: guestHeaders })));
      expect(responses.filter(response => response.status() === 200)).toHaveLength(10);
      expect(responses.filter(response => response.status() === 429)).toHaveLength(1);
      const acceptedIndex = responses.findIndex(response => response.status() === 200);
      const repeated = await request.post(`${API_URL}/api/groups/join/${groups[acceptedIndex].token}`, { headers: guestHeaders });
      expect((await repeated.json()).status).toBe('pending');
    } finally {
      for (const group of groups) await request.delete(`${API_URL}/api/groups/${group.id}`, { headers });
    }
  });

  test('keeps create-group search and actions fixed while friends scroll', async ({ page, request }) => {
    await signInAsDevUser(page, request);
    await page.route('**/api/friends', route => route.fulfill({ json: { friends: Array.from({ length: 40 }, (_, index) => ({ id: index + 10000, username: `scroll_friend_${index}` })) } }));
    await page.getByRole('button', { name: 'New Group', exact: true }).first().click();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 500 }]) {
      await page.setViewportSize(viewport);
      const search = page.getByRole('searchbox', { name: 'Search friends' });
      const next = page.getByRole('button', { name: 'Continue', exact: true });
      const before = await next.boundingBox();
      const list = page.locator('.create-friend-list');
      await expect(list).toHaveCSS('overflow-y', 'auto');
      expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(search).toBeInViewport();
      await expect(next).toBeInViewport();
      expect((await next.boundingBox())!.y).toBe(before!.y);
      expect(await page.locator('.create-friends-dialog').evaluate(element => element.scrollTop)).toBe(0);
    }
    await page.getByRole('searchbox', { name: 'Search friends' }).fill('not-a-match');
    await expect(page.getByRole('status')).toContainText('No friends match');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByLabel('Group Name', { exact: true })).toBeVisible();
  });

  test('skips friend selection with no friends and offers the exchange link after creation', async ({ page, request }) => {
    const session = await signInAsDevUser(page, request);
    const headers = { Authorization: `Bearer ${session.token}` };
    await page.route('**/api/friends', route => route.fulfill({ json: { friends: [] } }));
    await page.setViewportSize({ width: 390, height: 844 });
    let groupId: number | undefined;
    try {
      await page.getByRole('button', { name: 'Create new group', exact: true }).first().click();
      await expect(page.getByLabel('Group Name', { exact: true })).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Search friends' })).toHaveCount(0);
      await expect(page.getByText('Step 2 of 2', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Create new group', exact: true }).first().click();
      await page.getByLabel('Group Name', { exact: true }).fill(`No-friends exchange ${Date.now()}`);
      const created = page.waitForResponse(response => response.url().endsWith('/api/groups') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create Group', exact: true }).click();
      const response = await created;
      expect(response.ok()).toBeTruthy();
      groupId = (await response.json()).group.id;
      await expect(page.getByRole('heading', { name: 'Invite people', exact: true })).toBeVisible();
      await expect(page.getByLabel('Exchange invite link')).toHaveValue(/\/invite\/[a-f0-9]+$/);
      const detail = await (await request.get(`${API_URL}/api/groups/${groupId}`, { headers })).json();
      expect(detail.group.members).toHaveLength(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    } finally {
      if (groupId) await request.delete(`${API_URL}/api/groups/${groupId}`, { headers });
    }
  });

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
    const session = await signInAsDevUser(page, request);
    const groupsResponse = await request.get(`${API_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const { groups } = await groupsResponse.json() as {
      groups: Array<{ name: string; created_at: string; assignments_created: boolean }>;
    };
    const newestGroup = [...groups].sort((left, right) => (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    ))[0];

    await expect(page.getByRole('heading', { name: 'Your gift exchanges' })).toBeVisible();
    await expect(sampleGroupCard(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /New Group/ }).first()).toBeVisible();
    await expect(page.locator('.overview-featured-group')).toContainText(newestGroup.name);
    await expect(page.locator('.overview-featured-group')).toHaveCSS('background-image', /linear-gradient/);
    await expect(page.locator('.overview-group-status')).toHaveCount(groups.length);
    await expect(page.locator('.overview-group-status.drawn')).toHaveCount(groups.filter((group) => group.assignments_created).length);
    expect(groups.every((group) => typeof group.assignments_created === 'boolean')).toBeTruthy();

    await page.route('**/api/groups', async (route) => {
      const response = await route.fetch();
      const body = await response.json() as { groups: Array<Record<string, unknown>> };
      const legacyGroups = body.groups.map((group) => {
        const legacyGroup = { ...group };
        delete legacyGroup.assignments_created;
        delete legacyGroup.assignments_created_at;
        delete legacyGroup.assignment_receiver_username;
        return legacyGroup;
      });
      await route.fulfill({ response, json: { groups: legacyGroups } });
    });
    await page.reload();
    await expect(page.locator('.overview-group-status')).toHaveCount(groups.length);
    await expect(page.locator('.overview-group-status.drawn')).toHaveCount(groups.filter((group) => group.assignments_created).length);
    await expect(page.locator('.overview-group-status.unknown')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.overview-featured-action')).toBeVisible();
    await expect(page.locator('.overview-featured-action')).toHaveCSS('display', 'flex');
    await expect(page.locator('.overview-featured-action')).toHaveCSS('background-color', 'rgb(21, 89, 183)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test('opens the seeded group detail screen', async ({ page, request }) => {
    await signInAsDevUser(page, request);

    await sampleGroupCard(page).click();

    await expect(page.getByRole('button', { name: 'Back to groups' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open group details/ })).toContainText('Dev Gift Exchange');
    await expect(page.getByRole('heading', { name: 'Assignment' })).toBeVisible();
    await expect(page.locator('.assignments-section')).toHaveCSS('background-image', /linear-gradient/);
    await expect(page.getByRole('heading', { name: 'My Gift Ideas' })).toBeVisible();
    await expect(page.locator('.members-section').getByRole('heading', { name: /Members \(/ })).toBeVisible();
    await expect(page.locator('.members-section .pending-member-row').first()).toBeVisible();
  });

  test('shows the pending draw dashboard to owners and members', async ({ page, request, browser }) => {
    const ownerSession = await signInAsDevUser(page, request);
    const ownerHeaders = { Authorization: `Bearer ${ownerSession.token}` };
    const groupsResponse = await request.get(`${API_URL}/api/groups`, { headers: ownerHeaders });
    const { groups } = await groupsResponse.json() as { groups: Array<{ id: number; name: string }> };
    const sampleGroup = groups.find((group) => group.name === 'Dev Gift Exchange');
    expect(sampleGroup).toBeTruthy();

    const sampleGroupResponse = await request.get(`${API_URL}/api/groups/${sampleGroup!.id}`, { headers: ownerHeaders });
    const { group: sampleGroupDetails } = await sampleGroupResponse.json() as {
      group: { members: Array<{ id: number; username: string }> };
    };
    const invitedMembers = sampleGroupDetails.members.filter((member) => member.username !== DEV_ACCOUNT.username).slice(0, 2);
    expect(invitedMembers).toHaveLength(2);

    const groupName = `Pending Draw ${Date.now()}`;
    const createResponse = await request.post(`${API_URL}/api/groups`, {
      headers: ownerHeaders,
      data: {
        name: groupName,
        member_ids: invitedMembers.map((member) => member.id),
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { group: pendingGroup } = await createResponse.json() as { group: { id: number } };
    let memberPage: Page | null = null;

    try {
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(groupName) }).click();
      await expect(page.getByRole('heading', { name: 'Ready to draw names' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Members (3)' })).toBeVisible();
      await expect(page.getByText('Organizer / You')).toBeVisible();
      await expect(page.locator('.pending-member-row')).toHaveCount(3);
      await expect(page.locator('.pending-info-panel')).toHaveCSS('background-image', /linear-gradient/);
      const assignmentPanelBox = await page.locator('.assignments-section').boundingBox();
      const membersPanelBox = await page.locator('.members-section').boundingBox();
      const ideasPanelBox = await page.locator('.ideas-section').boundingBox();
      const infoPanelBox = await page.locator('.pending-info-panel').boundingBox();
      expect(assignmentPanelBox).not.toBeNull();
      expect(membersPanelBox).not.toBeNull();
      expect(ideasPanelBox).not.toBeNull();
      expect(infoPanelBox).not.toBeNull();
      const primaryColumnGap = membersPanelBox!.y - (assignmentPanelBox!.y + assignmentPanelBox!.height);
      const secondaryColumnGap = infoPanelBox!.y - (ideasPanelBox!.y + ideasPanelBox!.height);
      expect(primaryColumnGap).toBeGreaterThanOrEqual(20);
      expect(primaryColumnGap).toBeLessThanOrEqual(32);
      expect(secondaryColumnGap).toBeGreaterThanOrEqual(20);
      expect(secondaryColumnGap).toBeLessThanOrEqual(32);

      const memberSession = await waitForDevSession(request, 'dev.bailey@geschenk.test');
      memberPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await installSession(memberPage, memberSession);
      await memberPage.goto('/');
      await memberPage.getByRole('button', { name: new RegExp(groupName) }).click();
      await expect(memberPage.getByRole('heading', { name: 'Waiting for the name draw' })).toBeVisible();
      await expect(memberPage.getByRole('heading', { name: 'Members (3)' })).toBeVisible();
      await expect(memberPage.getByText('Member / You')).toBeVisible();
      await expect(memberPage.getByRole('heading', { name: 'How it works' })).toBeVisible();
      expect(await memberPage.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    } finally {
      await memberPage?.close();
      await request.delete(`${API_URL}/api/groups/${pendingGroup.id}`, { headers: ownerHeaders });
    }
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
      const dialogAddButton = dialog.locator('header').getByRole('button', { name: 'Add Idea' });
      await expect(dialogAddButton).toBeVisible();
      await expect(dialogAddButton).toHaveCSS('display', 'flex');
      await expect(dialog.locator('.idea-native-card .lucide-lightbulb').first()).toBeVisible();
      await expect(dialog.locator('.idea-native-card')).toHaveCount(Math.max(existingOwnedIdeaCount, 5));
      const firstTwoIconColors = await dialog.locator('.idea-card-icon').evaluateAll((icons) => (
        icons.slice(0, 2).map((icon) => getComputedStyle(icon).backgroundColor)
      ));
      expect(firstTwoIconColors[0]).not.toBe(firstTwoIconColors[1]);

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

  await installSession(page, session);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your gift exchanges' })).toBeVisible();
  return session;
}

async function installSession(page: Page, session: Awaited<ReturnType<typeof waitForDevSession>>) {
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('geschenk.auth_token', token);
    window.localStorage.setItem('geschenk.auth_user', JSON.stringify(user));
    window.localStorage.setItem('geschenk.install_hint_dismissed', 'true');
    window.localStorage.setItem('geschenk.push_hint_dismissed', 'true');
  }, session);
}

async function waitForDevSession(request: APIRequestContext, email = DEV_ACCOUNT.email) {
  const deadline = Date.now() + 30_000;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          email,
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

  throw new Error(`Could not log in as ${email}. Is the local API running and seeded? ${lastError}`);
}
