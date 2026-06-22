export const OFFICIAL_PITECO_PACKAGE_SLUGS = [
  "piteco_prime",
  "piteco_vampiro",
  "piteco_zombie",
  "piteco_ninja",
  "piteco_astronauta",
  "piteco_explorador",
] as const;

export type OfficialPitecoPackageSlug = (typeof OFFICIAL_PITECO_PACKAGE_SLUGS)[number];
