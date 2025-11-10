// Confetti wrapper to handle dynamic imports
export const triggerConfetti = async (options: any = {}) => {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default || confettiModule;

    const defaults = {
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#10b981', '#34d399', '#6ee7b7']
    };

    return confetti({ ...defaults, ...options });
  } catch (error) {
    console.warn('Confetti effect not available:', error);
  }
};

export const successConfetti = () => {
  return triggerConfetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10b981', '#34d399', '#6ee7b7', '#86efac']
  });
};

export const celebrationConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio: number, opts: any) {
    triggerConfetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
};