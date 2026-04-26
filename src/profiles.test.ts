import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  registeredProfiles,
  isRegisteredProfileName,
  getRegisteredProfile,
  normalizeRegisteredProfile,
  matchesRegisteredProfile,
  XSTATE_PROFILE_SHORT_NAME,
  XSTATE_PROFILE_URI,
  SERVERLESSWORKFLOW_PROFILE_SHORT_NAME,
  SERVERLESSWORKFLOW_PROFILE_URI,
} from './profiles';

describe('profiles', () => {
  test('registered profile names include xstate', () => {
    assert.ok(isRegisteredProfileName(XSTATE_PROFILE_SHORT_NAME));
    assert.ok(
      registeredProfiles.some(
        (profile) => profile.shortName === XSTATE_PROFILE_SHORT_NAME
      )
    );
  });

  test('registered profile names include serverlessworkflow', () => {
    assert.ok(isRegisteredProfileName(SERVERLESSWORKFLOW_PROFILE_SHORT_NAME));
    assert.ok(
      registeredProfiles.some(
        (profile) =>
          profile.shortName === SERVERLESSWORKFLOW_PROFILE_SHORT_NAME
      )
    );
  });

  test('unknown profile names are not registered', () => {
    assert.ok(!isRegisteredProfileName('fake'));
  });

  test('registered profiles can be resolved by short name or canonical URI', () => {
    assert.strictEqual(
      getRegisteredProfile(XSTATE_PROFILE_SHORT_NAME)?.shortName,
      XSTATE_PROFILE_SHORT_NAME
    );
    assert.strictEqual(
      getRegisteredProfile(XSTATE_PROFILE_URI)?.shortName,
      XSTATE_PROFILE_SHORT_NAME
    );
    assert.strictEqual(
      getRegisteredProfile(SERVERLESSWORKFLOW_PROFILE_URI)?.shortName,
      SERVERLESSWORKFLOW_PROFILE_SHORT_NAME
    );
  });

  test('registered profiles can be normalized to their short names', () => {
    assert.strictEqual(
      normalizeRegisteredProfile(XSTATE_PROFILE_SHORT_NAME),
      XSTATE_PROFILE_SHORT_NAME
    );
    assert.strictEqual(
      normalizeRegisteredProfile(XSTATE_PROFILE_URI),
      XSTATE_PROFILE_SHORT_NAME
    );
    assert.strictEqual(
      normalizeRegisteredProfile(SERVERLESSWORKFLOW_PROFILE_URI),
      SERVERLESSWORKFLOW_PROFILE_SHORT_NAME
    );
    assert.strictEqual(normalizeRegisteredProfile('fake'), undefined);
    assert.strictEqual(normalizeRegisteredProfile(undefined), undefined);
  });

  test('profile matching treats short name and canonical URI as equivalent', () => {
    assert.ok(
      matchesRegisteredProfile(
        XSTATE_PROFILE_SHORT_NAME,
        XSTATE_PROFILE_SHORT_NAME
      )
    );
    assert.ok(
      matchesRegisteredProfile(XSTATE_PROFILE_URI, XSTATE_PROFILE_SHORT_NAME)
    );
    assert.ok(
      !matchesRegisteredProfile(
        SERVERLESSWORKFLOW_PROFILE_SHORT_NAME,
        XSTATE_PROFILE_SHORT_NAME
      )
    );
  });
});
