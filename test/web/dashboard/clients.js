const test = require('ava');
const { factory } = require('factory-girl');
const dayjs = require('dayjs');

const config = require('../../../config');
const { Clients, Users } = require('../../../app/models');
const {
  retrieveClients,
  retrieveClient
} = require('../../../app/controllers/web/dashboard/clients');
const phrases = require('../../../config/phrases');

const utils = require('../../utils');

const { displayName } = config.passport.fields;

test.before(utils.setupMongoose);
test.before(utils.defineUserFactory);
test.before(utils.defineClientFactory);

test.after.always(utils.teardownMongoose);

test.beforeEach(async (t) => {
  // set password
  t.context.password = '!@K#NLK!#N';
  // create user
  let user = await factory.build('user');
  // must register in order for authentication to work
  user = await Users.register(user, t.context.password);
  // setup user for otp
  user[config.userFields.hasSetPassword] = true;
  t.context.user = await user.save();

  await utils.setupWebServer(t);
  await utils.loginUser(t);
});

test('retrieveClients > get clients that only the user has permissions for', async (t) => {
  t.plan(2);

  const members = await factory.createMany('member', 2);
  const clients = await factory.createMany('client', [
    { members: [members[0]] },
    { members: [members[1]] }
  ]);

  const ctx = {
    isAuthenticated: () => true,
    state: { user: members[0].user }
  };

  await retrieveClients(ctx, () => {
    t.is(ctx.state.clients[0].id, clients[0].id);
    t.is(typeof ctx.state.clients[1], 'undefined');
  });
});

test('retrieveClient > get client information', async (t) => {
  t.plan(2);
  const client = await factory.create('client');

  const ctx = {
    params: { client_id: client.id },
    state: {
      clients: [client],
      breadcrumbs: ['dashboard', 'clients', client.id],
      l: (link) => `/en${link}`
    }
  };

  await retrieveClient(ctx, () => {
    t.is(ctx.state.client.id, client.id);
    t.deepEqual(ctx.state.breadcrumbs, [
      'dashboard',
      'clients',
      {
        name: client.name,
        header: client.name,
        href: `/en/dashboard/clients/${client.id}`
      }
    ]);
  });
});

test('retrieveClient > errors if client does not exist', async (t) => {
  const ctx = {
    params: { client_id: '34' },
    state: { clients: [] },
    translateError: (err) => err,
    throw: (err) => {
      throw new Error(err);
    }
  };

  await t.throwsAsync(
    retrieveClient(ctx, () => {}),
    {
      message: 'Error: CLIENT_DOES_NOT_EXIST'
    }
  );
});

test('retrieveClient > errors if client_id !isSANB and req.body.client !isSANB', async (t) => {
  const ctx = {
    params: { client_id: 34 },
    request: {
      body: { client: 34 }
    },
    translateError: (err) => err,
    throw: (err) => {
      throw new Error(err);
    }
  };

  await t.throwsAsync(
    retrieveClient(ctx, () => {}),
    {
      message: 'Error: CLIENT_DOES_NOT_EXIST'
    }
  );
});

test('GET dashboard > successfully', async (t) => {
  const { web } = t.context;

  const res = await web.get('/en/dashboard');

  t.is(res.status, 200);
  t.true(res.text.includes('Dashboard'));
});

test('GET dashboard/clients > successfully with no clients', async (t) => {
  const { web } = t.context;

  const res = await web.get('/en/dashboard/clients');

  t.is(res.status, 200);
  t.true(res.text.includes('Clients'));
  t.true(res.text.includes('No clients exist yet'));
});

test('GET dashboard/clients > successfully with clients', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user });
  const client = await factory.create('client', { members: member });

  const res = await web.get('/en/dashboard/clients');

  t.is(res.status, 200);
  t.true(res.text.includes('Clients'));
  t.true(res.text.includes(client.first_name));
});

test('PUT dashboard/clients > successfully with name', async (t) => {
  const { web } = t.context;
  const client = await factory.build('client');

  const res = await web.put('/en/dashboard/clients').send({
    first_name: client.first_name,
    last_name: client.last_name
  });

  t.is(res.status, 302);
  t.is(res.header.location, '/en/dashboard/clients');

  const query = await Clients.findOne({
    first_name: client.first_name,
    last_name: client.last_name
  })
    .populate('members')
    .exec();

  t.is(query.first_name, client.first_name);
  t.is(query.last_name, client.last_name);
  t.is(query.gender, undefined);
  t.is(query.dob, undefined);
  t.is(query.members[0].group, 'owner');
});

