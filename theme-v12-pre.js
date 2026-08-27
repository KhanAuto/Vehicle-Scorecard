(() => {
  const APP = window.VehicleScorecard;
  if (!APP?.constants?.THEME_KEY) return;
  const initKey = "vehicleScorecardV12ThemeInitialized";
  if (!localStorage.getItem(initKey)) {
    localStorage.setItem(APP.constants.THEME_KEY, "dark");
    localStorage.setItem(initKey, "1");
    document.documentElement.dataset.theme = "dark";
  }
})();
