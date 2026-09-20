const REGISTERED_GOOGLE_CLIENT_ID = "638352604628-c186v5kb6a2fav3aahirgpciknufhkau.apps.googleusercontent.com";

const envClientId =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || "";

export const rawGoogleClientId =
  envClientId && !envClientId.includes("your_google_client_id")
    ? envClientId
    : REGISTERED_GOOGLE_CLIENT_ID;

export const isGoogleConfigured = Boolean(
  rawGoogleClientId &&
  typeof rawGoogleClientId === "string" &&
  rawGoogleClientId.trim().length > 5 &&
  !rawGoogleClientId.includes("your_google_client_id") &&
  !rawGoogleClientId.includes("dummy") &&
  !rawGoogleClientId.includes("unconfigured")
);