test('PUT dashboard/clients > successfully with name and gender', async (t) => {
  const { web } = t.context;
  const client = await factory.build('client');

  const res = await web.put('/en/dashboard/clients').send({
    first_name: client.first_name,
    last_name: client.last_name,
    gender: client.gender
  });

  t.is(res.status, 302);
  t.is(res.header.location, '/en/dashboard/clients');

  const query = await Clients.findOne({
    first_name: client.first_name,
    last_name: client.last_name
  });
  t.is(query.first_name, client.first_name);
  t.is(query.last_name, client.last_name);
  t.is(query.gender, client.gender);
  t.is(query.dob, undefined);
});

test('PUT dashbaord/clients > successfully with name and dob', async (t) => {
  const { web } = t.context;
  const client = await factory.build('client');

  const res = await web.put('/en/dashboard/clients').send({
    first_name: client.first_name,
    last_name: client.last_name,
    dob: client.dob
  });

  t.is(res.status, 302);
  t.is(res.header.location, '/en/dashboard/clients');

  const query = await Clients.findOne({
    first_name: client.first_name,
    last_name: client.last_name
  });
  t.is(query.first_name, client.first_name);
  t.is(query.last_name, client.last_name);
  t.is(query.gender, undefined);
  t.deepEqual(query.dob, client.dob);
});

test('PUT dashboard/clients > successfully with name, gender, and dob', async (t) => {
  const { web } = t.context;
  const client = await factory.build('client');

  const res = await web.put('/en/dashboard/clients').send({
    first_name: client.first_name,
    last_name: client.last_name,
    gender: client.gender,
    dob: client.dob
  });

  t.is(res.status, 302);
  t.is(res.header.location, '/en/dashboard/clients');

  const query = await Clients.findOne({
    first_name: client.first_name,
    last_name: client.last_name
  });
  t.is(query.first_name, client.first_name);
  t.is(query.last_name, client.last_name);
  t.is(query.gender, client.gender);
  t.deepEqual(query.dob, client.dob);
});

test('PUT dashboard/clients > fails with no name', async (t) => {
  const { web } = t.context;

  const res = await web.put('/en/dashboard/clients').send({});

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.INVALID_NAME);
});

test('PUT dashboard/clients > fails with invalid dob', async (t) => {
  const { web } = t.context;

  const res = await web.put('/en/dashboard/clients').send({
    first_name: 'Leroy',
    last_name: 'Jenkins',
    dob: 'nonsense'
  });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.INVALID_DOB);
});

test('DELETE dashboard/clients > successfully', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', {
    user,
    group: 'owner'
  });
  const client = await factory.create('client', { members: member });

  let query = await Clients.findOne({ id: client.id });
  t.is(query.id, client.id);

  const res = await web.delete(`/en/dashboard/clients/${client.id}`);

  t.is(res.status, 302);
  t.is(res.header.location, '/en/dashboard/clients');

  query = await Clients.findOne({ id: client.id });
  t.is(query, null);
});

test('DELETE dashboard/clients > fails if user does not have permissions', async (t) => {
  const { web } = t.context;
  const client = await factory.create('client');

  const res = await web.delete(`/en/dashboard/clients/${client.id}`);

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.CLIENT_DOES_NOT_EXIST);
});

test('DELETE dashboard/clients > fails if client does not exist', async (t) => {
  const { web } = t.context;

  const res = await web.delete('/en/dashboard/clients/1');

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.CLIENT_DOES_NOT_EXIST);
});

test('DELETE dashboard/clients > fails if user is "user"', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', {
    user,
    group: 'user'
  });
  const client = await factory.create('client', { members: member });

  let query = await Clients.findOne({ id: client.id });
  t.is(query.id, client.id);

  const res = await web.delete(`/en/dashboard/clients/${client.id}`);

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.NO_PERMISSION);

  query = await Clients.findOne({ id: client.id });
  t.is(query.id, client.id);
});

