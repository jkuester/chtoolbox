export const createDbInfo = ({
  key = '',
  compact_running = false,
  file = 0,
  active = 0,
} = {}) => ({
  key,
  info: {
    compact_running,
    sizes: {
      file,
      active,
    },
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
  other = 0,
  atom = 0,
  atom_used = 0,
  processes = 0,
  processes_used = 0,
  binary = 0,
  code = 0,
  ets = 0,
} = { }) => ({
  memory: {
    other,
    atom,
    atom_used,
    processes,
    processes_used,
    binary,
    code,
    ets,
  }
});
