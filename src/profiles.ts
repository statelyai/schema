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
