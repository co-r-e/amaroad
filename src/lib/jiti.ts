import { createJiti } from "jiti";

const isDev = process.env.NODE_ENV === "development";

export const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: !isDev,
});
