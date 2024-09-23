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
