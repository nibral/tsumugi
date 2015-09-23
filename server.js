var scheduler = require('./bin/schedule');

scheduler.start(function (info) {
    console.log(info);
});
