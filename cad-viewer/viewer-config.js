(function configureCadViewer(global) {
  const host = global.location.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const query = new URLSearchParams(global.location.search);
  const existing = global.CAD_VIEWER_CONFIG || {};

  global.CAD_VIEWER_CONFIG = {
    ...existing,
    dataBaseUrl: query.get('data')
      || existing.dataBaseUrl
      || (isLocal ? '../cad-data/' : 'https://mlightcad.gitlab.io/cad-data/'),
  };
})(window);
