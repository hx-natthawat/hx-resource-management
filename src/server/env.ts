/** Server configuration read in one place. */
export const databaseUrl = () => process.env.DATABASE_URL;

/** Dev sign-in lets anyone pick a demo user. Never on in production unless HX_DEV_LOGIN=1 is set on purpose. */
export const devLoginEnabled = () => process.env.NODE_ENV !== "production" || process.env.HX_DEV_LOGIN === "1";

/** Today, UTC midnight. HX_TODAY (YYYY-MM-DD) pins it for demos and screenshots. */
export const today = () => {
  const d = process.env.HX_TODAY ? new Date(`${process.env.HX_TODAY}T00:00:00Z`) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
