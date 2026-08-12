export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  const iPadOnDesktopSafari = platform === 'macintel' && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || iPadOnDesktopSafari;
}

export function isSafariBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('safari')
    && !userAgent.includes('chrome')
    && !userAgent.includes('crios')
    && !userAgent.includes('fxios')
    && !userAgent.includes('edg');
}

export function shouldShowIosInstallHint() {
  return isIosDevice() && !isStandaloneApp();
}
