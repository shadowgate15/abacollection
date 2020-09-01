const $ = require('jquery');
const superagent = require('superagent');
const Apex = require('apexcharts');

const logger = require('./logger.js');

let graph;

$(document).on('click', '#addBtn', function () {
  $('#addForm').prop('hidden', false);
});

$(document).on('click', '#cancelAddBtn', function () {
  $('#addForm').prop('hidden', true);
});

$(document).on('click', '.edit-btn', function () {
  const $parent = $(this).parents('tr:first');
  const id = $parent.prop('id');

  $parent.prop('hidden', true);
  $(`.edit-form#${id}-form`).prop('hidden', false);
});

$(document).on('click', '.edit-cancel-btn', function () {
  const $parent = $(this).parents('tr:first');
  const id = $parent.prop('id').replace('-form', '');

  $parent.prop('hidden', true);
  $(`tr#${id}`).prop('hidden', false);
});

$(document).on('click', '#dataAddBtn', function () {
  $('#dataAddForm').prop('hidden', false);
});

$(document).on('click', '#dataCancelAddBtn', function () {
  $('#dataAddForm').prop('hidden', true);
});

$(document).on('click', '.data-edit-btn', function () {
  const $parent = $(this).parents('tr:first');
  const id = $parent.prop('id');

  $parent.prop('hidden', true);
  $(`.data-edit-form#${id}-form`).prop('hidden', false);
});

$(document).on('click', '.data-edit-cancel-btn', function () {
  const $parent = $(this).parents('tr:first');
  const id = $parent.prop('id').replace('-form', '');

  $parent.prop('hidden', true);
  $(`tr#${id}`).prop('hidden', false);
});

$(document).on('click', '#graphTargetBtn', async function (event) {
  try {
    event.preventDefault();

    const $modal = $('#modal-graph-target');

    // show spinner
    $('#spinner').addClass('show d-block');

    const id = $(this).data('id');
    const name = $(this).data('name');

    $('#graph-title').text(name);

    $modal.modal('show');

    const res = await superagent
      .get(`${window.location.pathname}/${id}/graph`)
      .set('Accept', 'application/json')
      .retry(3)
      .send();

    const { body } = res;

    const options = {
      chart: {
        type: 'line',
        title: body.title
      },
      series: body.series,
      xaxis: {
        type: 'datetime',
        title: {
          text: body.xaxisTitle,
          offsetY: 10
        }
      },
      yaxis: {
        title: {
          text: body.yaxisTitle
        }
      },
      stroke: {
        width: 1
      }
    };

    if (body.yaxisMax) options.yaxis.max = body.yaxisMax;

    graph = new Apex(document.querySelector('#graph'), options);
    // hide spinner
    $('#spinner').removeClass('show d-block');
    graph.render();
  } catch (err) {
    logger.error(err);
  }
});

$(document).on('click', '#dataTargetBtn', async function (event) {
  try {
    event.preventDefault();

    const $modal = $('#modal-data-target');
    $('#spinner').addClass('show d-block');

    const id = $(this).data('id');
    const name = $(this).data('name');

    $('#data-title').text(name);

    $modal.find('.modal-header .btn-group').data('id', id);

    $modal.modal('show');

    const res = await superagent
      .get(`${window.location.pathname}/${id}?rawData=true`)
      .retry(3)
      .send();

    // hide spinner
    $('#spinner').removeClass('show d-block');
    $('#data').html(res.text);
  } catch (err) {
    logger.error(err);
  }
});

$('.interval').click(async function () {
  try {
    const $parent = $(this).parent('.btn-group');
    $('#spinner').addClass('show d-block');

    const id = $parent.data('id');

    $('#data').empty();

    const res = await superagent
      .get(
        `${window.location.pathname}/${id}?interval=${$(this).data(
          'interval'
        )}&rawData=true`
      )
      .retry(3)
      .send();

    $('#spinner').removeClass('show d-block');
    $('#data').html(res.text);

    $parent.find('.interval').removeClass('active');
    $(this).addClass('active');
  } catch (err) {
    logger.error(err);
  }
});

$('#modal-graph-target').on('hidden.bs.modal', function () {
  if (graph) {
    graph.destroy();
    graph = false;

    $('#graph').empty();
  }
});

$('#modal-edit-target').on('hidden.bs.modal', function () {
  $(this).find('form').trigger('reset');
});

$('#modal-data-target').on('hidden.bs.modal', function () {
  $('#data').empty();

  $(this).find('.interval').removeClass('active');
  $('#modal-data-target .interval').first().addClass('active');
});
