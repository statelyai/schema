import { describe, test } from 'node:test';
import assert from 'node:assert';
import { registeredProfiles, isRegisteredProfileName } from './profiles';

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
});
