import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  progress: number;
  message?: string;
  timeElapsed?: number;
}

export const LoadingOverlay = ({ progress, message = "Loading dashboard...", timeElapsed }: LoadingOverlayProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    // Clamp progress between 0 and 100
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    setDisplayProgress(clampedProgress);
  }, [progress]);

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (displayProgress / 100) * circumference;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border-2 rounded-lg p-8 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-primary transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{Math.round(displayProgress)}%</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            {timeElapsed !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">{timeElapsed}ms</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
