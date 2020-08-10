const $ = require('jquery');
const ms = require('ms');

const timers = {};
const percentCorrect = {};

//
// handle clicker
//
// plus button
$('.clicker-plus').click(function() {
  const $label = $(this).next();
  const val = parseInt($label.text(), 10);
  $label.text(val + 1);

  if (val === 0) $label.next().prop('disabled', false);
});

// minus button
$('.clicker-minus').click(function() {
  const $label = $(this).prev();
  const val = parseInt($label.text(), 10);

  if (val <= 1) {
    $label.text(0);
    $(this).prop('disabled', true);
  } else $label.text(val - 1);
});

//
// handle timer
//
// play button
$('.timer-play').click(function() {
  // get timer selectors
  const $timer = $(this).parents('.timer');
  const $hour = $timer.find('.timer-hour');
  const $minute = $timer.find('.timer-minute');
  const $second = $timer.find('.timer-second');
  const id = $(this)
    .parents('.card')
    .prop('id');

  // disable play button and enable stop button
  $(this).prop('disabled', true);
  $timer.find('.timer-stop').prop('disabled', false);
  $timer.find('.timer-reset').prop('disabled', true);

  let offset = 0;
  if (timers[id]) {
    const hour = parseInt($hour.text(), 10);
    const minute = parseInt($minute.text(), 10);
    const second = parseInt($second.text(), 10);

    offset = ms(`${hour}h`) + ms(`${minute}m`) + ms(`${second}s`);
  }

  const startTime = Date.now() - offset;
  // setup timer
  timers[id] = setInterval(function() {
    const duration = Date.now() - startTime;
    const seconds = (duration / ms('1s')).toFixed(0);
    const minutes = (duration / ms('1m')).toFixed(0);
    const hours = (duration / ms('1h')).toFixed(0);

    $hour.text(hours);
    $minute.text(minutes);
    $second.text(seconds);
  }, ms('1s'));
});

// stop button
$('.timer-stop').click(function() {
  // get timer selectors
  const $timer = $(this).parents('.timer');
  const id = $(this)
    .parents('.card')
    .prop('id');

  // disable stop button and enable play button
  $(this).prop('disabled', true);
  $timer.find('.timer-play').prop('disabled', false);
  $timer.find('.timer-reset').prop('disabled', false);

  clearInterval(timers[id]);
});

// reset button
$('.timer-reset').click(function() {
  // get timer selectors
  const $timer = $(this).parents('.timer');
  const $hour = $timer.find('.timer-hour');
  const $minute = $timer.find('.timer-minute');
  const $second = $timer.find('.timer-second');
  const id = $(this)
    .parents('.card')
    .prop('id');

  $hour.text(0);
  $minute.text(0);
  $second.text(0);

  timers[id] = undefined;

  $(this).prop('disabled', true);
});

//
// handle percent correct
//
// button clicked
$('button.percent-correct').click(function() {
  // get percent correct selectors
  const $parent = $(this).parents('.percent-correct');
  const $previous = $parent.find('.percent-correct-previous');
  const $next = $parent.find('.percent-correct-next');
  const $label = $parent.find('.percent-correct-label');
  let trial = $label.data('trial');
  const id = $(this)
    .parents('.card')
    .prop('id');

  // set data value
  if (!Array.isArray(percentCorrect[id])) percentCorrect[id] = [];

  if ($(this).hasClass('percent-correct-correct'))
    percentCorrect[id][trial - 1] = 'correct';
  else if ($(this).hasClass('percent-correct-approximation'))
    percentCorrect[id][trial - 1] = 'approximation';
  else if ($(this).hasClass('percent-correct-incorrect'))
    percentCorrect[id][trial - 1] = 'incorrect';

  // bump trial and total
  trial++;
  const total = percentCorrect[id].length;
  // write label
  $label.text(`${trial} / ${total + 1}`);
  // change data stored
  $label.data('trial', trial);
  $label.data('total', total + 1);

  // if trial is above 1 enable previous button
  if (trial > 1) $previous.prop('disabled', false);
  // if trial is equal to total disable next button
  if (trial === total + 1) $next.prop('disabled', true);

  // remove selection class
  $parent
    .find(
      '.percent-correct-correct,.percent-correct-approximation,.percent-correct-incorrect'
    )
    .removeClass('btn-primary');

  // add selection class
  $parent
    .find(`.percent-correct-${percentCorrect[id][trial - 1]}`)
    .addClass('btn-primary');
});

// previous button clicked
$('.percent-correct-previous').click(function() {
  // get selectors
  const $parent = $(this).parents('.percent-correct');
  const $label = $parent.find('.percent-correct-label');
  let trial = $label.data('trial');
  const total = $label.data('total');
  const id = $(this)
    .parents('.card')
    .prop('id');

  trial--;
  $label.text(`${trial} / ${total}`);
  $label.data('trial', trial);

  // remove selection class
  $parent
    .find(
      '.percent-correct-correct,.percent-correct-approximation,.percent-correct-incorrect'
    )
    .removeClass('btn-primary');

  // add selection class
  $parent
    .find(`.percent-correct-${percentCorrect[id][trial - 1]}`)
    .addClass('btn-primary');

  // if trial is 1 disable button
  if (trial === 1) $(this).prop('disabled', true);
  // if trial does not equal total enable next button
  if (trial !== total)
    $parent.find('.percent-correct-next').prop('disabled', false);
});

// next button clicked
$('.percent-correct-next').click(function() {
  // get selectors
  const $parent = $(this).parents('.percent-correct');
  const $label = $parent.find('.percent-correct-label');
  let trial = $label.data('trial');
  const total = $label.data('total');
  const id = $(this)
    .parents('.card')
    .prop('id');

  trial++;
  $label.text(`${trial} / ${total}`);
  $label.data('trial', trial);

  // remove selection class
  $parent
    .find(
      '.percent-correct-correct,.percent-correct-approximation,.percent-correct-incorrect'
    )
    .removeClass('btn-primary');

  // add selection class
  $parent
    .find(`.percent-correct-${percentCorrect[id][trial - 1]}`)
    .addClass('btn-primary');

  // if trial is equal to total disable button
  if (trial === total) $(this).prop('disabled', true);
  // if trial does not equal 1 enable previous button
  if (trial !== 1)
    $parent.find('.percent-correct-previous').prop('disabled', false);
});