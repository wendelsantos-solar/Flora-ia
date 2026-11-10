import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'homologacao.spec.ts',workers:1,timeout:120000,reporter:'list',
 outputDir:'../.local/phase-01-1/results',
 use:{actionTimeout:15000,baseURL:'http://localhost:13400',headless:true,launchOptions:{args:['--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']}},
 projects:[{name:'chromium',use:{channel:'chromium'}},{name:'chrome',use:{channel:'chrome'}}]
});
