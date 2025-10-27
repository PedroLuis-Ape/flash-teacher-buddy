/**
 * Feature flags for the application
 * Control visibility and access to features
 */

export const FEATURE_FLAGS = {
  /**
   * Store visibility
   * When false: no Store button, route not accessible from UI
   * When true: show Store button and enable the route
   */
  store_visible: false,

  /**
   * Economy system visibility
   * When false: no balance, no inventory, no economy UI
   * When true: shows balance badge, inventory and appearance tabs, users earn PTS/XP
   */
  economy_enabled: false,

  /**
   * Weekly conversion cron job
   * When false: no automatic PTS → PITECOIN conversion
   * When true: automatic conversion every Sunday 23:59 (São Paulo time)
   */
  conversion_cron_enabled: false,
} as const;
