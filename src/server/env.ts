/** Server configuration read in one place. */
export const databaseUrl = () => process.env.DATABASE_URL;

/** Dev sign-in lets anyone pick a demo user. Never on in production unless HX_DEV_LOGIN=1 is set on purpose. */
export const devLoginEnabled = () => process.env.NODE_ENV !== "production" || process.env.HX_DEV_LOGIN === "1";
