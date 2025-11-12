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
  store_visible: true,

  /**
   * Economy system visibility
   * When false: no balance, no inventory, no economy UI
   * When true: shows balance badge, inventory and appearance tabs, users earn PTS/XP
   */
  economy_enabled: true,

  /**
   * Weekly conversion cron job
   * When false: no automatic PTS → PITECOIN conversion
   * When true: automatic conversion every Sunday 23:59 (São Paulo time)
   */
  conversion_cron_enabled: false,

  /**
   * Admin skins catalog management
   * When false: no Admin → Catalog panel
   * When true: developer_admin can manage skins catalog
   */
  admin_skins_enabled: true,

  /**
   * User directory / search
   * When false: no user search functionality
   * When true: admin can search users by tag/ID
   */
  directory_enabled: false,

  /**
   * Gifting system
   * When false: no Admin → Gifts panel
   * When true: developer_admin can send gifts to users
   */
  gifting_enabled: false,

  /**
   * Present Box visibility
   * When false: no gift inbox in UI
   * When true: users can see and claim their gifts
   */
  present_inbox_visible: true,

  /**
   * Currency header
   * When false: no global currency display
   * When true: shows points + PITECOIN in header across all pages
   */
  currency_header_enabled: true,

  /**
   * Journey system
   * When false: journey features disabled
   * When true: journey features enabled
   */
  journey_enabled: false,

  /**
   * Reinos (Realms) system
   * When false: no Modo Reino button or features
   * When true: shows Modo Reino card on home and enables /reinos route
   */
  reinos_enabled: true,

  /**
   * Classes/Student-Teacher linking system
   * When false: no classes, messages, notifications, student-teacher features
   * When true: enables full integration system (Turmas + Atribuições)
   */
  classes_enabled: true,
} as const;
