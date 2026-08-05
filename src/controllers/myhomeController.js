const { getStatement } = require('../services/myhomeService');

async function getById(ctx) {
  const { id } = ctx.params;

  if (!/^\d+$/.test(id)) {
    ctx.status = 400;
    ctx.body = { error: 'id must be numeric' };
    return;
  }

  const { status, statement } = await getStatement(id);

  ctx.status = status;
  ctx.body = statement ? { statement } : { error: 'Not found' };
}

module.exports = { getById };
