
module.exports = process.env.CONNECT_MONGO_COV
  ? require('./lib-cov/connect-mongo')
  : require('./lib/connect-mongo');