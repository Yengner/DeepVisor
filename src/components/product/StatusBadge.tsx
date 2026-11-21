import { useLabels } from '@/lib/client/hooks/useLabels';
import { statusPresentation } from './presentation';
import classes from './Product.module.css';
export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = statusPresentation(status);
  const labels = useLabels();
  return <span className={`${classes.status} ${classes[value.tone]}`}>{labels.status(value.label)}</span>;
}
