import path from 'node:path';
import type { NextConfig } from 'next';

// Raíz del repositorio: permite importar el contrato compartido en ../../shared.
const repoRoot = path.resolve(process.cwd(), '../..');

const config: NextConfig = {
  // Exportación estática: el micro frontend se publica en cualquier CDN o servidor de archivos,
  // y se despliega de forma independiente de la app móvil.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default config;
