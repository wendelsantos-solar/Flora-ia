import type { NextConfig } from 'next';
import { sipWssA, sipWssB } from './src/lib/sip-transport';
const origins = [sipWssA, sipWssB].map(value => {
 const parsed = new URL(value);
 if (parsed.protocol !== 'wss:' || parsed.username || parsed.password || parsed.pathname !== '/ws' || parsed.search || parsed.hash) throw new Error('Flora SIP endpoints must be wss://host[:port]/ws');
 return parsed.origin;
}).join(' ');
const config: NextConfig = {
 poweredByHeader:false,
 output:"standalone",
 async rewrites(){const api=process.env.API_INTERNAL_URL || 'http://backend:8080';return ['/v1','/health'].map(prefix=>({source:`/api${prefix}/:path*`,destination:`${api}${prefix}/:path*`}));},
 async headers(){return [{source:'/:path*',headers:[{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'microphone=(self), speaker-selection=(self), camera=(), geolocation=()'},{key:'Content-Security-Policy',value:`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:13400 ${origins}; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`}]}];}
};
export default config;
