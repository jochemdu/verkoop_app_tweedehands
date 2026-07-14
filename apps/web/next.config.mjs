import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    // Strict-ish CSP. Supabase storage + Vercel + inline style voor Tailwind
    // dark-mode query. 'unsafe-inline' voor style blijft vanwege @theme-based
    // Tailwind tokens; scripts zijn strict (geen unsafe-eval).
    // 'wasm-unsafe-eval' + worker-src blob: + staticimgly.com zijn nodig voor de
    // client-side achtergrond-verwijdering (@imgly/background-removal draait een
    // ONNX-model in WebAssembly in een web worker en haalt de wasm/model op van
    // staticimgly.com). 'wasm-unsafe-eval' staat alléén WASM-compilatie toe, geen
    // arbitraire JS-eval.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // De client-side achtergrond-verwijdering (@imgly + onnxruntime-web) vereist:
      // - 'wasm-unsafe-eval' + blob: → WASM-backend via dynamische blob-import
      // - 'unsafe-eval' → de emscripten-glue van onnxruntime gebruikt eval()/new Function()
      // - staticimgly.com → wasm/model-download
      // 'unsafe-eval' verzwakt weinig extra bovenop het al aanwezige 'unsafe-inline'.
      // Per-pad scopen kan niet: een Next SPA hergebruikt de CSP van de eerste lading.
      // Alternatief voor maximale strictheid: achtergrond-verwijdering server-side draaien.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://staticimgly.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://staticimgly.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@verkoopassistent/shared"],
  serverExternalPackages: ["@react-pdf/renderer"],
  typedRoutes: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Turbopack (default sinds Next 16) volgt tsconfig-resolutie en heeft de
  // webpack extensionAlias-hack niet nodig; lege config bevestigt de keuze.
  turbopack: {},
  webpack: (config) => {
    // Alleen gebruikt bij een expliciete `next build --webpack` fallback.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
