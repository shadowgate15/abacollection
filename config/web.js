const ms = require('ms');

const i18n = require('../helpers/i18n');
const logger = require('../helpers/logger');
const passport = require('../helpers/passport');
const routes = require('../routes');
const env = require('./env');
const cookieOptions = require('./cookies');
const koaCashConfig = require('./koa-cash');
const config = require('.');

module.exports = (client) => ({
  routes: routes.web,
  logger,
  i18n,
  cookies: cookieOptions,
  // Timed log out
  session: {
    ttl: config.env === 'development' ? null : ms('15m')
  },
  meta: config.meta,
  views: config.views,
  passport,
  koaCash: env.CACHE_RESPONSES ? koaCashConfig(client) : false,
  cacheResponses: env.CACHE_RESPONSES
    ? {
        routes: [
          '/css/(.*)',
          '/img/(.*)',
          '/js/(.*)',
          '/fonts/(.*)',
          '/browserconfig(.*)',
          '/robots(.*)',
          '/site(.*)',
          '/favicon(.*)'
        ]
      }
    : false
});
