interface ProgressBarProps {
    value: number; // Current progress value
    max: number; // Maximum value
  }
  
  const ProgressBar = ({ value, max }: ProgressBarProps) => {
    const percentage = Math.min((value / max) * 100, 100); // Ensure it doesn't exceed 100%
  
    return (
      <div className="w-full bg-[#cb692c] rounded-full h-4">
        <div
          className="bg-[#b5dc38] h-4 rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };
  
  export default ProgressBar;