test('DELETE dashboard/clients > fails if user is "admin"', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', {
    user,
    group: 'admin'
  });
  const client = await factory.create('client', { members: member });

  let query = await Clients.findOne({ id: client.id });
  t.is(query.id, client.id);

  const res = await web.delete(`/en/dashboard/clients/${client.id}`);

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.NO_PERMISSION);

  query = await Clients.findOne({ id: client.id });
  t.is(query.id, client.id);
});

test('POST /dashboard/clients/:client_id > successfully if "owner"', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user, group: 'owner' });
  const client = await factory.create('client', { members: member });
  const newClient = await factory.build('client');

  let query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === client.first_name &&
      query.last_name === client.last_name &&
      query.dob.toISOString() === client.dob.toISOString() &&
      query.gender === client.gender
  );

  const res = await web.post(`/en/dashboard/clients/${client.id}`).send({
    first_name: newClient.first_name,
    last_name: newClient.last_name,
    dob: newClient.dob,
    gender: newClient.gender
  });

  t.is(res.status, 302);
  t.is(res.header.location, `/en/dashboard/clients`);

  query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === newClient.first_name &&
      query.last_name === newClient.last_name &&
      query.dob.toISOString() === newClient.dob.toISOString() &&
      query.gender === newClient.gender
  );
});

test('POST /dashboard/clients/:client_id > successfully if "admin"', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: member });
  const newClient = await factory.build('client');

  let query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === client.first_name &&
      query.last_name === client.last_name &&
      query.dob.toISOString() === client.dob.toISOString() &&
      query.gender === client.gender
  );

  const res = await web.post(`/en/dashboard/clients/${client.id}`).send({
    first_name: newClient.first_name,
    last_name: newClient.last_name,
    dob: newClient.dob,
    gender: newClient.gender
  });

  t.is(res.status, 302);
  t.is(res.header.location, `/en/dashboard/clients`);

  query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === newClient.first_name &&
      query.last_name === newClient.last_name &&
      query.dob.toISOString() === newClient.dob.toISOString() &&
      query.gender === newClient.gender
  );
});

test('POST /dashboard/clients/:client_id > fails if "user"', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user, group: 'user' });
  const client = await factory.create('client', { members: member });
  const newClient = await factory.build('client');

  let query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === client.first_name &&
      query.last_name === client.last_name &&
      query.dob.toISOString() === client.dob.toISOString() &&
      query.gender === client.gender
  );

  const res = await web.post(`/en/dashboard/clients/${client.id}`).send({
    first_name: newClient.first_name,
    last_name: newClient.last_name,
    dob: newClient.dob,
    gender: newClient.gender
  });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.NO_PERMISSION);

  query = await Clients.findOne({ id: client.id });
  t.true(
    query.id === client.id &&
      query.first_name === client.first_name &&
      query.last_name === client.last_name &&
      query.dob.toISOString() === client.dob.toISOString() &&
      query.gender === client.gender
  );
});

test('POST /dashboard/clients/:client_id > fails if dob is invalid', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: member });

  const res = await web.post(`/en/dashboard/clients/${client.id}`).send({
    first_name: client.first_name,
    last_name: client.last_name,
    dob: 'nonsense',
    gender: client.gender
  });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.INVALID_DOB);
});

test('POST /dashboard/clients/:client_id > fails if name is invalid', async (t) => {
  const { web, user } = t.context;
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: member });

  const res = await web.post(`/en/dashboard/clients/${client.id}`).send({
    first_name: undefined,
    last_name: client.last_name,
    dob: client.dob,
    gender: client.gender
  });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.INVALID_NAME);
});

test('GET /dashboard/clients/:client_id/share > successfully', async (t) => {
  const { web, user } = t.context;
  const nonMemberUser = await factory.create('user');
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: [member] });

  const res = await web.get(`/en/dashboard/clients/${client.id}/share`).send();

  t.is(res.status, 200);
  t.true(res.text.includes(user[displayName]));
  t.false(res.text.includes(nonMemberUser[displayName]));
});

