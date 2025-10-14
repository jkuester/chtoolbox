import { Redacted } from 'effect';

export const withoutCreds = (url: URL): URL => {
  const withoutCreds = new URL(url);
  withoutCreds.username = '';
  withoutCreds.password = '';
  return withoutCreds;
};

export const withCreds = (url: URL, username: string, password: Redacted.Redacted): Redacted.Redacted<URL> => {
  const withCreds = new URL(url);
  withCreds.username = username;
  withCreds.password = Redacted.value(password);
  return Redacted.make(withCreds);
};

export const withPathname = (pathname: string) => (url: URL): URL => {
  const withPath = new URL(url);
  withPath.pathname = pathname;
  return withPath;
};
