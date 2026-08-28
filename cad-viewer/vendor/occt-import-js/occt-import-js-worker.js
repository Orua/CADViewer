importScripts('occt-import-js.js');

const importMethods = {
  step: 'ReadStepFile',
  iges: 'ReadIgesFile',
  brep: 'ReadBrepFile',
};

onmessage = async function (event) {
  try {
    const occt = await occtimportjs({
      locateFile: function (path) {
        return path;
      },
    });
    const methodName = importMethods[event.data.format];
    if (!methodName || typeof occt[methodName] !== 'function') {
      throw new Error('不支持的三维模型格式。');
    }
    const result = occt[methodName](event.data.buffer, event.data.params);
    if (!result || result.success === false) {
      throw new Error('三维模型解析失败。');
    }
    postMessage({ type: 'result', result: result });
  } catch (error) {
    postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
