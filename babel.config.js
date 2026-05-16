module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function({ types: t }) {
        return {
          visitor: {
            MetaProperty(path) {
              if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
                path.replaceWith(t.identifier('process'));
              }
            }
          }
        };
      }
    ]
  };
};
