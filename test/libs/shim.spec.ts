import { describe, it } from 'mocha';
import { expect } from 'chai';
import PouchDB from 'pouchdb-core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import { octokit, pouchDB } from '../../src/libs/shim.js';
import { Octokit } from '@octokit/rest';

describe('Core libs', () => {
  it('pouchDB', () => {
    PouchDB.plugin(PouchDBAdapterHttp);
    const db = pouchDB('http://test.db');

    expect(db).to.be.an.instanceOf(PouchDB);
  });

  it('octokit', () => {
    const octo = octokit({});
    expect(octo).to.be.an.instanceOf(Octokit);
  });
});
