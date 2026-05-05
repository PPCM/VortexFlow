// Unit tests for the User model.
//
// We exercise instance and class methods without touching Postgres by using
// Model.build() (no save) and mocking the save() function for methods that
// persist. This keeps the suite hermetic — no DB or Redis required.

const bcrypt = require('bcrypt');
const User = require('../../../src/models/User');

const buildUser = (overrides = {}) =>
  User.build({
    email: 'a@b.com',
    password_hash: 'pre-hashed',
    role: 'editor',
    is_active: true,
    first_name: 'Alice',
    last_name: 'Smith',
    preferences: { theme: 'dark' },
    ...overrides,
  });

describe('User.prototype.getFullName', () => {
  test('returns "first last" when both names are set', () => {
    expect(buildUser().getFullName()).toBe('Alice Smith');
  });

  test('falls back to email when names are missing', () => {
    expect(buildUser({ first_name: null, last_name: null }).getFullName())
      .toBe('a@b.com');
  });

  test('falls back to email when only one name is set', () => {
    expect(buildUser({ last_name: null }).getFullName()).toBe('a@b.com');
  });
});

describe('User.prototype.toJSON', () => {
  test('strips password_hash from the serialised output', () => {
    const u = buildUser({ password_hash: 'super-secret' });
    const json = u.toJSON();
    expect(json.password_hash).toBeUndefined();
    expect(json.email).toBe('a@b.com');
    expect(json.role).toBe('editor');
  });

  test('preserves all other public fields', () => {
    const u = buildUser({ avatar_url: 'http://x/y.png' });
    const json = u.toJSON();
    expect(json.avatar_url).toBe('http://x/y.png');
    expect(json.first_name).toBe('Alice');
    expect(json.preferences).toEqual({ theme: 'dark' });
  });
});

describe('User.prototype.validatePassword', () => {
  test('returns true for the correct password', async () => {
    const hashed = await bcrypt.hash('correct horse', 4);
    const u = buildUser({ password_hash: hashed });
    expect(await u.validatePassword('correct horse')).toBe(true);
  });

  test('returns false for the wrong password', async () => {
    const hashed = await bcrypt.hash('correct horse', 4);
    const u = buildUser({ password_hash: hashed });
    expect(await u.validatePassword('battery staple')).toBe(false);
  });
});

describe('User.prototype.updateLastLogin', () => {
  test('sets last_login to "now" and saves', async () => {
    const u = buildUser({ last_login: null });
    u.save = jest.fn().mockResolvedValue(u);

    const before = Date.now();
    await u.updateLastLogin();
    const after = Date.now();

    expect(u.last_login).toBeInstanceOf(Date);
    const t = u.last_login.getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
    expect(u.save).toHaveBeenCalled();
  });
});

describe('User class helpers', () => {
  // These wrap Sequelize's findOne/findAll/count. We check they call the
  // underlying method with the right where clause, without hitting Postgres.

  test('findByEmail lowercases the lookup', () => {
    const findOne = jest.spyOn(User, 'findOne').mockResolvedValue(null);
    User.findByEmail('FOO@EXAMPLE.COM');
    expect(findOne).toHaveBeenCalledWith({ where: { email: 'foo@example.com' } });
    findOne.mockRestore();
  });

  test('findActive filters on is_active=true', () => {
    const findAll = jest.spyOn(User, 'findAll').mockResolvedValue([]);
    User.findActive();
    expect(findAll).toHaveBeenCalledWith({ where: { is_active: true } });
    findAll.mockRestore();
  });

  test('countByRole filters on the requested role', () => {
    const count = jest.spyOn(User, 'count').mockResolvedValue(0);
    User.countByRole('admin');
    expect(count).toHaveBeenCalledWith({ where: { role: 'admin' } });
    count.mockRestore();
  });
});
