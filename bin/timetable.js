'use strict';

var request = require('request');
var cheerio = require('cheerio');
var parseString = require('xml2js').parseString;
var programs;

const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const timetableUrl = 'http://www.agqr.jp/timetable/streaming.php';
const streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';
const streamInfoUrl = 'http://www.uniqueradio.jp/aandg';

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
exports.updatePrograms = function (callback) {
    request(timetableUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
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
            programs = [];
            for (let i = 0; i < 7; i++) {
                programs[programs.length] = {};
            }
            // 前枠継続フラグ
            let rowskip = [0, 0, 0, 0, 0, 0, 0];    

            // 30分ごとの枠
            let $ = cheerio.load(body);
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
            callback(programs);
        } else {
            throw Error('Failed to get timetable: ' + response.statusCode);
        }
    });
}

// 番組一覧取得
exports.getPrograms = function () {
    return programs;
}

// 番組情報取得
exports.getProgramInfo = function (timeOffset) {
    if (!timeOffset) {
        timeOffset = 0;
    }
    
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
exports.getStreamUrl = function (callback) {
    // 配信URL取得
    request(streamListUrl, function (urlError, urlResponse, urlBody) {
        if (!urlError && urlResponse.statusCode == 200) {
            // XML解析
            parseString(urlBody, function (parseError, parseResult) {
                if (parseError) {
                    throw Error(parseError);
                }
                // コールバックに先頭のURLを渡す
                let serverinfo = parseResult.ag.serverlist[0].serverinfo[0];
                let server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                let app = serverinfo.app[0];
                let stream = serverinfo.stream[0];
                let streamUrl = server + '/' + app + '/' + stream;
                callback(streamUrl);
            });
        } else {
            throw Error('Failed to get stream url(' + urlResponse.statusCode + ')');
        }
    });
}

// 配信画面から情報取得
exports.getStreamingProgramInfo = function (callback) {
    request(streamInfoUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // urlから得られたコードを評価して変数に代入
            // 変数名は変えないこと
            let Program_name;
            let Program_personality;
            eval(body);
            Program_name = decodeURIComponent(Program_name);
            Program_personality = decodeURIComponent(Program_personality);
            callback({
                title: Program_name,
                rp: Program_personality
            });
        } else {
            throw Error('Faild to get stream info(' + response.statusCode + ')');
        }
    });
}
