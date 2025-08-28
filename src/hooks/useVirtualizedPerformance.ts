import { useRef } from 'react';

// Performance optimization hook
export function useVirtualizedPerformance() {
  const performanceRef = useRef({
    frameTime: 0,
    lastFrameTime: Date.now(),
    averageFrameTime: 16, // Target 60fps
    frameCount: 0
  });

  const measurePerformance = () => {
    const now = Date.now();
    const frameTime = now - performanceRef.current.lastFrameTime;
    performanceRef.current.frameTime = frameTime;
    performanceRef.current.frameCount++;
    
    // Exponential moving average for smoother metrics
    performanceRef.current.averageFrameTime = 
      (performanceRef.current.averageFrameTime * 0.9) + (frameTime * 0.1);
    
    performanceRef.current.lastFrameTime = now;
    
    return {
      currentFrameTime: frameTime,
      averageFrameTime: performanceRef.current.averageFrameTime,
      fps: 1000 / performanceRef.current.averageFrameTime,
      frameCount: performanceRef.current.frameCount
    };
  };

  const getPerformanceMetrics = () => ({
    currentFrameTime: performanceRef.current.frameTime,
    averageFrameTime: performanceRef.current.averageFrameTime,
    fps: 1000 / performanceRef.current.averageFrameTime,
    frameCount: performanceRef.current.frameCount,
    isPerformant: performanceRef.current.averageFrameTime < 20 // Below 50fps
  });

  return {
    measurePerformance,
    getPerformanceMetrics
  };
}