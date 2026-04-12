'use client';

import { useState, useEffect } from 'react';

export function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;

    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;

  return (
    <span className="font-mono tabular-nums">
      {min > 0 ? `${min}m ${sec}s` : `${sec}s`}
    </span>
  );
}
