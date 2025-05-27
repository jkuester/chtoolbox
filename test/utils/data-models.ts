/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export const createDbInfo = ({
  key = '',
  update_seq = '',
  file = 0,
  external = 0,
  active = 0,
  purge_seq = '',
  doc_del_count = 0,
  doc_count = 0,
  disk_format_version = 0,
  compact_running = false,
  cluster = { q: 0, n: 0, w: 0, r: 0 },
  instance_start_time = '',
} = {}) => ({
  key,
  info: {
    db_name: key,
    update_seq,
    sizes: {
      file,
      external,
      active,
    },
    purge_seq,
    doc_del_count,
    doc_count,
    disk_format_version,
    compact_running,
    cluster,
    instance_start_time,
  },
});

export const createDesignInfo = ({
  name = '',
  collator_versions = [] as string[],
  compact_running = false,
  language = '',
  purge_seq = 0,
  signature = '',
  active = 0,
  external = 0,
  file = 0,
  updater_running = false,
  minimum = 0,
  preferred = 0,
  total = 0,
  waiting_commit = false,
  waiting_clients = 0,
} = {}) => ({
  name,
  view_index: {
    collator_versions,
    compact_running,
    language,
    purge_seq,
    signature,
    sizes: {
      active,
      external,
      file,
    },
    updater_running,
    updates_pending: {
      minimum,
      preferred,
      total,
    },
    waiting_commit,
    waiting_clients,
  },
});

export const createNouveauInfo = ({
  name = '',
  update_seq = 0,
  purge_seq = 0,
  num_docs = 0,
  disk_size = 0,
} = {}) => ({
  name,
  search_index: {
    update_seq,
    purge_seq,
    num_docs,
    disk_size,
  },
});

export const createNodeSystem = ({
  processes_used = 0,
  binary = 0,
} = {}) => ({
  memory: {
    processes_used,
    binary,
  }
});

export const createActiveTask = ({
  database = '',
  design_document = undefined as string | undefined,
  doc_id = undefined as string | undefined,
  docs_written = undefined as number | undefined,
  pid = '',
  progress = undefined as number | undefined,
  started_on = 0,
  type = '',
} = {}) => ({
  database,
  design_document,
  doc_id,
  docs_written,
  pid,
  progress,
  started_on,
  type,
});

export const createChtMonitoringData = ({
  versionApp = '',
  versionCouchDb = '',
} = {}) => ({
  version: {
    app: versionApp,
    couchdb: versionCouchDb,
  }
});
