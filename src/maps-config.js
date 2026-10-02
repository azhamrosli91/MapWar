export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
export const HAS_MAP_KEY = Boolean(
  MAPS_KEY && MAPS_KEY !== "your_google_maps_api_key",
);
