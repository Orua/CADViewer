(function configureCadViewer(global) {
  const host = global.location.hostname.toLowerCase();
  const isLocalDevelopment = host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1';
  const query = new URLSearchParams(global.location.search);
  const existing = global.CAD_VIEWER_CONFIG || {};

  global.CAD_VIEWER_CONFIG = {
    ...existing,
    // Set to 'zh-CN' or 'en' to control the viewer interface language.
    language: existing.language || 'zh-CN',
    dataBaseUrl: query.get('data')
      || existing.dataBaseUrl
      || (isLocalDevelopment ? '../cad-data/' : 'https://mlightcad.gitlab.io/cad-data/'),
  };
})(window);
