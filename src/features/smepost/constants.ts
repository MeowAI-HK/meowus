import { PRODUCT_SHORT_NAME } from "@/lib/product-branding";

/** Persisted Electron / APP_DATA_DIR folder name — do not change (existing installs). */
export const SMEPOST_APP_NAME = "SMEPost Auto Post";
/** Device display name registered with SMEPost cloud during login. */
export const SMEPOST_DEFAULT_DEVICE_NAME = PRODUCT_SHORT_NAME;
export const SMEPOST_PRODUCTION_BASE_URL = "https://smepost.io";
export const SMEPOST_DEFAULT_BASE_URL = process.env.SMEPOST_API_BASE_URL || SMEPOST_PRODUCTION_BASE_URL;
/** Minimum interval between cloud runner status fetches. */
export const SMEPOST_RUNNER_STATUS_TTL_MS = 40_000;
