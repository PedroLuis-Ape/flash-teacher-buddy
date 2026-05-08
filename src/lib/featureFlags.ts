/**
 * Feature flags for the application
 * Control visibility and access to features
 *
 * SAFE MODE: Set flags to false to disable heavy features for debugging.
 * The app will use stable fallbacks when features are off.
 */

export const FEATURE_FLAGS = {
  // ─── Store & Economy ───────────────────────────────────
  /** Store visibility — hides Store button & route when false */
  store_visible: true,
  /** Economy system — balance, inventory, PTS/XP when false */
  economy_enabled: true,
  /** Weekly PTS → PITECOIN conversion cron */
  conversion_cron_enabled: false,
  /** Admin skins catalog management */
  admin_skins_enabled: true,
  /** User directory / search */
  directory_enabled: false,
  /** Gifting system (Admin → Gifts) */
  gifting_enabled: false,
  /** Present Box visibility */
  present_inbox_visible: true,
  /** Currency header across all pages */
  currency_header_enabled: true,

  // ─── Journey & Realms ──────────────────────────────────
  /** Journey system */
  journey_enabled: false,
  /** Reinos (Realms) — Modo Reino card + /reinos route */
  reinos_enabled: true,

  // ─── Classes & Communication ───────────────────────────
  /** Classes/Student-Teacher linking system */
  classes_enabled: true,
  /** Class communications (chat, DM, comments) */
  class_comms_enabled: true,
  /** Meus Alunos (professor's student list) */
  meus_alunos_enabled: true,

  // ─── Study Engine (performance-sensitive) ──────────────
  /**
   * Word hints / interactive text in study views
   * When false: renders plain text (no highlight, no tooltip)
   */
  word_hints_enabled: true,

  /**
   * List glossary (global translations per list)
   * When false: skips glossary fetch & merge — manual word_hints still work if word_hints_enabled
   */
  glossary_enabled: true,

  /**
   * Card images in study views
   * When false: hides ImageCard components — text-only cards
   */
  study_images_enabled: true,

  /**
   * Page transition animations
   * When false: instant page changes, no fade/scale animation
   */
  page_transitions_enabled: true,

  /**
   * Offline mode (download lists for offline use)
   * When false: hides download buttons, disables IndexedDB caching
   */
  offline_mode_enabled: false,

  /**
   * Activity heartbeat (updates last_active_at every 60s)
   * When false: no periodic profile updates — reduces DB writes
   */
  heartbeat_enabled: true,

  /**
   * Swipe navigation on mobile
   * When false: no swipe gesture handling
   */
  swipe_navigation_enabled: true,

  // ─── Importer ──────────────────────────────────────────
  /**
   * Bulk Import 2.0 — tolerant separator detection (/, |, =>, —, –, -, tab)
   * + editable review step in BulkImportDialog before persisting.
   * When false: falls back to legacy " / "-only parser and read-only preview.
   * Safe to toggle at runtime; affects only parse + preview UI, not persistence shape.
   */
  bulk_import_v2: true,

  /**
   * Layered cards — allow a single "main card" to contain multiple internal
   * meaning layers (translations + examples). Off by default; when off, the
   * import parser ignores indentation, the Merge UI is hidden and the study
   * engine does not expand layers. Pure additive feature.
   */
  layered_cards: true,

  /**
   * Study Intelligence Engine — weighted scoring (new/misses/recency/red − mastery)
   * for initial deck ordering + dynamic re-injection of failed cards ~5 slots ahead.
   * When false: legacy ordering by incorrect_count only, no re-injection.
   * Scope: useStudyEngine. Safe to toggle at runtime.
   */
  intelligent_study_engine: false,
} as const;

/**
 * Quick preset: set all performance-sensitive flags to safe values.
 * To activate safe mode, copy these values into the flags above.
 */
export const SAFE_MODE_PRESET = {
  word_hints_enabled: false,
  glossary_enabled: false,
  study_images_enabled: false,
  page_transitions_enabled: false,
  offline_mode_enabled: false,
  heartbeat_enabled: false,
  swipe_navigation_enabled: false,
  economy_enabled: false,
  currency_header_enabled: false,
  present_inbox_visible: false,
} as const;
