var fs = require('fs');
var path = require('path');
var scheduler = require('./bin/schedule');

scheduler.start(function (programInfo) {
    // 番組名のディレクトリをつくる
    var outputDir = path.join(path.resolve(''), 'public', 'streams',
        (programInfo.title).replace(/\|&;\$%@"<>\(\)\+,/g, ""));
    try {
        fs.mkdirSync(outputDir);
    } catch (error) {
        if (error.code != 'EEXIST') {
            throw (error);
        }
    }
    
    // ファイルを移動
    var video = path.basename(programInfo.video);
    var audio = path.basename(programInfo.audio);
    var thumbnail = path.basename(programInfo.thumbnail);
    fs.renameSync(programInfo.video, outputDir + path.sep + video);
    fs.renameSync(programInfo.audio, outputDir + path.sep + audio);
    fs.renameSync(programInfo.thumbnail, outputDir + path.sep + thumbnail);
});
