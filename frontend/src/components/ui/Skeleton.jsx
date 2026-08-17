import React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-gradient-to-r from-white/5 via-white/10 to-white/5',
        'bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonLoader({ className, ...props }) {
  return (
    <Skeleton className={cn('rounded-lg', className)} {...props} />
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-lg bg-white/5 border border-white/10 p-6 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 rounded-md" />
      <Skeleton className="h-3 w-32 rounded-md" />
    </div>
  );
}

export function SkeletonWardrobeGrid({ count = 8 }) {
  const heights = ['h-48', 'h-64', 'h-56', 'h-72', 'h-48', 'h-80', 'h-60', 'h-52'];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-lg', heights[i % heights.length])} />
      ))}
    </div>
  );
}

export function SkeletonChatMessage({ isUser = false }) {
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="space-y-2 flex-1 max-w-xs">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonStatCard({ className }) {
  return (
    <div className={cn('rounded-lg bg-white/5 border border-white/10 p-6 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-5 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
      <Skeleton className="h-8 w-16 rounded-md" />
      <Skeleton className="h-3 w-24 rounded-md" />
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
