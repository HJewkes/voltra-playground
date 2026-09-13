import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

describe('metro.config watchFolders', () => {
  it('loads without throwing when the sibling SDK checkout is outside this checkout (worktree layout)', () => {
    expect(() => require('../../metro.config.js')).not.toThrow();
  });

  it('never lists a watchFolders entry that does not exist on disk', () => {
    const config = require('../../metro.config.js');

    expect(Array.isArray(config.watchFolders)).toBe(true);
    for (const folder of config.watchFolders) {
      expect(fs.existsSync(folder)).toBe(true);
    }
  });
});
