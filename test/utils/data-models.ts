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
  processes_used = 0,
  binary = 0,
} = { }) => ({
  memory: {
    processes_used,
    binary,
  }
});
