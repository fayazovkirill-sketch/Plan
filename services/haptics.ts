export const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
  if (!navigator.vibrate) return;

  switch (pattern) {
    case 'light':
      navigator.vibrate(10);
      break;
    case 'medium':
      navigator.vibrate(20);
      break;
    case 'heavy':
      navigator.vibrate(50);
      break;
    case 'success':
      navigator.vibrate([10, 30, 10]);
      break;
    case 'error':
      navigator.vibrate([50, 50, 50]);
      break;
  }
};