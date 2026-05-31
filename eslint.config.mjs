import config from "@crash/eslint";

// The frontend is a standalone app with its own React-aware ESLint config
// (frontend/eslint.config.mjs), so the root lint skips it.
export default [...config, { ignores: ["frontend/**"] }];
