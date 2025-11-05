/**
 * Cross-tab synchronization utility
 *
 * This utility allows different pages/components to notify each other
 * across browser tabs when data changes occur.
 */

/**
 * Notify all open tabs that data sources have been updated
 */
export function notifyDataSourcesUpdate() {
  console.log('[CrossTabSync] Notifying data sources update')

  // Trigger storage event for other tabs
  localStorage.setItem('data-sources-update', Date.now().toString())

  // Trigger custom event for same tab
  window.dispatchEvent(new CustomEvent('data-sources-update'))
}

/**
 * Notify all open tabs that PII configuration has changed
 */
export function notifyPIIConfigUpdate() {
  console.log('[CrossTabSync] Notifying PII config update')

  // Trigger storage event for other tabs
  localStorage.setItem('pii-config-update', Date.now().toString())

  // Trigger custom event for same tab
  window.dispatchEvent(new CustomEvent('pii-config-update'))
}

/**
 * Notify all open tabs that catalog data has changed
 */
export function notifyCatalogUpdate() {
  console.log('[CrossTabSync] Notifying catalog update')

  // Trigger storage event for other tabs
  localStorage.setItem('data-sources-update', Date.now().toString())

  // Trigger custom event for same tab
  window.dispatchEvent(new CustomEvent('data-sources-update'))
}

/**
 * Generic notification for any data update
 */
export function notifyDataUpdate(eventKey: string) {
  console.log('[CrossTabSync] Notifying data update:', eventKey)

  // Trigger storage event for other tabs
  localStorage.setItem(eventKey, Date.now().toString())

  // Trigger custom event for same tab
  window.dispatchEvent(new CustomEvent(eventKey))
}
