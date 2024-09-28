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
  compact_running = false,
  updater_running = false,
  file = 0,
  active = 0
}) => ({
  name,
  view_index: {
    compact_running,
    updater_running,
    sizes: {
      file,
      active,
    },
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
