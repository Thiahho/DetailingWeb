// Where a service is delivered. Mirrors the backend `ServiceLocationType`
// string enum. `PUT /api/services/{id}` is a full replace: a payload without
// `locationType` resets the service to OnSite, so every create/update payload
// goes through `withLocationType`.
export type ServiceLocationType = "OnSite" | "AtHome";

export const SERVICE_LOCATION_OPTIONS: { value: ServiceLocationType; label: string }[] = [
  { value: "OnSite", label: "En el local" },
  { value: "AtHome", label: "A domicilio" },
];

export function normalizeLocationType(value: unknown): ServiceLocationType {
  return value === "AtHome" || value === 1 ? "AtHome" : "OnSite";
}

export function withLocationType<T extends object>(
  payload: T,
  locationType: unknown
): Omit<T, "locationType"> & { locationType: ServiceLocationType } {
  return { ...payload, locationType: normalizeLocationType(locationType) };
}
