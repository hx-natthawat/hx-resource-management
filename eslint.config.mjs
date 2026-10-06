import nextVitals from "eslint-config-next/core-web-vitals";

const frameworkImports = ["next", "next/*", "react", "react/*", "react-dom", "hono", "hono/*", "drizzle-orm", "drizzle-orm/*", "pg", "@/server/*", "@/app/*", "@/components/*"];

const config = [
  { ignores: [".next/**", ".open-next/**", "drizzle/**", "node_modules/**"] },
  ...nextVitals,
  {
    files: ["src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: frameworkImports, message: "Domain modules stay plain TypeScript (ADR-005). Move framework code to src/server or src/app." }] }],
    },
  },
];

export default config;
