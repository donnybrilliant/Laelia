import { useState, useEffect } from 'react';

export function useLandscapeMobile() {
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);

  useEffect(() => {
    const checkLandscapeMobile = () => {
      // Landscape mobile: small height (under 500px) AND wider than tall
      const isLandscape = window.innerWidth > window.innerHeight;
      const isSmallHeight = window.innerHeight < 500;
      setIsLandscapeMobile(isLandscape && isSmallHeight);
    };

    checkLandscapeMobile();
    window.addEventListener('resize', checkLandscapeMobile);
    window.addEventListener('orientationchange', checkLandscapeMobile);

    return () => {
      window.removeEventListener('resize', checkLandscapeMobile);
      window.removeEventListener('orientationchange', checkLandscapeMobile);
    };
  }, []);

  return isLandscapeMobile;
}
