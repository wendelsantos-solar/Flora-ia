import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'telephony.spec.ts',workers:1,timeout:150000,reporter:'list',use:{baseURL:'http://localhost:13400',headless:true,channel:'chromium',launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']}}});
