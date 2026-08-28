(function configureCadViewer(global) {
  const query = new URLSearchParams(global.location.search);
  const existing = global.CAD_VIEWER_CONFIG || {};

  global.CAD_VIEWER_CONFIG = {
    ...existing,
    // Set to 'zh-CN' or 'en' to control the viewer interface language.
    language: existing.language || 'en',
    dataBaseUrl: query.get('data')
      || existing.dataBaseUrl
      || '../cad-data/open/',
  };
})(window);
