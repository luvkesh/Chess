'use strict';
// Outgoing email behind one function, send({ to, subject, text, html }).
//   log   (default) prints the message and keeps the last 50 in memory. For development and tests.
//   http  POSTs { from, to, subject, text, html } as JSON with a bearer key. That is the shape of
//         Resend's API (https://api.resend.com/emails); other providers need a small adapter.
function create(opts) {
  opts = opts || {};
  const mode = opts.mode || 'log';
  const from = opts.from || 'Chacklate Chess <no-reply@chacklate.example>';
  const outbox = [];
  const log = opts.log || console.log;

  async function send(msg) {
    const m = Object.assign({ from }, msg);
    if (mode === 'http') {
      const res = await fetch(opts.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (opts.key || '') }, body: JSON.stringify(m) });
      if (!res.ok) throw new Error('mail provider said ' + res.status);
      return true;
    }
    outbox.push(m);
    if (outbox.length > 50) outbox.shift();
    log('mail to ' + m.to + ': ' + m.subject + '\n' + m.text);
    return true;
  }
  return { mode, send, outbox };
}

module.exports = { create };
