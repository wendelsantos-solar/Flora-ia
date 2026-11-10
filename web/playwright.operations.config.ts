import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests', testMatch:'operations.spec.ts', workers:1, timeout:120000,
 reporter:'list', outputDir:'../.local/phase-02/playwright',
 use:{
  baseURL:'http://localhost:13400', channel:'chromium', headless:true,
  launchOptions:{args:['--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']},
 },
});
