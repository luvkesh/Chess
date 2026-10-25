'use strict';
// Runs game analysis off the main thread so live games never wait for the engine.
const { parentPort } = require('node:worker_threads');
const { analyse } = require('./fairplay-analyse');
const ChacklateEngine = require('../../../packages/chess-core/src/engine.js');
const E = ChacklateEngine();
parentPort.on('message', (job) => {
  try { parentPort.postMessage({ id: job.id, result: analyse(job.moves, Object.assign({ E }, job.opts)) }); }
  catch (e) { parentPort.postMessage({ id: job.id, error: e.message }); }
});
