 /*
  * schedule
  * https://github.com/rwldrn/schedule
  *
  * Copyright (c) 2012 Rick Waldron
  * Licensed under the MIT license.
  */
var events = require("events"),
    util = require("util"),
    es6 = require("es6-collections"),
    WeakMap = es6.WeakMap,
    exportable, queue, drift, priv;

exportable = {};

// Object containing callback queues, keys are time in MS
queue = {};

// Initial value of time drift
drift = 0;

priv = new WeakMap();

/**
 * Schedule create a schedule item
 * @param {Number} ms    Time in ms
 * @param {Object} entry Options for entry {time, task}
 */
function Schedule( entry ) {
  if ( !(this instanceof Schedule) )  {
    return new Schedule( entry );
  }

  this.called = 0;
  this.now = this.calledAt = Date.now();

  priv.set( this, entry );

  // this.time = entry.time;
  // this.type = entry.type;
  // this.task = entry.task;

  entry.isRunnable = true;
  entry.later = this.now + entry.time;


  if ( !queue[ entry.later ] ) {
    queue[ entry.later ] = [];
  }

  queue[ entry.later ].push( this );
}

// Inherit EventEmitter API
util.inherits( Schedule, events.EventEmitter );

/**
 * Schedule.deriveOp (reduction)
 * (static)
 */
Schedule.deriveOp = function( p, v ) {
  return v !== "task" ? v : p;
};


/**
 * stop Stop the current behaviour
 */
Schedule.prototype.stop = function() {
  priv.get(this).isRunnable = false;
  this.emit("stop");
};




process.nextTick(function tick() {
  process.nextTick( tick );

  var now, entry, entries, scheduled;

  // Store entry stack key
  now = Date.now();

  // Derive entries stack from queue
  entries = queue[ now ] || [];

  if ( entries.length ) {
    // console.log( entries );
    while ( entries.length ) {
      // Shift the entry out of the current list
      scheduled = entries.shift();
      entry = priv.get( scheduled );


      // Execute the entry's callback, with
      // "entry" as first arg
      if ( entry.isRunnable ) {
        scheduled.called++;
        scheduled.calledAt = now;
        entry.task.call( scheduled, scheduled );
      }

      // Additional "loop" handling
      if ( entry.type === "loop" && entry.isRunnable ) {

        // Calculate the next execution time
        entry.later = now + entry.time;

        // Create a queue entry if none exists
        if ( !queue[ entry.later ] ) {
          queue[ entry.later ] = [];
        }

        if ( entry.isRunnable ) {
          // Push the entry into the cue
          queue[ entry.later ].push( scheduled );
        }
      }
    }

    // Delete the empty queue array
    delete queue[ now ];
  }
});

[ "loop", "wait" ].forEach(function( type ) {

  exportable[ type ] = function( time, task ) {

    if ( typeof time === "function" ) {
      task = time;
      time = 10;
    }

    return new Schedule({
      time: time,
      type: type,
      task: task
    });
  };
});

function Queue( tasks ) {
  var op, cumulative, item, task, self;

  cumulative = 0;

  self = this;

  while ( tasks.length ) {
    item = tasks.shift();
    op = Object.keys(item).reduce( Schedule.deriveOp, "" );

    cumulative += item[ op ];

    // For the last task, ensure that an "ended" event is
    // emitted after the final callback is called.
    if ( tasks.length === 0 ) {
      task = item.task;
      item.task = function( scheduled ) {
        task.call( this, scheduled );
        self.emit( "ended", scheduled );
      };
    }

    if ( op === "loop" && tasks.length === 0 ) {
      // When transitioning from a "wait" to a "loop", allow
      // the loop to iterate the amount of time given,
      // but still start at the correct offset.
      exportable.wait( cumulative - item[ op ], function() {
        exportable.loop( item[ op ], item.task );
      });
    } else {
      exportable[ op ]( cumulative, item.task );
    }
  }
};

util.inherits( Queue, events.EventEmitter );

exportable.queue = function( tasks ) {
  return new Queue( tasks );
};

module.exports = exportable;
