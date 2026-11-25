/** Same splash as the one in index.html, so the start of the app has no flash. */
export function LoadingScreen() {
  return (
    <div className="lc-splash" role="status" aria-label="LC Shop">
      <img className="lc-splash__logo" src={`${import.meta.env.BASE_URL}logo-lockup.png`} alt="LC Shop" />
      <div className="lc-splash__bar" />
      <div className="lc-splash__tag">Buy • Shop • Enjoy</div>
    </div>
  );
}
