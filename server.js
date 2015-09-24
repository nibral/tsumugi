var fs = require('fs');
var path = require('path');
var scheduler = require('./bin/schedule');

scheduler.start(function (info) {
    // 番組名のディレクトリをつくる
    var dir = path.dirname(info.video);
    var pgDir = dir
        + path.sep
        + (info.title).replace(/\|&;\$%@"<>\(\)\+,/g, "");
    try {
        fs.mkdirSync(pgDir);
    } catch (error) {
        if (error.code != 'EEXIST') {
            throw (error);
        }
    }
    
    // ファイルを移動
    var video = path.basename(info.video);
    var audio = path.basename(info.audio);
    var thumbnail = path.basename(info.thumbnail);
    fs.renameSync(info.video, pgDir + path.sep + video);
    fs.renameSync(info.audio, pgDir + path.sep + audio);
    fs.renameSync(info.thumbnail, pgDir + path.sep + thumbnail);
});
