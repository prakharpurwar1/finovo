import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectGender, getUserInitials, getAvatarUrl } from '../utils/avatar.js';

describe('Avatar & Gender Detection Utilities', () => {
  it('correctly detects male gender for common male names', () => {
    assert.strictEqual(detectGender('Prakhar Purwar'), 'male');
    assert.strictEqual(detectGender('Rahul Sharma'), 'male');
    assert.strictEqual(detectGender('Amitabh'), 'male');
    assert.strictEqual(detectGender('David Miller'), 'male');
  });

  it('correctly detects female gender for common female names', () => {
    assert.strictEqual(detectGender('Priya Singh'), 'female');
    assert.strictEqual(detectGender('Ananya Roy'), 'female');
    assert.strictEqual(detectGender('Sarah Jenkins'), 'female');
    assert.strictEqual(detectGender('Deepika'), 'female');
  });

  it('extracts uppercase initials accurately', () => {
    assert.strictEqual(getUserInitials('Prakhar Purwar'), 'PP');
    assert.strictEqual(getUserInitials('Rahul'), 'RA');
    assert.strictEqual(getUserInitials(''), 'FN');
  });

  it('generates masculine avatar URL when detected or selected male', () => {
    const maleUrl = getAvatarUrl({ name: 'Prakhar Purwar', gender: 'male' });
    assert.ok(maleUrl.includes('shortFlat'), 'Male avatar must have masculine hair styling');
    assert.ok(!maleUrl.includes('longButNotTooLong'), 'Male avatar must not have long feminine hair');
  });

  it('generates feminine avatar URL when detected or selected female', () => {
    const femaleUrl = getAvatarUrl({ name: 'Priya Sharma', gender: 'female' });
    assert.ok(femaleUrl.includes('longButNotTooLong'), 'Female avatar must have feminine hair styling');
  });
});
