export function logEvent(name, params = {}) {
  // Stub analytics - replace with real implementation later.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[event] ${name}`, params);
  }
}

export default {
  logEvent,
};

