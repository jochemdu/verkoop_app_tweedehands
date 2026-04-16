/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@verkoopassistent/shared"],
  // @react-pdf/renderer bundelt slecht via webpack (pdfkit, fontkit zijn
  // Node-native). Laat Next.js ze extern laten en rechtstreeks uit
  // node_modules requiren in server routes.
  serverExternalPackages: ["@react-pdf/renderer"],
  typedRoutes: false,
};

export default nextConfig;
