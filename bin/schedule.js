var request = require('request');
var cheerio = require('cheerio');
var CronJob = require('cron').CronJob;
var recorder = require('./recorder');

var timetableUrl = 'http://www.agqr.jp/timetable/streaming.php';
var timezone = 'Asia/Tokyo';
var updateTimetableJob;
var recordProgramJob;
var timetable;

// 番組表取得
var getTimeTable = function (callback) {
    request(timetableUrl, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            // 元データのtrタグがおかしいので修正
            // 10時:tr開始タグが1つ余計
            body = body.replace(
                /<\/tr>[\s]*<tr>[\s]*<tr>/g,
                '</tr>\n<tr>'
                );
            // 20時と21時:tr開始タグが足りない
            body = body.replace(
                /<\/tr>[\s]*<th class="time3" rowspan="2">2/g,
                '</tr>\n<tr>\n<th class="time3" rowspan="2">2'
                );

            // 番組表
            // 0:月曜 6:日曜
            var programs = [];
            for (var i = 0; i < 7; i++) {
                programs[programs.length] = {};
            }
            // 前枠継続フラグ
            var rowskip = [0, 0, 0, 0, 0, 0, 0];    

            // 30分ごとの枠
            var $ = cheerio.load(body);
            $('.schedule-ag > table > tbody > tr').each(function () {
                // 各曜日
                var day = 0;
                $(this).children('td').each(function () {
                    // 前枠が継続する列をスキップ
                    while (rowskip[day] > 0) {
                        day++;
                    }
                    // rowspanが未定義(=30分番組)なら1
                    var rowspan = $(this).attr('rowspan');
                    rowskip[day] = rowspan = rowspan ? rowspan : 1;

                    // 初回放送と生放送のみ登録
                    if ($(this).attr('class')) {
                        // 番組情報取得
                        var time = $(this).children('.time').text();
                        time = time.replace(/\n/g, '').replace(/[\s]*/g, '');
                        var title = $(this).children('.title-p').text();
                        title = title.replace(/\n/g, '').replace(/[\s]*/g, '');
                        var rp = $(this).children('.rp').text();
                        rp = rp.replace(/\n/g, '').replace(/[\s]*/g, '');

                        if (time && title && rp) {
                            programs[day][time] = { title: title, rp: rp, length: rowspan * 30 };
                        }
                    }

                    day++;
                });
            
                // 次枠へ
                for (var i = 0; i < rowskip.length; i++) {
                    rowskip[i]--;
                }
            });

            // コールバックに番組表を渡す
            callback(programs);
        } else {
            console.error('Failed to get timetable: ' + res.statusCode);
        }
    });
}

// 番組情報取得
var getNextProgram = function () {
    // 次枠の開始時間を計算
    // (30秒後の曜日,時,分を使う)
    var now = new Date();
    var next = new Date(now.getTime() + 30 * 1000);
    var nextDay = (now.getDay() == 0) ? 6 : now.getDay() - 1;
    var nextHour = next.getHours();
    var nextMinute = ('00' + next.getMinutes()).slice(-2);

    // 番組検索
    var programInfo = timetable[nextDay][nextHour + ':' + nextMinute];
    if (programInfo) {
        programInfo['startat'] = next.setSeconds(0, 0);
        return programInfo;
    } else {
        return null;
    }
}

// スケジューラ起動
exports.start = function (onComplete) {
    getTimeTable(function (nowTimetable) {
        // 番組表が取得できたらジョブ登録
        timetable = nowTimetable;
            
        // 番組表更新は月曜日5:00
        // [3] 完了時処理なし 
        // [4] 即時開始オン
        // [5] タイムゾーン指定
        updateTimetableJob = new CronJob('0 0 5 * * 1', function () {
            getTimeTable(function (newTimetable) {
                timetable = newTimetable;
            });
        }, null, true, timezone);
            
        // 番組表にあるものを録画
        // チェックは毎時29分と59分
        recordProgramJob = new CronJob('50 29,59 * * * *', function () {
            var programInfo = getNextProgram();
            if (programInfo) {
                recorder.record(programInfo, onComplete);
            }
        }, null, true, timezone);
    });
}

// スケジューラ停止
exports.stop = function () {
    if (!updateTimetableJob) {
        updateTimetableJob.stop();
    }
    if (!recordProgramJob) {
        recordProgramJob.stop();
    }
}
