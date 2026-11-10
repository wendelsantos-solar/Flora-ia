// Build-time URLs let the private lab use its TLS gateway without changing SIP identities.
export const sipWssA = process.env.NEXT_PUBLIC_FLORA_WSS_A || 'wss://localhost:18489/ws';
export const sipWssB = process.env.NEXT_PUBLIC_FLORA_WSS_B || 'wss://localhost:18490/ws';
