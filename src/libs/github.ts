import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { Effect, pipe } from 'effect';

export type CompareCommitsData = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response']['data'];

const octokit = new Octokit();

export const compareRefs = (
  owner: string,
  repo: string
): (b: string, h: string) => Effect.Effect<CompareCommitsData, Error> => Effect.fn((
  baseRef: string,
  headRef: string,
): Effect.Effect<CompareCommitsData, Error> => pipe(
  { owner, repo, basehead: `${baseRef}...${headRef}` },
  octokit.rest.repos.compareCommitsWithBasehead,
  request => Effect.tryPromise({
    try: () => request,
    catch: (e) => e as Error
  }),
  Effect.map(({ data }) => data)
));
