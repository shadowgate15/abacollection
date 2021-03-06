const ms = require('ms');
const Boom = require('@hapi/boom');
const isSANB = require('is-string-and-not-blank');
const { isISO8601 } = require('validator');
const dayjs = require('dayjs');

dayjs.extend(require('dayjs/plugin/utc'));
dayjs.extend(require('dayjs/plugin/timezone'));

const { Datas } = require('../../../models');

async function retrieveDatas(ctx, next) {
  ctx.state.data = await ctx.state.target.getData(ctx.query);

  if (!Array.isArray(ctx.state.data)) {
    ctx.state.rawData = ctx.state.data.rawData;
    ctx.state.data = ctx.state.data.data;
  }

  return next();
}

async function retrieveGraph(ctx, next) {
  ctx.state.data = await ctx.state.target.getGraph(ctx.query);

  return next();
}

async function addData(ctx, next) {
  try {
    const { body } = ctx.request;

    if (
      (!body.date || (body.date && !isISO8601(body.date))) &&
      body.add_data === 'true'
    )
      return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATE')));

    if (ctx.state.target.data_type === 'Rate') {
      if (!isSANB(body.correct))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_CORRECT'))
        );
      if (!isSANB(body.incorrect))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_INCORRECT'))
        );
      if (!isSANB(body.counting_time))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_COUNTING_TIME'))
        );
    } else if (ctx.state.target.data_type === 'Task Analysis') {
      if (!Array.isArray(body.data))
        return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATA')));
    } else if (!isSANB(body.data))
      return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATA')));

    const value = getValue(ctx.state.target.data_type, body);

    await Datas.create({
      date: dayjs.tz(body.date, body.timezone).utc(),
      value,
      data_type: ctx.state.target.data_type,
      creation_date: new Date(),
      target: ctx.state.target._id,
      created_by: ctx.state.client._id
    });

    await retrieveDatas(ctx, next);

    await ctx.render('dashboard/clients/_data-table');

    ctx.body = {
      message: ctx.body,
      renderModalBodyWithHTML: true
    };
  } catch (err) {
    ctx.logger.error(err);
  }
}

async function editData(ctx, next) {
  try {
    const { body } = ctx.request;

    if (
      (!body.date || (body.date && !isISO8601(body.date))) &&
      body.edit_data === 'true'
    )
      return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATE')));

    if (ctx.state.target.data_type === 'Rate') {
      if (!isSANB(body.correct))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_CORRECT'))
        );
      if (!isSANB(body.incorrect))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_INCORRECT'))
        );
      if (!isSANB(body.counting_time))
        return ctx.throw(
          Boom.badRequest(ctx.translateError('INVALID_COUNTING_TIME'))
        );
    } else if (ctx.state.target.data_type === 'Task Analysis') {
      if (!Array.isArray(body.data))
        return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATA')));
    } else if (!isSANB(body.data))
      return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DATA')));

    const value = getValue(ctx.state.target.data_type, body);

    if (body.id) {
      const data = await Datas.findById(body.id);
      data.value = value;
      await data.save();
    } else
      await Datas.create({
        date: dayjs.tz(body.date, body.timezone).utc(),
        value:
          Number.parseInt(body.data, 10) - Number.parseInt(body.origData, 10),
        data_type: ctx.state.target.data_type,
        creation_date: new Date(),
        target: ctx.state.target._id,
        created_by: ctx.state.client._id
      });

    await retrieveDatas(ctx, next);

    await ctx.render('dashboard/clients/_data-table');

    ctx.body = {
      message: ctx.body,
      renderModalBodyWithHTML: true
    };
  } catch (err) {
    ctx.logger.error(err);
  }
}

async function deleteData(ctx, next) {
  await Datas.findByIdAndRemove(ctx.request.body.id);

  await retrieveDatas(ctx, next);

  await ctx.render('dashboard/clients/_data-table');

  ctx.body = {
    message: ctx.body,
    renderModalBodyWithHTML: true
  };
}

function getValue(data_type, body) {
  if (data_type === 'Duration') {
    const vals = body.data.split(':');

    switch (vals.length) {
      case 3:
        return vals[0] * ms('1h') + vals[1] * ms('1m') + vals[2] * ms('1s');
      case 2:
        return vals[0] * ms('1m') + vals[1] * ms('1s');
      case 1:
        return vals[0] * ms('1s');
      default:
        return;
    }
  } else if (data_type === 'Rate') {
    let counting_time;
    const vals = body.counting_time.split(':');

    switch (vals.length) {
      case 3:
        counting_time =
          vals[0] * ms('1h') + vals[1] * ms('1m') + vals[2] * ms('1s');
        break;
      case 2:
        counting_time = vals[0] * ms('1m') + vals[1] * ms('1s');
        break;
      case 1:
        counting_time = vals[0] * ms('1s');
        break;
      default:
        break;
    }

    return {
      correct: body.correct,
      incorrect: body.incorrect,
      counting_time
    };
  }

  return body.data;
}

module.exports = {
  retrieveDatas,
  retrieveGraph,
  addData,
  editData,
  deleteData
};
