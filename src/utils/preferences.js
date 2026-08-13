/**
 * Utility functions for managing user preferences in localStorage
 */

const PREFERENCE_PREFIX = 'abalone_';

/**
 * Save a preference to localStorage
 * @param {string} key - Preference key
 * @param {any} value - Preference value (will be JSON stringified)
 */
export function savePreference(key, value) {
    try {
        localStorage.setItem(PREFERENCE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        console.warn('Failed to save preference:', key, e);
    }
}

/**
 * Load a preference from localStorage
 * @param {string} key - Preference key
 * @param {any} defaultValue - Default value if preference not found
 * @returns {any} The preference value or default
 */
export function loadPreference(key, defaultValue) {
    try {
        const item = localStorage.getItem(PREFERENCE_PREFIX + key);
        return item !== null ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn('Failed to load preference:', key, e);
        return defaultValue;
    }
}

/**
 * Remove a preference from localStorage
 * @param {string} key - Preference key
 */
export function removePreference(key) {
    try {
        localStorage.removeItem(PREFERENCE_PREFIX + key);
    } catch (e) {
        console.warn('Failed to remove preference:', key, e);
    }
}
