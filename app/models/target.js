const mongoose = require('mongoose');
const mongooseCommonPlugin = require('mongoose-common-plugin');
const dayjs = require('dayjs');

const Datas = require('./data');

// <https://github.com/Automattic/mongoose/issues/5534>
mongoose.Error.messages = require('@ladjs/mongoose-error-messages');

const targetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  data_type: {
    type: String,
    enum: [
      'Frequency',
      'Rate',
      'Duration',
      'Percent Correct',
      'Task Analysis',
      'Momentary Time Sampling',
      'Whole Interval',
      'Partial Interval'
    ],
    required: true
  },
  description: {
    type: String
  },
  start_date: {
    type: Date
  },
  mastered_date: {
    type: Date
  },
  created_by: { type: mongoose.Schema.ObjectId, ref: 'User' },
  program: { type: mongoose.Schema.ObjectId, ref: 'Program' },
  data: [{ type: mongoose.Schema.ObjectId, ref: 'Data' }]
  // TODO create mastery criterion setup
  // TODO add phase categories
});

targetSchema.plugin(mongooseCommonPlugin, { object: 'target' });

targetSchema.post('findOneAndRemove', async function() {
  const datas = await Datas.find({ target: this.getQuery()._id })
    .lean()
    .exec();

  datas.forEach(async data => {
    await Datas.findByIdAndRemove(data._id);
  });
});

targetSchema.method('getPreviousData', async function() {
  let ret = 'WIP';

  if (this.data_type === 'Frequency') {
    ret = await Datas.aggregate()
      .match({
        $and: [
          {
            target: this._id
          },
          {
            created_at: {
              $lt: dayjs()
                .startOf('day')
                .toDate(),
              $gte: dayjs()
                .startOf('day')
                .subtract(1, 'day')
                .toDate()
            }
          }
        ]
      })
      .group({
        _id: null,
        previous: { $sum: '$value' }
      })
      .project('-_id previous')
      .exec();

    ret = ret[0].previous;
  } else if (this.data_type === 'Duration') {
    ret = await Datas.aggregate()
      .match({ target: this._id })
      .sort({ created_at: -1 })
      .limit(1)
      .project({ _id: 0, previous: '$value' })
      .exec();

    ret = ret[0].previous;
  } else if (this.data_type === 'Percent Correct') {
    ret = await Datas.find({
      $and: [
        {
          target: this._id
        },
        {
          created_at: {
            $lt: dayjs()
              .startOf('day')
              .toDate(),
            $gte: dayjs()
              .startOf('day')
              .subtract(1, 'day')
              .toDate()
          }
        }
      ]
    }).exec();

    const total = ret.length;
    const correct = ret.filter(data => data.value === 'correct').length;

    ret = `${(correct / total) * 100}%`;
  }

  return ret;
});

targetSchema.method('getCurrentData', function() {
  // TODO correct aggregation of data per data_type
  return 'WIP';
});

const Target = mongoose.model('Target', targetSchema);

module.exports = Target;
