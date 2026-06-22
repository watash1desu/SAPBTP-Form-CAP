const cds = require('@sap/cds');

cds.on('bootstrap', (app) => {
  app.use((req, res, next) => {
    if (req.path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    next();
  });
});

module.exports = cds.server;
