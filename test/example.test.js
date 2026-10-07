'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createExampleApp } = require('../example/app');

describe('QuickBooks OAuth example', function () {
  let server, base, tokenCalls, failToken, constructed;

  beforeEach(async function () {
    tokenCalls = 0;
    failToken = false;
    constructed = null;
    const app = createExampleApp({
      clientId: 'test-client', clientSecret: 'test-secret',
      sessionSecret: 'test-session-secret', redirectUri: 'http://localhost/callback',
      fetchToken: async (url, options) => {
        tokenCalls++;
        assert.equal(url, 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
        assert.equal(options.body.get('grant_type'), 'authorization_code');
        assert.equal(options.body.get('code'), 'test-code');
        assert.equal(options.body.get('redirect_uri'), 'http://localhost/callback');
        assert.equal(options.headers.authorization, 'Basic ' + Buffer.from('test-client:test-secret').toString('base64'));
        return { ok: !failToken, json: async () => ({ access_token: 'ACCESS_SECRET', refresh_token: 'REFRESH_SECRET' }) };
      },
      QuickBooksClient: function (...args) {
        constructed = args;
        this.findAccounts = (callback) => callback(null, { QueryResponse: { Account: [{ Name: '<script>unsafe</script>' }] } });
      },
    });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port;
  });

  afterEach(async function () {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  async function authorize() {
    const response = await fetch(base + '/authorize', { redirect: 'manual' });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.origin + url.pathname, 'https://appcenter.intuit.com/connect/oauth2');
    assert.equal(url.searchParams.get('scope'), 'com.intuit.quickbooks.accounting');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost/callback');
    const state = url.searchParams.get('state');
    assert.match(state, /^[a-f0-9]{64}$/);
    return { state, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  it('renders the connection page without obsolete remote scripts', async function () {
    const response = await fetch(base + '/start');
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/authorize"/);
    assert.doesNotMatch(html, /ipp\.anywhere|<script/);
  });

  it('rejects callbacks without a matching session before exchanging tokens', async function () {
    const { cookie } = await authorize();
    const response = await fetch(base + '/callback?code=test-code&realmId=123&state=forged', { headers: { cookie } });
    assert.equal(response.status, 400);
    assert.equal(tokenCalls, 0);
  });

  it('uses OAuth 2.0, escapes account names and rejects callback replay', async function () {
    const { state, cookie } = await authorize();
    const callback = base + '/callback?' + new URLSearchParams({ state, code: 'test-code', realmId: '123' });
    const response = await fetch(callback, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(html, /ACCESS_SECRET|REFRESH_SECRET/);
    assert.equal(constructed[3], false);
    assert.equal(constructed[4], '123');
    assert.equal(constructed[6], false);
    assert.equal(constructed[8], '2.0');
    const replay = await fetch(callback, { headers: { cookie } });
    assert.equal(replay.status, 400);
    assert.equal(tokenCalls, 1);
  });

  it('consumes state and returns a generic error when the token exchange fails', async function () {
    failToken = true;
    const { state, cookie } = await authorize();
    const callback = base + '/callback?' + new URLSearchParams({ state, code: 'test-code', realmId: '123' });
    const response = await fetch(callback, { headers: { cookie } });
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /test-secret|ACCESS_SECRET/);
    assert.equal((await fetch(callback, { headers: { cookie } })).status, 400);
  });
});
