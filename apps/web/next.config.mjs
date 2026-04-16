/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@verkoopassistent/shared"],
  // @react-pdf/renderer bundelt slecht via webpack (pdfkit, fontkit zijn
  // Node-native). Laat Next.js ze extern laten en rechtstreeks uit
  // node_modules requiren in server routes.
  serverExternalPackages: ["@react-pdf/renderer"],
  typedRoutes: false,
  // Workaround: shared package is "type": "module" en gebruikt .js extensies
  // in imports (vereist voor tsx/Node ESM). Webpack moet die .js naar .ts
  // resolven tijdens de Next.js build.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
