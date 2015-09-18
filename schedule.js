var url = 'http://www.agqr.jp/timetable/streaming.php';

var http = require('http')
var cheerio = require('cheerio');

http.get(url, function (res) {
    // 文字エンコードを明示しないと、マルチバイト文字がchunkを跨いで
    // 届いた時に文字化けする
    res.setEncoding('utf8');

    // chunkを連結
    var body = '';
    res.on('data', function (chunk) {
        body += chunk;
    });
    
    // 受信が終わったら処理に入る
    res.on('end', function (res) {
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
            
        // cheerioでhtmlを解析
        var $ = cheerio.load(body); 

        // 前枠継続フラグ
        var rowskip = [0, 0, 0, 0, 0, 0, 0];    

        // 30分ごとの枠
        $('.schedule-ag > table > tbody > tr').each(function () {
            // 時間ヘッダ
            console.log($(this).children('th').text() + '--------');

            // 曜日カウンタ        
            var day = 0;                            

            // 各曜日
            $(this).children('td').each(function () {
                // 前枠が継続する列をスキップ
                while (rowskip[day] > 0) {
                    console.log('    ' + rowskip[day] + ':');
                    day++;
                }

                // rowspanが未定義(=30分番組)なら1
                var rowspan = $(this).attr('rowspan');
                rowskip[day] = rowspan = rowspan ? rowspan : 1;
                
                // 各番組タイトル
                $(this).children('.title-p').each(function () {
                    var title = $(this).text().replace(/\n/g, '')
                    title = title.replace(/[\s]*/g, '');
                    console.log('    ' + rowspan + ':' + title);
                });

                day++;
            });

            // 前枠の継続する列が残ってたら埋める
            while (day <= 6) {
                console.log('    ' + rowskip[day] + ':')
                day++;
            }
            
            // 次枠へ
            for (var i = 0; i < rowskip.length; i++) {
                rowskip[i]--;
            }
        });
    });
});