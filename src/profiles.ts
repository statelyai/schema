export interface RegisteredProfile {
  shortName: string;
  docsPath: string;
  canonicalUri?: string;
}

export const XSTATE_PROFILE_SHORT_NAME = 'xstate';
export const XSTATE_PROFILE_URI = 'https://stately.ai/specifications/xstate';
export const SERVERLESSWORKFLOW_PROFILE_SHORT_NAME = 'serverlessworkflow';
export const SERVERLESSWORKFLOW_PROFILE_URI =
  'https://serverlessworkflow.io/specification/1.0.3';

export const registeredProfiles: RegisteredProfile[] = [
  {
    shortName: XSTATE_PROFILE_SHORT_NAME,
    docsPath: './profiles/xstate.md',
    canonicalUri: XSTATE_PROFILE_URI,
  },
  {
    shortName: SERVERLESSWORKFLOW_PROFILE_SHORT_NAME,
    docsPath: './profiles/serverlessworkflow.md',
    canonicalUri: SERVERLESSWORKFLOW_PROFILE_URI,
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

export function normalizeRegisteredProfile(
  value: string | undefined
): string | undefined {
  if (!value) return undefined;
  return getRegisteredProfile(value)?.shortName;
}

export function matchesRegisteredProfile(
  value: string | undefined,
  shortName: string
): boolean {
  return normalizeRegisteredProfile(value) === shortName;
}
