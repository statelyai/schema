import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  registeredProfiles,
  isRegisteredProfileName,
  getRegisteredProfile,
  matchesRegisteredProfile,
} from './profiles';

describe('profiles', () => {
  test('registered profile names include xstate', () => {
    assert.ok(isRegisteredProfileName('xstate'));
    assert.ok(
      registeredProfiles.some((profile) => profile.shortName === 'xstate')
    );
  });

  test('registered profile names include serverlessworkflow', () => {
    assert.ok(isRegisteredProfileName('serverlessworkflow'));
    assert.ok(
      registeredProfiles.some(
        (profile) => profile.shortName === 'serverlessworkflow'
      )
    );
  });

  test('unknown profile names are not registered', () => {
    assert.ok(!isRegisteredProfileName('fake'));
  });

  test('registered profiles can be resolved by short name or canonical URI', () => {
    assert.strictEqual(getRegisteredProfile('xstate')?.shortName, 'xstate');
    assert.strictEqual(
      getRegisteredProfile('https://stately.ai/specifications/xstate')
        ?.shortName,
      'xstate'
    );
  });

  test('profile matching treats short name and canonical URI as equivalent', () => {
    assert.ok(matchesRegisteredProfile('xstate', 'xstate'));
    assert.ok(
      matchesRegisteredProfile(
        'https://stately.ai/specifications/xstate',
        'xstate'
      )
    );
    assert.ok(!matchesRegisteredProfile('serverlessworkflow', 'xstate'));
  });
});
