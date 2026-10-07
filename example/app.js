'use strict';

const { randomBytes } = require('node:crypto');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const QuickBooks = require('../index');

function createExampleApp({ clientId, clientSecret, sessionSecret, redirectUri,
  useSandbox = true, fetchToken = fetch, QuickBooksClient = QuickBooks }) {
  if (!clientId || !clientSecret || !sessionSecret || !redirectUri) {
    throw new Error('Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, SESSION_SECRET and QBO_REDIRECT_URI.');
  }
  const app = express();
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: redirectUri.startsWith('https:') },
  }));

  app.get('/', (_req, res) => res.redirect('/start'));
  app.get('/start', (_req, res) => res.render('intuit', { accounts: null }));
  app.get('/authorize', (req, res, next) => {
    req.session.oauthState = randomBytes(32).toString('hex');
    const url = new URL('https://appcenter.intuit.com/connect/oauth2');
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: redirectUri,
      state: req.session.oauthState,
    }).toString();
    req.session.save((error) => error ? next(error) : res.redirect(url.toString()));
  });
  app.get('/callback', async (req, res) => {
    const { state, code, realmId } = req.query;
    if (typeof state !== 'string' || !req.session.oauthState ||
        state !== req.session.oauthState || typeof code !== 'string' ||
        typeof realmId !== 'string' || !code || !realmId) {
      res.status(400).send('Invalid or expired OAuth callback. Start a new connection.');
      return;
    }
    delete req.session.oauthState;
    try {
      await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
      const response = await fetchToken('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Token exchange failed');
      const token = await response.json();
      if (typeof token.access_token !== 'string' || !token.access_token) {
        throw new Error('No access token');
      }
      const qbo = new QuickBooksClient(clientId, clientSecret, token.access_token,
        false, realmId, useSandbox, false, null, '2.0', token.refresh_token);
      const accounts = await new Promise((resolve, reject) => {
        qbo.findAccounts((error, data) => error ? reject(error) : resolve(data.QueryResponse.Account || []));
      });
      res.render('intuit', { accounts });
    } catch (_error) {
      res.status(502).send('QuickBooks connection failed. Start a new connection.');
    }
  });
  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const app = createExampleApp({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    redirectUri: process.env.QBO_REDIRECT_URI,
    useSandbox: process.env.QBO_SANDBOX !== 'false',
  });
  app.listen(port, '127.0.0.1', () => console.log('QuickBooks example listening on http://localhost:' + port));
}

module.exports = { createExampleApp };
