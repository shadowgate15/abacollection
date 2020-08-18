const Router = require('@koa/router');
const render = require('koa-views-render');
const paginate = require('koa-ctx-paginate');

const policies = require('../../helpers/policies');
const web = require('../../app/controllers/web');

const router = new Router({ prefix: '/dashboard' });

router.use(policies.ensureLoggedIn);
router.use(policies.ensureOtp);
router.use(web.breadcrumbs);
router.get('/', render('dashboard'));
router.use(web.dashboard.clients.retrieveClients);
//
// clients
//
router.get('/clients', paginate.middleware(10, 50), web.dashboard.clients.list);
router.put('/clients', web.dashboard.clients.add_client);
//
// client specific routes
//
const clientRouter = new Router({ prefix: '/clients/:client_id' });
clientRouter.use(web.dashboard.clients.retrieveClient);

clientRouter.get('/', render('dashboard/clients/overview'));
clientRouter.get('/settings', render('dashboard/clients/settings'));
clientRouter.post('/settings', web.dashboard.clients.settings);
clientRouter.delete(
  '/',
  web.dashboard.clients.ensureAdmin,
  web.dashboard.clients.delete_client
);
//
// programs
//
clientRouter.use(web.dashboard.programs.retrievePrograms);

clientRouter.get(
  '/programs',
  paginate.middleware(10, 50),
  web.dashboard.programs.list
);
clientRouter.put('/programs', web.dashboard.programs.addProgram);
//
// program specific routes
//
const programRouter = new Router({ prefix: '/programs/:program_id' });
programRouter.use(web.dashboard.programs.retrieveProgram);

programRouter.post('/', web.dashboard.programs.editProgram);
programRouter.delete(
  '/',
  web.dashboard.clients.ensureAdmin,
  web.dashboard.programs.deleteProgram
);
//
// targets
//
programRouter.use(web.dashboard.targets.retrieveTargets);

programRouter.get(
  '/targets',
  paginate.middleware(10, 50),
  web.dashboard.targets.list
);
programRouter.put('/targets', web.dashboard.targets.addTarget);
//
// target specific routes
//
const targetRouter = new Router({ prefix: '/targets/:target_id' });
targetRouter.use(web.dashboard.targets.retrieveTarget);

targetRouter.get('/', web.dashboard.targets.getData);
targetRouter.post('/', web.dashboard.targets.editTarget);
targetRouter.delete(
  '/',
  web.dashboard.clients.ensureAdmin,
  web.dashboard.targets.deleteTarget
);

programRouter.use(targetRouter.routes());
clientRouter.use(programRouter.routes());
router.use(clientRouter.routes());

module.exports = router;
