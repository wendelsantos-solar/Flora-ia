import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Central · Telefonia',description:'Central de telefonia interna — ambiente de desenvolvimento'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
