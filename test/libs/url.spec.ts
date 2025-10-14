import { describe, it } from 'mocha';
import { withCreds, withoutCreds, withPathname } from '../../src/libs/url.ts';
import { Redacted } from 'effect';
import { expect } from 'chai';
import { DEFAULT_CHT_PASSWORD, DEFAULT_CHT_URL, DEFAULT_CHT_URL_AUTH, DEFAULT_CHT_USERNAME } from '../utils/base.ts';

describe('URL libs', () => {
  describe('withoutCreds', () => {
    it('removes username and password from the URL', () => {
      const url = new URL(DEFAULT_CHT_URL_AUTH);
      const result = withoutCreds(url);
      expect(result.toString()).to.equal(DEFAULT_CHT_URL);
    });

    it('does nothing if the URL has no creds', () => {
      const url = new URL(DEFAULT_CHT_URL);
      const result = withoutCreds(url);
      expect(result.toString()).to.equal(DEFAULT_CHT_URL);
    });
  });

  describe('withCreds', () => {
    it('returns a URL with username and password', () => {
      const url = new URL(DEFAULT_CHT_URL);
      const password = Redacted.make(DEFAULT_CHT_PASSWORD);

      const result = withCreds(url, DEFAULT_CHT_USERNAME, password);
      const urlResult = Redacted.value(result);

      expect(urlResult.toString()).to.equal(DEFAULT_CHT_URL_AUTH);
    });

    it('overrides username and password if already set', () => {
      const url = new URL(DEFAULT_CHT_URL);
      url.password = 'hello';
      url.username = 'world';
      const password = Redacted.make(DEFAULT_CHT_PASSWORD);

      const result = withCreds(url, DEFAULT_CHT_USERNAME, password);
      const urlResult = Redacted.value(result);

      expect(urlResult.toString()).to.equal(DEFAULT_CHT_URL_AUTH);
    });
  });

  it('withPathname', () => {
    const url = new URL('https://example.com/oldpath?x=1');
    const result = withPathname('/newpath')(url);
    expect(result.toString()).to.equal('https://example.com/newpath?x=1');
  });
});
