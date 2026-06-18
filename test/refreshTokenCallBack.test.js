'use strict';

var assert    = require('assert'),
    axios     = require('axios'),
    QuickBooks = require('../index');

/**
 * Construct a QuickBooks client with 11 positional args.
 *
 * oauthversion '2.0' bypasses the tokenSecret guard that would throw for
 * OAuth 1.0a clients when tokenSecret is false.  minorversion '75' matches
 * the `.d.ts` type `minorversion?: string | null` and upstream's
 * `minorversion || 75` default.
 *
 * @param {string|undefined} refreshToken  - initial stored refresh token
 * @param {Function|undefined} cb          - the refreshTokenCallBack hook (11th arg)
 * @returns {QuickBooks}
 */
function makeClient(refreshToken, cb) {
  return new QuickBooks(
    'ck', 'cs', 'tok', false, 'realm',
    true, false, '75', '2.0',
    refreshToken, cb
  );
}

describe('refreshTokenCallBack', function () {
  var origPost, unhandled;

  beforeEach(function () {
    origPost = axios.post;
    // Mandatory unhandled-rejection guard: if the hook rejection ever escapes
    // the hook's own .catch (i.e. Decision 3's isolation is broken), this
    // records it and the rejection-isolation case asserts it never fired.
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(function () {
    axios.post = origPost;
    process.removeListener('unhandledRejection', onUnhandled);
  });

  function onUnhandled(err) { unhandled.push(err); }

  /**
   * Replace axios.post for the duration of a single test with a stub that
   * resolves immediately with a controlled token payload.
   */
  function stubPost(payload) {
    axios.post = function () { return Promise.resolve({ data: payload }); };
  }

  it('fires the hook with exactly the new token as its single argument when rotated', function (done) {
    var seen = null, argCount = -1;
    var qbo = makeClient('OLD', function (t) {
      seen = t;
      argCount = arguments.length;
    });
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });

    qbo.refreshAccessToken(function (err, resp) {
      assert.strictEqual(err, null);
      assert.strictEqual(resp.refresh_token, 'NEW');
      // Allow the hook's microtask chain to settle before asserting its effects.
      setImmediate(function () {
        assert.strictEqual(seen, 'NEW');      // hook received the rotated token
        assert.strictEqual(argCount, 1);      // ...as its ONE and only argument (locks .d.ts arity)
        assert.strictEqual(unhandled.length, 0);  // no path leaks an unhandled rejection
        done();
      });
    });
  });

  it('does NOT fire the hook when the refresh token is unchanged', function (done) {
    var fired = false;
    var qbo = makeClient('SAME', function () { fired = true; });
    stubPost({ access_token: 'A2', refresh_token: 'SAME' });

    qbo.refreshAccessToken(function () {
      setImmediate(function () {
        assert.strictEqual(fired, false);
        assert.strictEqual(unhandled.length, 0);  // no path leaks an unhandled rejection
        done();
      });
    });
  });

  it('does NOT throw on rotation when the hook was omitted (10-arg form)', function (done) {
    var qbo = makeClient('OLD', undefined);  // refreshTokenCallBack absent
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });

    qbo.refreshAccessToken(function (err, resp) {
      assert.strictEqual(err, null);
      assert.strictEqual(resp.refresh_token, 'NEW');
      setImmediate(function () {
        assert.strictEqual(unhandled.length, 0);  // omitted-hook rotation leaks nothing
        done();
      });
    });
  });

  it('isolates a hook rejection from the node-style callback (Decision 3 structure)', function (done) {
    var hookSettled = false, callbackArgs = null;

    // The hook returns a rejected promise.  A .catch() chained by the test
    // itself records that the hook's rejecting branch actually ran
    // (hookSettled = true) and then rethrows so the rejection propagates
    // onward — it MUST be absorbed by the runtime's own .catch on the hook
    // (Decision 3), not by `callback` and not as an unhandled rejection.
    var qbo = makeClient('OLD', function () {
      return Promise.reject(new Error('vault down'))
        .catch(function (e) { hookSettled = true; throw e; });
    });
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });

    qbo.refreshAccessToken(function () {
      callbackArgs = Array.prototype.slice.call(arguments);
    });

    // Sequence assertions AFTER the hook's microtask chain has fully settled.
    // A single setImmediate can run before the hook's .catch resolves; use a
    // short setTimeout so both `hookSettled` and any unhandledRejection
    // delivery (which arrives on a later macrotask tick) are observable.
    setTimeout(function () {
      // callback fired exactly once with success result and NO error
      assert.strictEqual(callbackArgs[0], null);                 // err === null
      assert.strictEqual(callbackArgs[1].refresh_token, 'NEW');  // success payload present
      // the hook's promise chain actually ran and settled (rejection path exercised)
      assert.strictEqual(hookSettled, true);
      // the rejection was contained by the hook's OWN .catch — it neither
      // reached `callback` (asserted above) NOR escaped as an unhandled rejection
      assert.strictEqual(unhandled.length, 0);
      done();
    }, 20);
  });
});
