'use strict';
const { chromium, firefox } = require('playwright');

const mode = process.argv[2] || 'chromium';
const servers = {
  chromium: { browser: chromium, port: 3001, channel: 'chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
  firefox: { browser: firefox, port: 3002 },
  'firefox-loopback': { browser: firefox, port: 3003 },
};
const selected = servers[mode];
if (!selected) throw new Error('Unknown disposable lab browser');

const firefoxUserPrefs = selected.browser === firefox ? {
  'media.navigator.streams.fake': true,
  'media.navigator.permission.disabled': true,
  'security.enterprise_roots.enabled': true,
  'media.autoplay.default': 0,
  ...(mode === 'firefox-loopback' ? { 'media.peerconnection.ice.loopback': true } : {}),
} : undefined;

selected.browser.launchServer({
  host: '0.0.0.0',
  port: selected.port,
  wsPath: '/lab',
  headless: true,
  args: selected.args,
  channel: selected.channel,
  firefoxUserPrefs,
}).then(server => {
  console.log('Disposable browser ready on port ' + selected.port);
  process.on('SIGTERM', () => void server.close());
}).catch(error => { console.error(error.message); process.exitCode = 1; });
