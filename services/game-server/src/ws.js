'use strict';
// A small RFC 6455 WebSocket server: text frames, ping/pong, close. No extensions.
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 64 * 1024;

class Socket extends EventEmitter {
  constructor(stream, req) {
    super();
    this.stream = stream;
    this.req = req;
    this.open = true;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.alive = true;
    stream.setNoDelay(true);
    stream.on('data', (d) => this.onData(d));
    stream.on('close', () => this.closed());
    stream.on('error', () => this.closed());
  }

  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (!masked || len > MAX_MESSAGE) return this.close(1002);
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.frame(fin, op, data);
      if (!this.open) return;
    }
  }

  frame(fin, op, data) {
    if (op === 0x8) return this.close(1000);
    if (op === 0x9) return this.raw(0xa, data);
    if (op === 0xa) { this.alive = true; return; }
    if (op === 0x1 || op === 0x0) {
      this.fragments.push(data);
      const total = this.fragments.reduce((n, f) => n + f.length, 0);
      if (total > MAX_MESSAGE) return this.close(1009);
      if (!fin) return;
      const text = Buffer.concat(this.fragments).toString('utf8');
      this.fragments = [];
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg && typeof msg === 'object') this.emit('message', msg);
      return;
    }
    if (op === 0x2) return this.close(1003);
  }

  raw(op, payload) {
    if (!this.open) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.stream.write(Buffer.concat([head, payload]));
  }

  send(obj) { this.raw(0x1, Buffer.from(JSON.stringify(obj))); }
  ping() { this.raw(0x9, Buffer.alloc(0)); }

  close(code) {
    if (!this.open) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000);
    this.raw(0x8, b);
    this.stream.end();
    this.closed();
  }

  closed() {
    if (!this.open) return;
    this.open = false;
    this.stream.destroy();
    this.emit('close');
  }
}

// Attaches to an http.Server. onConnection(socket) is called for each upgraded request on `path`.
function attach(server, path, onConnection) {
  const sockets = new Set();
  server.on('upgrade', (req, stream) => {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      stream.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    stream.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const s = new Socket(stream, req);
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    onConnection(s);
  });
  // Drop connections that stop answering pings.
  const timer = setInterval(() => {
    for (const s of sockets) {
      if (!s.alive) { s.close(1001); continue; }
      s.alive = false;
      s.ping();
    }
  }, 30000);
  timer.unref();
  return { sockets, stop() { clearInterval(timer); for (const s of sockets) s.close(1001); } };
}

module.exports = { attach, Socket };
