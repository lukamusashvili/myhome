const Router = require('@koa/router');
const statementsController = require('../controllers/statementsController');
const myhomeController = require('../controllers/myhomeController');

const router = new Router();

router.post('/api/statements', statementsController.create);
router.get('/api/myhome/statements/:id', myhomeController.getById);

module.exports = router;
