import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Required for Three.js and react-force-graph-3d (ESM-only, browser-only)
  transpilePackages: ["three", "react-force-graph-3d"],

  // WASM modules (Transformers.js / WebLLM) must stay server-external
  serverExternalPackages: ["@xenova/transformers", "@mlc-ai/web-llm"],

  // Required for SharedArrayBuffer — needed by WebGPU compute pipelines
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  webpack(config) {
    // Allow WASM imports (for Transformers.js / WebLLM WASM blobs)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
