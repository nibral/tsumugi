var CronJob = require('cron').CronJob;
var time = require('time');
var timezone = 'Asia/Tokyo';

var config = require('config');
var scheduleFileName = config.scheduleFilename;
var schedules = require(__dirname + '/' + scheduleFileName);
var schedulerJob;
var recorder;

var checkSchedule = function() {
    // date and time
    var nowTime = new time.Date().setTimezone(timezone);
    var nowYear = nowTime.getFullYear();
    var nowMonth = nowTime.getMonth();

    for(var i = 0; i < schedules.length; i++) {
        var nowDay = nowTime.getDate();
        var nowWday = nowTime.getDay();
        
        var schedule = schedules[i].time.split(':');
        var hour = parseInt(schedule[0]);
        var minute = parseInt(schedule[1]);
        var wday = schedules[i].wday;
       
        if(hour === 0 && minute === 0) {
            nowDay++;
            nowWday = (nowWday == 6) ? 0 : nowWday + 1;
        }

        var scheduledTime = new time.Date(nowYear, nowMonth, nowDay, hour, minute, 0, 0, timezone);
        var diff = Math.abs(scheduledTime - nowTime) / 1000;
        var hit_time = diff < 30;
        var hit_wday = (wday == nowWday);
       
        // call recorder function
        if(schedules[i].record && hit_time && hit_wday) {
            var filename = '[' + nowYear + (nowMonth + 1) + nowDay + '][' + schedules[i].mc + ']' + schedules[i].title;
            filename = filename.split(' ').join('_');
            recorder(filename, schedules[i].length);
        }
    }
}

// start scheduler
exports.start = function(pattern, onRecord) {
    // [3] no action at complate
    // [4] auto start off
    // [5] set timezone
    schedulerJob = new CronJob(pattern, checkSchedule, null, false, timezone);
    schedulerJob.start();
    recorder = onRecord;
}

// stop scheduler
exports.stop = function() {
    schedulerJob.stop();
}
