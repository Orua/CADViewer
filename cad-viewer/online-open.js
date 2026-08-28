(function () {
  "use strict";

  function getDrawingUrl() {
    var file = new URLSearchParams(window.location.search).get("file");
    if (!file) {
      return "";
    }

    try {
      var url = new URL(file, window.location.origin);
      return url.origin === window.location.origin ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  var recentCookieName = "goldenluckCadRecent";
  var maximumRecentDrawings = 10;
  var currentDrawing = null;

  function t(key, values, fallback) {
    return window.cadViewerI18n ? window.cadViewerI18n.t(key, values) : fallback;
  }

  function getFileName(url) {
    var pathname = new URL(url, window.location.href).pathname;
    var segments = pathname.split("/");
    return decodeURIComponent(segments[segments.length - 1] || t("drawingFile", null, "图纸文件"));
  }

  function isLocalDrawingUrl(url) {
    try {
      return new URL(url, window.location.origin).origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function getRecentDrawings() {
    var match = document.cookie.match(new RegExp("(?:^|; )" + recentCookieName + "=([^;]*)"));
    if (!match) {
      return [];
    }

    try {
      var drawings = JSON.parse(decodeURIComponent(match[1]));
      return Array.isArray(drawings) ? drawings.filter(function (drawing) {
        return drawing && typeof drawing.name === "string" && (
          drawing.local === true || (typeof drawing.url === "string" && isLocalDrawingUrl(drawing.url))
        );
      }) : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecentDrawings(drawings) {
    document.cookie = recentCookieName + "=" + encodeURIComponent(JSON.stringify(drawings))
      + "; max-age=" + (60 * 60 * 24 * 180) + "; path=/; SameSite=Lax";
  }

  function rememberDrawing(url) {
    var drawing = { url: url, name: getFileName(url) };
    var drawings = getRecentDrawings().filter(function (item) {
      return item && item.url !== url;
    });
    drawings.unshift(drawing);
    saveRecentDrawings(drawings.slice(0, maximumRecentDrawings));
    return drawings.slice(0, maximumRecentDrawings);
  }

  function rememberLocalDrawing(name) {
    var drawing = { name: name || t("drawingFile", null, "图纸文件"), local: true };
    var drawings = getRecentDrawings().filter(function (item) {
      return item && !(item.local === true && item.name === drawing.name);
    });
    drawings.unshift(drawing);
    saveRecentDrawings(drawings.slice(0, maximumRecentDrawings));
    return drawings.slice(0, maximumRecentDrawings);
  }

  function addDrawingButton(fileList, drawing, isCurrent) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "file-list-item";
    if (drawing.url) {
      button.dataset.fileUrl = drawing.url;
    }
    if (drawing.local) {
      button.dataset.localHistory = "true";
    }
    button.textContent = isCurrent ? t("currentDrawing", { name: drawing.name }, "当前：" + drawing.name) : drawing.name;
    button.title = drawing.name;
    if (isCurrent) {
      button.classList.add("active");
    }
    fileList.appendChild(button);
    return button;
  }

  function renderDrawings(currentDrawing) {
    var fileList = document.getElementById("predefinedFileList");
    if (!fileList) {
      return null;
    }

    fileList.replaceChildren();
    var recentDrawings = getRecentDrawings();
    var currentButton = currentDrawing ? addDrawingButton(fileList, currentDrawing, true) : null;

    recentDrawings.forEach(function (drawing) {
      if (!drawing || (currentDrawing && drawing.url === currentDrawing.url && drawing.name === currentDrawing.name && drawing.local === currentDrawing.local)) {
        return;
      }
      addDrawingButton(fileList, drawing, false);
    });
    return currentButton;
  }

  function openUrlDrawing(url) {
    var drawing = { url: url, name: getFileName(url) };
    currentDrawing = drawing;
    rememberDrawing(url);
    return renderDrawings(drawing);
  }

  function openLocalDrawing(name) {
    var drawing = { name: name || t("drawingFile", null, "图纸文件"), local: true };
    currentDrawing = drawing;
    rememberLocalDrawing(drawing.name);
    return renderDrawings(drawing);
  }

  var drawingUrl = getDrawingUrl();
  var currentButton = drawingUrl ? openUrlDrawing(drawingUrl) : renderDrawings(null);
  window.cadViewerDrawingList = { openUrl: openUrlDrawing, openLocal: openLocalDrawing };
  window.addEventListener("cadviewer-languagechange", function () {
    currentButton = renderDrawings(currentDrawing);
  });

  if (currentButton) {
    // The viewer binds delegated button handlers during DOMContentLoaded.
    window.addEventListener("load", function () {
      currentButton.click();
    });
  }
}());
