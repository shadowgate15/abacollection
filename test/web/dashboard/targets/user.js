const test = require('ava');
const { factory } = require('factory-girl');
const dayjs = require('dayjs');
const ms = require('ms');

const config = require('../../../../config');
const { Users, Targets } = require('../../../../app/models');
const {
  retrieveTargets,
  retrieveTarget
} = require('../../../../app/controllers/web/dashboard/targets');

const phrases = require('../../../../config/phrases');

const utils = require('../../../utils');

test.before(utils.setupMongoose);
test.before(utils.defineUserFactory);
test.before(utils.defineClientFactory);
test.before(utils.defineProgramFactory);
test.before(utils.defineTargetFactory);
test.before(utils.defineDataFactory);

test.after.always(utils.teardownMongoose);

test.beforeEach(async (t) => {
  // Set password
  t.context.password = '!@K#NLK!#N';
  // Create user
  let user = await factory.build('user');
  // Must register in order for authentication to work
  user = await Users.register(user, t.context.password);
  // Setup user for otp
  user[config.userFields.hasSetPassword] = true;
  t.context.user = await user.save();

  await utils.setupWebServer(t);
  await utils.loginUser(t);

  const member = await factory.create('member', {
    user: t.context.user,
    group: 'user'
  });
  t.context.client = await factory.create('client', { members: member });
  t.context.program = await factory.create('program', {
    client: t.context.client
  });

  t.context.root = `/en/dashboard/clients/${t.context.client.id}/programs/${t.context.program.id}`;
});

test('retrieveTargets > get targets only linked to program', async (t) => {
  t.plan(2);

  const { program } = t.context;
  const targets = await factory.createMany('target', [{ program }, {}]);

  const ctx = {
    state: {
      program
    }
  };

  await retrieveTargets(ctx, () => {
    t.is(ctx.state.targets.length, 1);
    t.is(ctx.state.targets[0].id, targets[0].id);
  });
});

test('retrieveTarget > get target', async (t) => {
  t.plan(2);

  const targets = await factory.createMany('target', 2);

  const ctx = {
    params: { target_id: targets[0].id },
    state: {
      targets,
      program: targets[0].program,
      breadcrumbs: [targets[0].id],
      client: { id: '32' },
      l: (url) => `/en${url}`
    }
  };

  await retrieveTarget(ctx, () => {
    t.is(ctx.state.target.id, targets[0].id);
    t.is(ctx.state.breadcrumbs[0].name, targets[0].name);
  });
});

test('retrieveTarget > errors if no params', async (t) => {
  const targets = await factory.createMany('target', 2);

  const ctx = {
    params: { target_id: '' },
    request: {
      body: { target: '' }
    },
    state: { targets },
    translateError: (error) => error,
    throw: (error) => {
      throw error;
    }
  };

  await t.throwsAsync(() => retrieveTarget(ctx, () => {}), {
    message: 'TARGET_DOES_NOT_EXIST'
  });
});

test('retrieveTarget > errors if target does not exist', async (t) => {
  const ctx = {
    params: { target_id: '1' },
    state: { targets: [] },
    translateError: (error) => error,
    throw: (error) => {
      throw error;
    }
  };

  await t.throwsAsync(() => retrieveTarget(ctx, () => {}), {
    message: 'TARGET_DOES_NOT_EXIST'
  });
});

test('GET targets > successfully with no targets', async (t) => {
  const { web, root } = t.context;

  const res = await web.get(`${root}/targets`);

  t.is(res.status, 200);
  t.true(res.text.includes('No targets for this client yet.'));
});

test('GET targets > successfully with targets', async (t) => {
  const { web, root, program } = t.context;

  const target = await factory.create('target', { program });

  const res = await web.get(`${root}/targets`);

  t.is(res.status, 200);
  t.true(res.text.includes(target.name));
});

test('DELETE targets > fails if target does not exist', async (t) => {
  const { web, root } = t.context;

  const res = await web.delete(`${root}/targets/1`);

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.TARGET_DOES_NOT_EXIST);
});

test('DELETE targets > fails if not admin', async (t) => {
  const { web, user } = t.context;

  const member = await factory.create('member', { user, group: 'user' });
  const client = await factory.create('client', { members: member });
  const program = await factory.create('program', { client });
  const target = await factory.create('target', { program });

  let query = await Targets.findOne({ id: target.id });
  t.is(query.id, target.id);

  const res = await web.delete(
    `/en/dashboard/clients/${client.id}/programs/${program.id}/targets/${target.id}`
  );

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.NO_PERMISSION);

  query = await Targets.findOne({ id: target.id });
  t.is(query.id, target.id);
});

