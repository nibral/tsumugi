var scheduler = require('./bin/schedule');
var recorder = require('./bin/recorder');

scheduler.start(recorder.record);
