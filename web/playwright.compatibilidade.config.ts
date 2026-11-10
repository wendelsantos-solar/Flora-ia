import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'compatibilidade.spec.ts',workers:1,timeout:60000,reporter:'list',outputDir:'../.local/phase-01-1/compatibility-results',use:{baseURL:'http://localhost:13400',headless:true},projects:[
 {name:'firefox',use:{browserName:'firefox',launchOptions:{firefoxUserPrefs:{'media.navigator.streams.fake':true,'media.navigator.permission.disabled':true,'security.enterprise_roots.enabled':true,'media.autoplay.default':0}}}},
 ...(process.env.FF_LOOPBACK_PROBE==='1'?[{name:'firefox-loopback-probe',use:{browserName:'firefox' as const,launchOptions:{firefoxUserPrefs:{'media.navigator.streams.fake':true,'media.navigator.permission.disabled':true,'security.enterprise_roots.enabled':true,'media.autoplay.default':0,'media.peerconnection.ice.loopback':true}}}}]:[]),
 {name:'webkit-capabilities',use:{browserName:'webkit'}}
]});
