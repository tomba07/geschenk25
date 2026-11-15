const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const url = new URL(process.env.DATABASE_URL || 'http://missing');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_email_test')) {
  throw new Error('Use a dedicated local database ending in _email_test');
}
process.env.RESEND_API_KEY = 'test-key';
process.env.EMAIL_FROM = 'test@geschenk.dev';
process.env.DISABLE_EMAIL_DELIVERY = 'false';
process.env.APP_BASE_URL = 'https://geschenk.test';
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
const originalLog = console.log;
console.log = () => {}; // db startup currently logs connection configuration
const pool = require('../../apps/api/dist/db').default;
console.log = originalLog;
const { runMigrations } = require('../../apps/api/dist/migrate');
const notifications = require('../../apps/api/dist/utils/notifications');
let sent = [];
let fail = false;
const originalFetch = global.fetch;
global.fetch = async (url, init) => {
  assert.equal(url, 'https://api.resend.com/emails');
  sent.push({ ...JSON.parse(init.body), key: init.headers['Idempotency-Key'] });
  return { ok: !fail, text: async () => 'simulated failure' };
};
before(async () => { await runMigrations(); await runMigrations(); });
after(async () => { global.fetch = originalFetch; await pool.end(); });
async function fixture() {
  sent = []; fail = false;
  const { rows: [user] } = await pool.query("INSERT INTO users(email) VALUES ($1) RETURNING id", [`digest-${Date.now()}-${Math.random()}@geschenk.dev`]);
  return user.id;
}
const payload = { title: 'Friend request accepted', body: '@Alex accepted your friend request.', url: '/friends' };
async function due(user) { await pool.query("UPDATE pending_email_notifications SET send_after = NOW() - INTERVAL '1 minute' WHERE user_id=$1", [user]); }
async function cleanup(user) { await pool.query('DELETE FROM users WHERE id=$1', [user]); }

test('routine events combine into one digest, wait 12 hours, and respect the next 12-hour boundary', async () => {
  const user = await fixture();
  try {
    await notifications.sendNotificationToUser(user, payload);
    await notifications.sendNotificationToUser(user, { ...payload, title: 'Added to a group', body: 'You joined <Family>.' });
    assert.equal(sent.length, 0);
    await notifications.processPendingEmailNotifications();
    assert.equal(sent.length, 0);
    await due(user);
    await Promise.all([notifications.processPendingEmailNotifications(), notifications.processPendingEmailNotifications()]);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /accepted your friend request/);
    assert.match(sent[0].text, /You joined <Family>/);
    assert.match(sent[0].html, /&lt;Family&gt;/);
    await notifications.sendNotificationToUser(user, payload);
    await due(user);
    await notifications.processPendingEmailNotifications();
    assert.equal(sent.length, 1);
    await pool.query("UPDATE email_digest_deliveries SET last_sent_at=NOW()-INTERVAL '12 hours' WHERE user_id=$1", [user]);
    await notifications.processPendingEmailNotifications();
    assert.equal(sent.length, 2);
  } finally { await cleanup(user); }
});

test('read chats are removed; unread chats across groups share one digest', async () => {
  const user = await fixture();
  try {
    const assignments = [];
    for (const name of ['Family', 'Office', 'Read chat']) {
      const { rows: [group] } = await pool.query('INSERT INTO groups(name,created_by) VALUES($1,$2) RETURNING id', [name, user]);
      const { rows: [assignment] } = await pool.query('INSERT INTO assignments(group_id,giver_id,receiver_id) VALUES($1,$2,$2) RETURNING id', [group.id,user]);
      assignments.push(assignment.id);
      for (let i=0;i<2;i++) await notifications.queueEmailNotification({ userId:user,groupId:group.id,assignmentId:assignment.id,type:'assignment_chat_message',payload });
    }
    await notifications.cancelPendingAssignmentChatEmail(user, assignments[2]);
    await due(user);
    await notifications.processPendingEmailNotifications();
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /2 new Secret Santa messages in "Family"/);
    assert.match(sent[0].text, /2 new Secret Santa messages in "Office"/);
    assert.doesNotMatch(sent[0].text, /Read chat/);
  } finally { await cleanup(user); }
});

test('failed sends retain pending rows and retry with the same idempotency key', async () => {
  const user = await fixture();
  try {
    await notifications.sendNotificationToUser(user,payload); await due(user);
    fail=true;
    const log = console.error; console.error=()=>{};
    try { await notifications.processPendingEmailNotifications(); } finally { console.error=log; }
    assert.equal((await pool.query('SELECT * FROM email_digest_deliveries WHERE user_id=$1',[user])).rowCount,0);
    fail=false; await notifications.processPendingEmailNotifications();
    assert.equal(sent.length,2); assert.equal(sent[0].key,sent[1].key);
    await notifications.processPendingEmailNotifications(); assert.equal(sent.length,2);
  } finally { await cleanup(user); }
});

test('name-draw style immediate delivery bypasses digest while routine updates wait', async () => {
  const user = await fixture();
  try {
    await notifications.sendNotificationToUser(user,payload);
    await notifications.sendNotificationToUser(user,{title:'Names are drawn',body:'Ready'}, {immediateEmail:true});
    assert.equal(sent.length,1); assert.equal(sent[0].subject,'Names are drawn');
    assert.equal((await pool.query('SELECT * FROM pending_email_notifications WHERE user_id=$1 AND sent_at IS NULL',[user])).rowCount,1);
  } finally { await cleanup(user); }
});

test('unsubscribed recipients get no digest', async () => {
  const user = await fixture();
  try {
    await notifications.ensureNotificationPreferences(user);
    await pool.query('UPDATE notification_preferences SET email_enabled=false WHERE user_id=$1',[user]);
    await notifications.sendNotificationToUser(user,payload); await due(user);
    await notifications.processPendingEmailNotifications(); assert.equal(sent.length,0);
  } finally { await cleanup(user); }
});

test('a message arriving during delivery remains pending for the next digest', async () => {
  const user = await fixture();
  const fetch = global.fetch;
  let newMessage;
  try {
    const { rows: [group] } = await pool.query("INSERT INTO groups(name,created_by) VALUES('Family',$1) RETURNING id",[user]);
    const { rows: [assignment] } = await pool.query('INSERT INTO assignments(group_id,giver_id,receiver_id) VALUES($1,$2,$2) RETURNING id',[group.id,user]);
    const input = { userId:user,groupId:group.id,assignmentId:assignment.id,type:'assignment_chat_message',payload };
    await notifications.queueEmailNotification(input); await due(user);
    global.fetch = async (...args) => {
      newMessage = notifications.queueEmailNotification(input);
      return fetch(...args);
    };
    await notifications.processPendingEmailNotifications();
    await newMessage;
    assert.equal(sent.length,1);
    const pending = await pool.query('SELECT count FROM pending_email_notifications WHERE user_id=$1 AND sent_at IS NULL',[user]);
    assert.equal(pending.rowCount,1); assert.equal(pending.rows[0].count,1);
  } finally { global.fetch=fetch; await cleanup(user); }
});
