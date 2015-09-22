var url = 'http://www.agqr.jp/timetable/streaming.php';

var request = require('request');
var cheerio = require('cheerio');

// 番組表取得
exports.getTimeTable = function (callback) {
    request(url, function (err, res, body) {
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
        }
        
        // コールバックに番組表を渡す
        callback(programs);
    });
}