test('GET data(JSON) > frequency > default', async (t) => {
  t.plan(14);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    program,
    data_type: 'Frequency'
  });
  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: 1,
        target,
        date: dayjs().subtract(i, 'day').toDate(),
        data_type: 'Frequency'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: 1,
      target,
      date: dayjs().subtract(1, 'day').toDate(),
      data_type: 'Frequency'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series[0].data.length, 10);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Count per Day');

  for (let i = 0; i < 10; i++) {
    const data = res.body.series[0].data[i];
    t.is(data.y, i === 8 ? 2 : 1);
  }
});

test('GET data(JSON) > frequency > monthly', async (t) => {
  t.plan(5);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    program,
    data_type: 'Frequency'
  });
  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: 1,
        target,
        date: dayjs('5/15/2020').subtract(i, 'day').toDate(),
        data_type: 'Frequency'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: 1,
      target,
      date: dayjs('5/15/2020').subtract(1, 'day').toDate(),
      data_type: 'Frequency'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph?interval=M`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series[0].data.length, 1);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Count per Day');

  t.is(res.body.series[0].data[0].y, 11);
});

test('GET data(JSON) > percent correct > default', async (t) => {
  t.plan(15);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    program,
    data_type: 'Percent Correct'
  });
  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: 'correct',
        target,
        date: dayjs().subtract(i, 'day').toDate(),
        data_type: 'Percent Correct'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: 'incorrect',
      target,
      date: dayjs().subtract(1, 'day').toDate(),
      data_type: 'Percent Correct'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series[0].data.length, 10);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Percent Correct per Day');
  t.is(res.body.yaxisMax, 100);

  for (let i = 0; i < 10; i++) {
    const data = res.body.series[0].data[i];
    t.is(data.y, i === 8 ? 50 : 100);
  }
});

test('GET data(JSON) > duration > default', async (t) => {
  t.plan(14);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    program,
    data_type: 'Duration'
  });
  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: ms('1 min'),
        target,
        date: dayjs().subtract(i, 'day').toDate(),
        data_type: 'Duration'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: ms('1 min'),
      target,
      date: dayjs().subtract(1, 'day').toDate(),
      data_type: 'Duration'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series[0].data.length, 10);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Duration(mins) per Day');

  for (let i = 0; i < 10; i++) {
    const data = res.body.series[0].data[i];
    t.is(data.y, i === 8 ? 2 : 1);
  }
});

test('GET data(JSON) > rate > default', async (t) => {
  t.plan(28);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    program,
    data_type: 'Rate'
  });
  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: { correct: 1, incorrect: 1, counting_time: ms('1m') },
        target,
        date: dayjs().subtract(i, 'day').toDate(),
        data_type: 'Rate'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: { correct: 2, incorrect: 2, counting_time: ms('1m') },
      target,
      date: dayjs().subtract(1, 'day').toDate(),
      data_type: 'Rate'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series.length, 2);
  t.is(res.body.series[0].data.length, 10);
  t.is(res.body.series[1].data.length, 10);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Count per Minute (first)');

  // Check that series was named
  t.is(res.body.series[0].name, 'Correct');
  t.is(res.body.series[1].name, 'Incorrect');

  for (let i = 0; i < 10; i++) {
    let data = res.body.series[0].data[i];
    t.is(data.y, 1);

    data = res.body.series[1].data[i];
    t.is(data.y, 1);
  }
});

test('GET data(JSON) > task analysis > default', async (t) => {
  t.plan(15);

  const { web, root, program } = t.context;

  const target = await factory.create('target', {
    ta: ['1', '2', '3', '4'],
    program,
    data_type: 'Task Analysis'
  });

  const datas = [];
  for (let i = 0; i < 10; i++) {
    datas.push(
      factory.create('data', {
        value: ['correct', 'correct', 'correct', 'correct'],
        target,
        date: dayjs().subtract(i, 'day').toDate(),
        data_type: 'Task Analysis'
      })
    );
  }

  datas.push(
    factory.create('data', {
      value: ['correct', 'correct', 'incorrect', 'incorrect'],
      target,
      date: dayjs().subtract(1, 'day').toDate(),
      data_type: 'Task Analysis'
    })
  );

  await Promise.all(datas);

  const res = await web
    .get(`${root}/targets/${target.id}/graph`)
    .set('Accept', 'application/json')
    .send();

  t.is(res.status, 200);
  t.is(res.body.series[0].data.length, 10);
  t.is(res.body.xaxisTitle, 'Date');
  t.is(res.body.yaxisTitle, 'Percent Correct per Day');
  t.is(res.body.yaxisMax, 100);

  for (let i = 0; i < 10; i++) {
    const data = res.body.series[0].data[i];
    t.is(data.y, i === 8 ? 75 : 100);
  }
});
