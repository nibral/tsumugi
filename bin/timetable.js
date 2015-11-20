'use strict';

var request = require('request');
var cheerio = require('cheerio');
var parseString = require('xml2js').parseString;
var programs;

const timetableUrl = 'http://www.agqr.jp/timetable/streaming.php';
const streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';
const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// 番組表更新(非同期)
exports.update = function (callback) {
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
            programs = [];
            for (let i = 0; i < 7; i++) {
                programs[programs.length] = {};
            }
            // 前枠継続フラグ
            let rowskip = [0, 0, 0, 0, 0, 0, 0];    

            // 30分ごとの枠
            let $ = cheerio.load(timetableBody);
            $('.schedule-ag > table > tbody > tr').each(function () {
                // 各曜日
                let day = 1;
                $(this).children('td').each(function () {
                    // 前枠が継続する列をスキップ
                    while (rowskip[day] > 0) {
                        day++;
                    }
                    // 番組の枠数(30分単位)
                    // rowspanが未定義(=30分番組)なら1
                    let rowspan = $(this).attr('rowspan');
                    rowskip[day] = rowspan = rowspan ? rowspan : 1;

                    // 初回放送と生放送のみ登録
                    let programType = $(this).attr('class');
                    if (programType == 'bg-f' || programType == 'bg-l') {
                        // 番組情報取得
                        let time = $(this).children('.time').text();
                        time = time.replace(/\n/g, '').replace(/[\s]*/g, '');
                        let title = $(this).children('.title-p').text();
                        title = title.replace(/\n/g, '').replace(/[\s]*/g, '');
                        let rp = $(this).children('.rp').text();
                        rp = rp.replace(/\n/g, '').replace(/[\s]*/g, '');

                        // 0:00～5:00は次の曜日
                        let hour = (time.split(':'))[0];
                        let startDay = ((hour <= 5) ? day + 1 : day) % 7;

                        // 時間と番組名と出演者が揃っていれば番組として登録
                        if (time && title && rp) {
                            programs[startDay][time] = { title: title, rp: rp, length: rowspan * 30 };
                        }
                    }

                    // 曜日番号を日曜始まりに合わせる
                    day = (day == 6) ? 0 : day + 1;
                });
            
                // 次枠へ
                for (let i = 0; i < rowskip.length; i++) {
                    rowskip[i]--;
                }
            });

            // コールバックに番組表を渡す
            if (typeof callback == 'function') {
                callback(programs);
            }
        } else {
            throw Error('Failed to get timetable: ' + timetableResponse.statusCode);
        }
    });
}

// 番組一覧取得
exports.getPrograms = function () {
    return programs;
}

// 番組情報取得
exports.getProgramInfo = function (timeOffset = 0) {
    // 番組の開始時間を計算
    let now = new Date();
    let next = new Date(now.getTime() + timeOffset * 1000);
    let nextDay = next.getDay();
    let nextHour = next.getHours();
    // 番組開始は00分 or 30分とする
    let nextMinute = (next.getMinutes() < 30) ? '00' : '30';

    let programInfo = programs[nextDay][nextHour + ':' + nextMinute];
    if (programInfo) {
        // 該当する番組があれば開始時刻をセットして番組情報を返す
        programInfo['startAt'] = next.setSeconds(0, 0);
        return programInfo;
    } else {
        throw Error('No program found at ' + dayName[nextDay] + ',' + nextHour + ':' + nextMinute);
    }
}

// 配信URL取得
exports.getStreamUrl = function () {
    // 配信URL取得
    request(streamListUrl, function (urlError, urlResponse, urlBody) {
        if (!urlError && urlResponse.statusCode == 200) {
            // XML解析
            parseString(urlBody, function (parseError, parseResult) {
                if (parseError) {
                    throw Error(parseError);
                }
                // 先頭のURLを返す
                let serverinfo = parseResult.ag.serverlist[0].serverinfo[0];
                let server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                let app = serverinfo.app[0];
                let stream = serverinfo.stream[0];
                let streamUrl = server + '/' + app + '/' + stream;
                return streamUrl;
            });
        } else {
            throw Error('Failed to get stream url(' + urlResponse.statusCode + ')');
        }
    });
}
