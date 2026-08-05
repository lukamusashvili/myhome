const { createStatement } = require('../services/tnetService');

function extractToken(ctx) {
  const header = ctx.request.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : null;
}

async function create(ctx) {
  const token = extractToken(ctx);

  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Missing bearer token' };
    return;
  }

  const fields = ctx.request.body;

  if (!fields || typeof fields !== 'object') {
    ctx.status = 400;
    ctx.body = { error: 'Request body must be a JSON object of form fields' };
    return;
  }

  const { status, data } = await createStatement(token, fields);

  ctx.status = status;
  ctx.body = data;
}

module.exports = { create };
