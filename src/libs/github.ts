import { type RestEndpointMethodTypes } from '@octokit/rest';
import { Array, Effect, Function, Match, Option, pipe, Predicate, Redacted, Tuple } from 'effect';
import { GITHUB_TOKEN } from './config.js';
import { type ConfigError } from 'effect/ConfigError';
import { octokit } from './shim.js';
import semver from 'semver';
import type { UnknownException } from 'effect/Cause';

export type CompareCommitsData = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response']['data'];
type RepoTagData = RestEndpointMethodTypes['repos']['listTags']['response']['data'];

const octokitEffect = pipe(
  GITHUB_TOKEN,
  Effect.map(Redacted.value),
  Effect.map(auth => ({ auth })),
  Effect.map(octokit)
);

const reduceCommits = (data: CompareCommitsData[]) => pipe(
  data,
  Array.flatMap(({ commits }) => commits),
  Array.dedupeWith((ca, cb) => ca.sha === cb.sha)
);

const reduceFiles = (data: CompareCommitsData[]) => pipe(
  data,
  Array.flatMap(({ files }) => files ?? []),
  Array.dedupeWith((ca, cb) => ca.filename === cb.filename)
);

const reduceCompareCommitsData = (data: CompareCommitsData[]) => pipe(
  data,
  Array.head,
  Option.getOrThrow,
  first => ({
    ...first,
    commits: reduceCommits(data),
    files: reduceFiles(data)
  }),
);

const getPartitionedRefs = (commits: CompareCommitsData['commits']): [string, string][] => pipe(
  commits,
  Array.map(({ sha }) => sha),
  Array.split(2),
  Array.map(commits => Tuple.make(Array.head(commits), Array.last(commits))),
  Array.map(Tuple.map(Option.getOrThrow)),
);

const ensureAllChangedFilesIncluded = (
  owner: string,
  repo: string
) => Effect.fn((data: CompareCommitsData) => pipe(
  data,
  Match.value,
  Match.whenOr(
    { files: Predicate.isNullable },
    { files: ({ length }) => length < 300 },
    data => pipe(
      Effect.succeed(data as CompareCommitsData),
    )
  ),
  Match.orElse((data) => pipe(
    getPartitionedRefs(data.commits),
    Array.map(Function.tupled(compareRefs(owner, repo))),
    Effect.allWith({ concurrency: 'unbounded' }),
    Effect.map(Array.prepend(data)),
    Effect.map(reduceCompareCommitsData),
  )),
));

const compareCommitsWithBasehead = Effect.fn((
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string,
) => pipe(
  octokitEffect,
  Effect.map(octokit => octokit.paginate(
    octokit.rest.repos.compareCommitsWithBasehead,
    {
      owner,
      repo,
      basehead: `${baseRef}...${headRef}`,
      per_page: 100,
    },
    ({ data }) => [data as CompareCommitsData]
  )),
  Effect.flatMap(request => Effect.tryPromise(() => request)),
));

/**
 * Compares two git refs (branches, tags, SHAs) in a GitHub repository. The returned comparison data includes the
 * complete list of all commits and changed files between the two refs. The `files` array will only contain one entry
 * for each changed file and the entry will contain the data about the first time the file was changed in the
 * comparison range (data for subsequent updates to the file is not returned). It is possible that the `files` array
 * will include files that changed during the comparison range, but ultimately had the same contents at the end of the
 * range as they did at the start of the range (e.g. a file was modified and then modified back to its original state).
 */
export const compareRefs = (
  owner: string,
  repo: string
): (b: string, h: string) => Effect.Effect<CompareCommitsData, Error | ConfigError> => Effect.fn((
  baseRef,
  headRef,
) => pipe(
  Effect.logDebug(`Comparing ${owner}/${repo} ${baseRef}...${headRef}`),
  Effect.andThen(compareCommitsWithBasehead(owner, repo, baseRef, headRef)),
  Effect.map(reduceCompareCommitsData),
  Effect.flatMap(ensureAllChangedFilesIncluded(owner, repo)),
));

const getAllTags = Effect.fn((
  owner: string,
  repo: string
) => pipe(
  octokitEffect,
  Effect.map(octokit => octokit.paginate(
    octokit.rest.repos.listTags,
    {
      owner,
      repo,
      per_page: 100,
    },
    ({ data }) => data
  )),
  Effect.flatMap(request => Effect.tryPromise(() => request)),
));

const findTagForSha = (
  tags: RepoTagData,
  sha: string
) : Option.Option<string> => pipe(
  tags,
  Array.findFirst(({ commit: { sha: tagSha } }) => tagSha === sha),
  Option.map(({ name }) => name)
);

const findTagOrElse = (tags: RepoTagData) => (acc: Option.Option<string>, sha: string) => pipe(
  acc,
  Option.orElse(() => findTagForSha(tags, sha)),
);

const getLatestTagName = (tags: RepoTagData): Option.Option<string> => pipe(
  tags,
  Array.head,
  Option.map(({ name }) => name)
);

const getNearestTagName = (
  owner: string,
  repo: string,
  tags: RepoTagData
):(ref: string) => Effect.Effect<string, UnknownException | ConfigError> => Effect.fn((ref) => pipe(
  octokitEffect,
  Effect.map(octokit => octokit.paginate(
    octokit.rest.repos.listCommits,
    {
      owner,
      repo,
      sha: ref,
      per_page: 100,
    },
    (response, done) => pipe(
      response.data,
      Array.map(({ sha }) => sha),
      Array.reduce(Option.none<string>(), findTagOrElse(tags)),
      Option.map(Array.make),
      Option.tap(result => {
        done();
        return Option.some(result);
      }),
      Option.getOrElse(Array.empty),
    )
  )),
  Effect.flatMap(request => Effect.tryPromise(() => request)),
  Effect.map(Array.head),
  Effect.map(Option.getOrThrow),
  Effect.unless(() => ref === 'master'),
  Effect.map(Option.orElse(() => getLatestTagName(tags))),
  Effect.map(Option.getOrThrow)
));

const hasReleaseVersion = (
  { name }: RepoTagData[number]
) => !name.startsWith('v') && semver.valid(name) !== null && semver.prerelease(name) === null;

export const getReleaseNames = (
  owner: string,
  repo: string
): (b: string, h: string) => Effect.Effect<string[], Error | ConfigError> => Effect.fn((
  baseRef: string,
  headRef: string,
) => pipe(
  getAllTags(owner, repo),
  Effect.map(Array.filter(hasReleaseVersion)),
  Effect.flatMap(tagData => pipe(
    Tuple.make(baseRef, headRef),
    Tuple.map(getNearestTagName(owner, repo, tagData)),
    Effect.allWith({ concurrency: 'unbounded' }),
    Effect.map(([baseTag, headTag]) => pipe(
      tagData,
      Array.map(({ name }) => name),
      Array.dropWhile(tag => semver.gt(tag, headTag)),
      Array.takeWhile(tag => semver.gt(tag, baseTag)),
    )),
  )),
));
