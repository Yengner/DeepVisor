import classes from "./LiveIndicator.module.css";

/**
 * Green pulsing "Live" marker for advertising observed delivering today.
 * Pass `label={null}` to render the dot alone next to existing text.
 */
export function LiveIndicator({
  label = "Live",
  title,
}: {
  label?: string | null;
  title?: string;
}) {
  return (
    <span className={classes.live} title={title}>
      <span className={classes.dot} aria-hidden="true" />
      {label ? <span>{label}</span> : <span className={classes.srOnly}>Live</span>}
      {title && <span className={classes.srOnly}>{` · ${title}`}</span>}
    </span>
  );
}
