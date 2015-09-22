var scheduler = require('./schedule');

scheduler.getTimeTable(function (timetable) {
    console.log(JSON.stringify(timetable, null, '    '));
});