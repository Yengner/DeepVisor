/**
 * Features whose code is kept but which owners cannot use yet. Each one is hidden because
 * showing it would promise something that does not work. Turn a flag on only when the
 * condition in its comment is true.
 */

/**
 * "Add ad set" and "Add ad" to an existing campaign. The builders exist
 * (`ManualMetaAdSetBuilder`, `ManualMetaAdBuilder`), but their final button posts to
 * `/api/meta/create-campaign`, which does not exist. Enable once they finish somewhere real:
 * saving a draft in DeepVisor, or an approved publish path.
 */
export const META_CHILD_CREATION_AVAILABLE: boolean = false;

/**
 * Alert and report preferences in Settings. They are saved, but nothing that runs reads them:
 * the bell is written by Insights, which ignores them, and no report generator runs. Enable
 * once the notification writer honors the saved preferences.
 */
export const ALERT_PREFERENCES_AVAILABLE: boolean = false;

/**
 * Trend findings in Decisions, Reports and the assistant. No sync or schedule creates new
 * ones, so showing saved rows would present old observations as current. Enable once the
 * trend engine runs again.
 */
export const STORED_FINDINGS_AVAILABLE: boolean = false;
