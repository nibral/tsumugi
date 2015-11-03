var request = require('request');
var cheerio = require('cheerio');
var CronJob = require('cron').CronJob;
var parseString = require('xml2js').parseString;
var recorder = require('./recorder');

var timetableUrl = 'http://www.agqr.jp/timetable/streaming.php';
var streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';

var timezone = 'Asia/Tokyo';
var updateTimetableJob;
var recordProgramJob;
var timetable;

// 番組表の形式
//  [day]{ time: { title, rp } }
// プロパティ
//  day: 曜日,0(日曜)...6(土曜)
//  time: 時間('hh:mm')
//  title: 番組名
//  rp: 出演者

// 番組情報の形式
//  { title, rp, length, startAt, video, audio, thumbnail }
// プロパティ
//  title: 番組名
//  rp: 出演者
//  length: 長さ(min)
//  startAt: 開始時間(unixtime(ms))
//  video,audio,thumbnail: エンコード後のファイル名

// 番組表取得
var updateTimeTable = function (callback) {
    request(timetableUrl, function (timetableError, timetableResponse, timetableBody) {
        if (!timetableError && timetableResponse.statusCode == 200) {
            // 元データのtrタグがおかしいので修正
            // 10時:tr開始タグが1つ余計
            timetableBody = timetableBody.replace(
                /<\/tr>[\s]*<tr>[\s]*<tr>/g,
                '</tr>\n<tr>'
                );
            // 20時と21時:tr開始タグが足りない
            timetableBody = timetableBody.replace(
                /<\/tr>[\s]*<th class="time3" rowspan="2">2/g,
                '</tr>\n<tr>\n<th class="time3" rowspan="2">2'
                );

            // 番組表
            var timetable = [];
            for (var i = 0; i < 7; i++) {
                timetable[timetable.length] = {};
            }
            // 前枠継続フラグ
            var rowskip = [0, 0, 0, 0, 0, 0, 0];    

            // 30分ごとの枠
            var $ = cheerio.load(timetableBody);
            $('.schedule-ag > table > tbody > tr').each(function () {
                // 各曜日
                var day = 1;
                $(this).children('td').each(function () {
                    // 前枠が継続する列をスキップ
                    while (rowskip[day] > 0) {
                        day++;
                    }
                    // 番組の枠数(30分単位)
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
                        
                        // 0:00～5:00は次の曜日
                        var hour = (time.split(':'))[0];
                        var startDay = ((hour <= 5) ? day + 1 : day) % 7;

                        if (time && title && rp) {
                            timetable[startDay][time] = { title: title, rp: rp, length: rowspan * 30 };
                        }
                    }

                    day = (day == 6) ? 0 : day + 1;
                });
            
                // 次枠へ
                for (var i = 0; i < rowskip.length; i++) {
                    rowskip[i]--;
                }
            });

            // コールバックに番組表を渡す
            callback(timetable);
        } else {
            console.error('Failed to get timetable: ' + timetableResponse.statusCode);
        }
    });
}

// 番組情報取得
var getNextProgram = function (callback) {
    // 次枠の開始時間を計算
    // (30秒後の曜日,時,分を使う)
    var now = new Date();
    var next = new Date(now.getTime() + 30 * 1000);
    var nextDay = next.getDay();
    var nextHour = next.getHours();
    var nextMinute = ('00' + next.getMinutes()).slice(-2);

    // 次枠で始まる番組があればコールバック呼び出し
    var programInfo = timetable[nextDay][nextHour + ':' + nextMinute];
    if (programInfo) {
        programInfo['startAt'] = next.setSeconds(0, 0);
        callback(programInfo);
    }
    // ないときは黙って終了
}

// 配信URL取得
var getStreamUrl = function (callback) {
    // 配信URL取得
    request(streamListUrl, function (urlError, urlResponse, urlBody) {
        if (!urlError && urlResponse.statusCode == 200) {
            // XML解析
            parseString(urlBody, function (parseError, parseResult) {
                if (parseError) {
                    console.error(parseError);
                }

                // 先頭のURLを返す
                var serverinfo = parseResult.ag.serverlist[0].serverinfo[0];
                var server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                var app = serverinfo.app[0];
                var stream = serverinfo.stream[0];
                var streamUrl = server + '/' + app + '/' + stream;
                callback(streamUrl);
            });
        } else {
            console.error('Failed to get stream url: ' + urlResponse.statusCode);
        }
    });
}

// 番組表参照
exports.getTimetable = function () {
    return timetable;
}

// 番組表強制更新
exports.refreshTimetable = function (callback) {
    updateTimeTable(function (newTimetable) {
        timetable = newTimetable;
        callback(newTimetable);
    });
}

// スケジューラ起動
exports.start = function (callback) {
    updateTimeTable(function (nowTimetable) {
        // 番組表が取得できたらジョブ登録
        timetable = nowTimetable;
            
        // 番組表更新は月曜日5:00
        // [3] 完了時処理なし 
        // [4] 即時開始オン
        // [5] タイムゾーン指定
        updateTimetableJob = new CronJob('0 0 5 * * 1', function () {
            updateTimeTable(function (newTimetable) {
                timetable = newTimetable;
            });
        }, null, true, timezone);
            
        // 番組表にあるものを録画
        // チェックは毎時29分と59分
        recordProgramJob = new CronJob('45 29,59 * * * *', function () {
            getNextProgram(function (programInfo) {
                getStreamUrl(function (streamUrl) {
                    recorder.record(
                        streamUrl,
                        programInfo.length * 60 + 15,
                        new Date(programInfo.startAt),
                        function (filePaths) {
                            programInfo['video'] = filePaths.video;
                            programInfo['audio'] = filePaths.audio;
                            programInfo['thumbnail'] = filePaths.thumbnail;
                            callback(programInfo);
                        });
                });
            });
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