test('PUT /dashboard/clients/:client_id/share > successfully', async (t) => {
  const { web, user } = t.context;
  const nonMemberUser = await factory.create('user');
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: [member] });

  let query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 1);
  t.like(query.members[0], { user: { id: user.id }, group: 'admin' });

  const res = await web
    .put(`/en/dashboard/clients/${client.id}/share`)
    .set('Accept', 'application/json')
    .send({
      member: nonMemberUser[displayName]
    });

  t.is(res.status, 200);
  t.true(res.body.message.includes(user[displayName]));
  t.true(res.body.message.includes(nonMemberUser[displayName]));

  query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 2);

  for (const member of query.members) {
    if (member.user.id === user.id && member.group === 'admin') t.pass();
    else if (member.user.id === nonMemberUser.id && member.group === 'user')
      t.pass();
    else t.fail();
  }
});

test('PUT /dashboard/clients/:client_id/share > fails if no user exists', async (t) => {
  const { web, user } = t.context;
  const nonMemberUser = await factory.build('user');
  const member = await factory.create('member', { user, group: 'admin' });
  const client = await factory.create('client', { members: [member] });

  const query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 1);
  t.like(query.members[0], { user: { id: user.id }, group: 'admin' });

  const res = await web
    .put(`/en/dashboard/clients/${client.id}/share`)
    .set('Accept', 'application/json')
    .send({
      member: nonMemberUser[displayName]
    });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.INVALID_USER);
});

test('DELETE /dashboard/clients/:client_id/share > successful', async (t) => {
  const { web, user } = t.context;
  const extraUser = await factory.create('user');
  const members = await factory.createMany('member', [
    { user, group: 'admin' },
    { user: extraUser, group: 'user' }
  ]);
  const client = await factory.create('client', { members });

  let query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 2);

  const res = await web
    .delete(`/en/dashboard/clients/${client.id}/share`)
    .send({
      member: extraUser[displayName]
    });

  t.is(res.status, 200);

  query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 1);
  t.like(query.members[0], { user: { id: user.id }, group: 'admin' });
});

test('DELETE /dashboard/clients/:client_id/share > fails if no member', async (t) => {
  const { web, user } = t.context;
  const extraUser = await factory.create('user');
  const members = await factory.createMany('member', [
    { user, group: 'admin' }
  ]);
  const client = await factory.create('client', { members });

  const query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(query.members.length, 1);

  const res = await web
    .delete(`/en/dashboard/clients/${client.id}/share`)
    .send({
      member: extraUser[displayName]
    });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.MEMBER_DOES_NOT_EXIST);
});

test('POST /dashboard/clients/:client_id/share > successfully', async (t) => {
  const { web, user } = t.context;
  const extraUser = await factory.create('user');
  const members = await factory.createMany('member', [
    { user, group: 'admin' },
    { user: extraUser, group: 'user' }
  ]);
  const client = await factory.create('client', { members });

  let query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(
    query.members.find(
      (member) => member.user[displayName] === extraUser[displayName]
    ).group,
    'user'
  );

  const res = await web
    .post(`/en/dashboard/clients/${client.id}/share`)
    .send({ member: extraUser[displayName], group: 'admin' });

  t.is(res.status, 200);

  query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(
    query.members.find((member) => member.user.id === extraUser.id).group,
    'admin'
  );
});

test('POST /dashboard/clients/:client_id/share > fails when changing self to owner but not there is no other owner', async (t) => {
  const { web, user } = t.context;
  const extraUser = await factory.create('user');
  const members = await factory.createMany('member', [
    { user, group: 'owner' },
    { user: extraUser, group: 'user' }
  ]);
  const client = await factory.create('client', { members });

  const res = await web
    .post(`/en/dashboard/clients/${client.id}/share`)
    .send({ member: user[displayName], group: 'admin' });

  t.is(res.status, 400);
  t.is(JSON.parse(res.text).message, phrases.MUST_HAVE_OWNER);
});

test('POST /dashboard/clients/:client_id/share > successful when another owner exists', async (t) => {
  const { web, user } = t.context;
  const extraUser = await factory.create('user');
  const members = await factory.createMany('member', [
    { user, group: 'owner' },
    { user: extraUser, group: 'owner' }
  ]);
  const client = await factory.create('client', { members });

  const res = await web
    .post(`/en/dashboard/clients/${client.id}/share`)
    .send({ member: user[displayName], group: 'admin' });

  t.is(res.status, 200);

  const query = await Clients.findById(client._id)
    .populate('members.user')
    .lean()
    .exec();

  t.is(
    query.members.find((member) => member.user.id === user.id).group,
    'admin'
  );
});
