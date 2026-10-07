import { statusPresentation } from './presentation';
import classes from './Product.module.css';
export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = statusPresentation(status);
  return <span className={`${classes.status} ${classes[value.tone]}`}>{value.label}</span>;
}
