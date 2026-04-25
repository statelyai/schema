export interface RegisteredProfile {
  shortName: string;
  docsPath: string;
  canonicalUri?: string;
}

export const registeredProfiles: RegisteredProfile[] = [
  {
    shortName: 'xstate',
    docsPath: './profiles/xstate.md',
  },
];

const registeredProfileNames = new Set(
  registeredProfiles.map((profile) => profile.shortName)
);

export function isRegisteredProfileName(value: string): boolean {
  return registeredProfileNames.has(value);
}
