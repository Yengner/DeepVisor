import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  percentageChange?: number;
  tooltip?: string;
  icon?: React.ReactNode;
  backgroundClass?: string; // For customizable background classes
}

const MetricCard = ({
  title,
  value,
  percentageChange,
  tooltip,
  icon,
  backgroundClass = "bg-white dark:bg-gray-900", // Default neutral background
}: MetricCardProps) => {
  const changeColor = percentageChange
    ? percentageChange > 0
      ? 'text-green-500'
      : 'text-red-500'
    : 'text-gray-500';

  return (
    <div
      className={`shadow-md rounded-md p-4 flex flex-col items-start justify-between hover:scale-105 transition-transform hover:bg-[#f8ebd2] hover:text-[#fbfbe9] duration-150 ease-in-out ${backgroundClass}`}
      data-tooltip-id={`${title}-tooltip`}
    >
      <div className="flex justify-between items-center w-full gap-1">
        {icon && <span className="text-2xl">{icon}</span>}
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-300">{title}</h2>
      </div>
      <p className="text-lg font-bold mt-1 text-gray-700 dark:text-gray-100">{value}</p>
      {percentageChange !== undefined && (
        <p className={`text-xs font-medium mt-1 ${changeColor}`}>
          {percentageChange > 0 ? '+' : ''}
          {percentageChange}%
        </p>
      )}
      {tooltip && (
        <Tooltip
          id={`${title}-tooltip`}
          content={tooltip}
          place="top"
          delayShow={500}
          style={{
            backgroundColor: '#3e4e38',
            color: '#fff',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '12px',
          }}
        />
      )}
    </div>
  );
};

export default MetricCard;
