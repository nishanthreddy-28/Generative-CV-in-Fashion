export type ProviderAvailability = {google:boolean;apple:boolean};
export function providerAvailability(value: unknown, enabled: ProviderAvailability): ProviderAvailability {
  const external = value && typeof value === "object" && "external" in value
    ? value.external : null;
  if (!external || typeof external !== "object") return {google:false,apple:false};
  return {
    google:enabled.google && "google" in external && external.google === true,
    apple:enabled.apple && "apple" in external && external.apple === true,
  };
}
