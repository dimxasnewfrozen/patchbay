/**
 * Attempt to parse a string as JSON and return a pretty-printed version.
 * Returns the original string unchanged if it is not valid JSON.
 *
 * @param {string} str
 * @returns {string}
 */
export function tryPrettyJson(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

/**
 * Format a timestamp (ISO string or any Date-compatible value) as HH:MM:SS
 * using the user's locale settings.
 *
 * @param {string|Date} ts
 * @returns {string}
 */
export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
