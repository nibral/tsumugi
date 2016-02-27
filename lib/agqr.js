'use strict';

const request = require('request-promise');
const cheerio = require('cheerio');
const parseString = require('xml2js').parseString;

/*
    曜日番号から曜日名を返す
    1が月曜、7が日曜(ISO 8601)
*/
const getDayNameFromDayNumber = (dayNumber) => {
    const dayNameTable = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // 入力値範囲チェック
    if (!dayNumber || dayNumber < 1 || 7 < dayNumber) {
        return '';
    }

    return dayNameTable[dayNumber - 1];
}

/*
    超!A&G公式HP解析して番組表(timetable)を返す
    
    timetable: {
        "Mon": {
            "16:00": {
                "title": 番組名,
                "personaliy": パーソナリティ,
                "length": 番組長(分),
                "type": 番組種別(Live|First|Repeat)
            },
            "17:00": {...},
            ...
        },
        "Tue": {...},
        ...
    }
*/
module.exports.downloadAndParseTimetable = () => {
    return new Promise((resolve, reject) => {
        const timetableUrl = 'http://www.agqr.jp/timetable/streaming.html';
        const options = {
            url: timetableUrl,
            transform: (body) => {
                // 番組表のHTMLが一部壊れているので修正する
                // tr開始タグが余計
                body = body.replace(/<\/tr>[\s]*<tr>[\s]*<tr>/g, '</tr>\n<tr>');
                // tr開始タグが足りない
                body = body.replace(/<\/tr>[\s]*<th/g, '</tr>\n<tr>\n<th');

                return cheerio.load(body);
            }
        };

        request(options).then(($) => {
            // 番組表初期化
            let timetable = {};
            for (let i = 1; i <= 7; i++) {
                timetable[getDayNameFromDayNumber(i)] = {};
            }

            // 前枠継続フラグ
            let rowskip = [0, 0, 0, 0, 0, 0, 0];

            // 1行が30分刻みの放送枠を表す
            $('.timetb-ag > tbody > tr').each((rowIndex, row) => {
                // 各行は月曜始まり
                let dayNo = 1;

                // 前枠が継続する曜日をスキップ
                while (rowskip[dayNo] > 0) {
                    dayNo++;
                }

                // 曜日ごとに番組情報解析
                $(row).children('td').each((colIndex, element) => {
                    /*
                        (colIndex + 1)が曜日番号と一致するが、ループの外側で
                        前枠が継続する列(=曜日)をスキップする処理が必要なので
                        dayNoとして別に定義している
                    */

                    // 番組の枠数(30分単位)
                    // rowspanが未定義(=30分番組)なら1
                    let rowspan = $(element).attr('rowspan');
                    rowskip[dayNo] = rowspan = rowspan ? rowspan : 1;

                    // 時間・番組名・パーソナリティ
                    let time = $(element).children('.time').text();
                    let title = $(element).children('.title-p').text();
                    let personality = $(element).children('.rp').text();

                    // 空白・改行の除去
                    time = time.replace(/\n/g, '').replace(/[\s]*/g, '');
                    title = title.replace(/\n/g, '').replace(/[\s]*/g, '');
                    personality = personality.replace(/\n/g, '').replace(/[\s]*/g, '');

                    // 番組種別
                    let programType = '';
                    switch ($(element).attr('class')) {
                        case 'bg-l':
                            programType = 'Live';
                            break;
                        case 'bg-f':
                            programType = 'First';
                            break;
                        default:
                            programType = 'Repeat';
                            break;
                    }

                    // 0:00～5:00は次の曜日
                    let hour = (time.split(':'))[0];
                    let startDayNo = ((hour <= 5) ? dayNo + 1 : dayNo) % 8;
                    if (startDayNo === 0) {
                        startDayNo++;
                    }

                    // 時間と番組名が揃っていれば番組として登録
                    if (time && title) {
                        // パーソナリティが設定されていない番組もある
                        if (!personality) {
                            personality = '';
                        }

                        const startDayName = getDayNameFromDayNumber(startDayNo);
                        timetable[startDayName][time] = {
                            title: title,
                            personality: personality,
                            length: rowspan * 30,
                            type: programType
                        };
                    }
                    
                    // 曜日番号を進める
                    dayNo++;
                });
                
                // 前枠継続フラグを1減らして次の枠へ
                for (let i = 0; i < rowskip.length; i++) {
                    rowskip[i]--;
                }
            });
            resolve(timetable);
        }).catch((error) => {
            reject(error);
        });
    });
};

/*
    番組表から次の番組の情報を取得
*/
module.exports.getNextProgramInfo = function (timetable, timeOffset) {
    if (!timeOffset) {
        timeOffset = 0;
    }
    
    // 番組の開始時間を計算
    let now = new Date();
    let next = new Date(now.getTime() + timeOffset * 1000);
    let nextDayName = getDayNameFromDayNumber(next.getDay());
    let nextHour = next.getHours();

    // 番組開始は00分 or 30分とする
    let nextMinute = (next.getMinutes() < 30) ? '00' : '30';

    let programInfo = timetable[nextDayName][nextHour + ':' + nextMinute];
    if (programInfo) {
        // 該当する番組があれば開始時刻をセットして番組情報を返す
        programInfo['startAt'] = next.setSeconds(0, 0);
        return programInfo;
    } else {
        throw Error('No program found at ' + nextDayName + ',' + nextHour + ':' + nextMinute);
    }
}

/*
    動画の配信URLを返す
*/
module.exports.getStreamUrl = () => {
    return new Promise((resolve, reject) => {
        const streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';
        request(streamListUrl).then((response) => {
            // XML解析
            parseString(response, function (parseError, parseResult) {
                if (parseError) {
                    reject(parseError);
                }
                // URLリストの先頭要素を返す
                let serverinfo = parseResult.ag.serverlist[0].serverinfo[0];
                let server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                let app = serverinfo.app[0];
                let stream = serverinfo.stream[0];
                let streamUrl = server + '/' + app + '/' + stream;
                resolve(streamUrl);
            });
        }).catch((error) => {
            reject(error);
        });
    });
}

/*
    配信画面から情報取得
*/
module.exports.getStreamingProgramInfo = function (callback) {
    const streamInfoUrl = 'http://www.uniqueradio.jp/aandg';
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
