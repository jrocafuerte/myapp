import type { Metadata, Viewport } from 'next';
import React from 'react';
import { Gate } from '../components/Gate';
import { BridgeProvider } from '../lib/BridgeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pago de servicios',
  description: 'Micro frontend de Pago de servicios de Banco Plus.',
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

// Sin zoom ni escalado: se comporta como una pantalla de la app.
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

// Aplica el tema pedido por la app antes de pintar, para evitar un destello de otro color.
const themeBoot = `try{var t=new URLSearchParams(location.search).get('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <BridgeProvider>
          <Gate>{children}</Gate>
        </BridgeProvider>
      </body>
    </html>
  );
}
