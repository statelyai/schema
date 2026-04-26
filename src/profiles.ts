export interface RegisteredProfile {
  shortName: string;
  docsPath: string;
  canonicalUri?: string;
}

export const registeredProfiles: RegisteredProfile[] = [
  {
    shortName: 'xstate',
    docsPath: './profiles/xstate.md',
    canonicalUri: 'https://stately.ai/specifications/xstate',
  },
  {
    shortName: 'serverlessworkflow',
    docsPath: './profiles/serverlessworkflow.md',
    canonicalUri: 'https://serverlessworkflow.io/specification/1.0.3',
  },
];

const registeredProfileNames = new Set(
  registeredProfiles.map((profile) => profile.shortName)
);

export function isRegisteredProfileName(value: string): boolean {
  return registeredProfileNames.has(value);
}

export function getRegisteredProfile(
  value: string
): RegisteredProfile | undefined {
  return registeredProfiles.find(
    (profile) =>
      profile.shortName === value || profile.canonicalUri === value
  );
}

export function matchesRegisteredProfile(
  value: string | undefined,
  shortName: string
): boolean {
  if (!value) return false;

  const profile = registeredProfiles.find(
    (registeredProfile) => registeredProfile.shortName === shortName
  );

  if (!profile) return false;

  return value === profile.shortName || value === profile.canonicalUri;
}
