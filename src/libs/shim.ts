import PouchDB from 'pouchdb-core';
import { Octokit } from '@octokit/rest';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { pipe } from 'effect';
import type { OctokitOptions } from '@octokit/core/types';

export const pouchDB = (
  name?: string,
  options?: PouchDB.Configuration.DatabaseConfiguration
): PouchDB.Database<object> => new PouchDB(name, options);

export const octokit = (opts: OctokitOptions): Octokit => pipe(
  Octokit.plugin(paginateRest),
  PagedOctokit => new PagedOctokit(opts)
);
