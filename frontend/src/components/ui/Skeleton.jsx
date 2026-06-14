import React from 'react';
import { cn } from '../../lib/utils';

export function SkeletonLoader({ className, ...props }) {
  return (
    <div
      className={cn('shimmer rounded-lg bg-zinc-900', className)}
      {...props}
    />
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <SkeletonLoader className="h-10 w-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <SkeletonLoader className="h-4 w-24" />
          <SkeletonLoader className="h-3 w-16" />
        </div>
      </div>
      <SkeletonLoader className="h-8 w-20" />
      <SkeletonLoader className="h-3 w-32" />
    </div>
  );
}

export function SkeletonWardrobeGrid({ count = 8 }) {
  const heights = ['h-48', 'h-64', 'h-56', 'h-72', 'h-48', 'h-80', 'h-60', 'h-52'];
  return (
    <div className="masonry-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="masonry-item">
          <SkeletonLoader className={cn('w-full rounded-2xl', heights[i % heights.length])} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChatMessage({ isUser = false }) {
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <SkeletonLoader className="h-8 w-8 rounded-full shrink-0" />
      <div className="space-y-2 flex-1 max-w-xs">
        <SkeletonLoader className="h-4 w-full rounded-xl" />
        <SkeletonLoader className="h-4 w-3/4 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonSidebar() {
  return (
    <div className="space-y-1 px-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2">
          <SkeletonLoader className="h-4 w-4 rounded" />
          <SkeletonLoader className="h-4 flex-1 rounded" />
        </div>
      ))}
    </div>
  );
}

export function AIThinkingAnimation() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 rounded-xl chat-bubble-ai w-fit">
      <span className="text-xs text-zinc-500 mr-2">AI is thinking</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-brand-blue"
          style={{
            animation: `typing-blink 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default SkeletonLoader;
