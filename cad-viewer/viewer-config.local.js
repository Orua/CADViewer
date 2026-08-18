(function configureLocalCadViewer(global) {
  const query = new URLSearchParams(global.location.search);
  const existing = global.CAD_VIEWER_CONFIG || {};

  global.CAD_VIEWER_CONFIG = {
    ...existing,
    dataBaseUrl: query.get('data')
      || existing.dataBaseUrl
      || '../cad-data/',
  };
})(window);
