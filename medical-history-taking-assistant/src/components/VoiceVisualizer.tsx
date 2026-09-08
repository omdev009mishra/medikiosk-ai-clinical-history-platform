import React from 'react';
import { motion } from 'motion/react';

interface VoiceVisualizerProps {
  isActive: boolean;
  colorClass?: string;
  barCount?: number;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isActive,
  colorClass = 'bg-[#8BA888]',
  barCount = 7,
}) => {
  const bars = Array.from({ length: barCount });

  return (
    <div className="flex items-center justify-center gap-1.5 h-8 px-3" aria-label="Audio waveform visualizer">
      {bars.map((_, i) => {
        // Vary heights mathematically for natural waveform appearance
        const minHeight = 4;
        const maxHeight = 20 + ((i * 7) % 12);
        return (
          <motion.span
            key={i}
            className={`w-1 rounded-full ${colorClass}`}
            animate={
              isActive
                ? {
                    height: [minHeight, maxHeight, minHeight + 2, maxHeight * 0.8, minHeight],
                  }
                : { height: 4 }
            }
            transition={
              isActive
                ? {
                    duration: 0.8 + (i % 3) * 0.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.08,
                  }
                : { duration: 0.2 }
            }
          />
        );
      })}
    </div>
  );
};
