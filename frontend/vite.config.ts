import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // fs.allow lets the dev server read the sibling @crash/crash-curve source above
  // the project root; tsconfigPaths resolves the import the same way tsc/ESLint do.
  server: { port: 3000, fs: { allow: [".."] } },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({ spa: { enabled: true } }),
    // o plugin do react PRECISA vir depois do tanstackStart
    viteReact(),
  ],
});
