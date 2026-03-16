import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,

    hmr: {
      overlay: false,
    },

    proxy: {
      "/api/groq": {
        target: "https://api.groq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ""),
        secure: true,
      },
      "/api/samba": {
        target: "https://api.sambanova.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/samba/, ""),
        secure: true,
      },
      "/api/gemini": {
        target: "https://generativelanguage.googleapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ""),
        secure: true,
      },
      "/api/pollinations": {
        target: "https://image.pollinations.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pollinations/, ""),
        secure: true,
      },
      "/api/together": {
        target: "https://api.together.xyz",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/together/, ""),
        secure: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
