# QuickBooks OAuth 2.0 example

This local example uses the SDK in the parent checkout, patched EJS, and Node's
built-in `fetch`. It no longer installs the obsolete public SDK or `request`.
Use the Node/npm versions configured for this repository's CI.

From the repository root, run `npm ci` and `npm ci --prefix example`. Register
`http://localhost:3000/callback` as your Intuit development app's redirect URI,
then set `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `SESSION_SECRET` (a randomly
generated secret), and `QBO_REDIRECT_URI` to that same URI in your environment.
Run `npm start --prefix example` and open http://localhost:3000.

The example uses a sandbox company by default. Set `QBO_SANDBOX=false` only
when using your production Intuit app's credentials. Tokens stay on the server
and are never logged or rendered. The callback validates one-time session
state, exchanges the code, and lists account names through the local SDK.

This is a local demonstration: Express's in-memory session store does not
persist connections or refresh tokens. A hosted integration needs a persistent
session/token store and appropriate HTTPS/proxy configuration.

Run `npm run test:example` after installing the example dependencies. CI runs
the example tests and audits its separate lockfile as well as the SDK.
