var child_process = require('child_process');

// デバック用ログ出力
var print = function (who, where, what) {
    console.log(who + ':' + where + ':' + what);
}

// 日付のフォーマット
var formatDate = function (date, format) {
    if (!format) {
        format = 'YYYY-MM-DD_hh:mm:ss';
    }

    format = format.replace(/YYYY/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));

    return format;
};

// エンコード
var encode = function (recordedFilePath, programInfo, callback) {
    var startAt = new Date(programInfo.startAt);
    var datetime = formatDate(startAt, 'YYYYMMDD_hhmmss');
    var videoFilePath = datetime + '_video.mp4';
    var audioFilePath = datetime + '_audio.mp4';
    var thumbnailFilePath = datetime + '_thumbnail.jpg';

    var ffmpeg = child_process.spawn('ffmpeg', [
        '-y',
        '-i', recordedFilePath,
    // video
        '-vcodec', 'copy',
        '-acodec', 'libfdk_aac',
        '-ac', '1',
        '-ab', '32k',
        '-ar', '24000',
        videoFilePath,
    // audio
        '-vn',
        '-acodec', 'libfdk_aac',
        '-ac', '1',
        '-ab', '32k',
        '-ar', '24000',
        audioFilePath,
    //thumbnail
        '-ss', '20',
        '-vframes', '1',
        '-f', 'image2',
        '-s', '320x180',
        thumbnailFilePath
    ]);
    ffmpeg.stdout.on('data', function (data) {
        print('ffmpeg', 'stdout', data);
    });
    ffmpeg.stderr.on('data', function (data) {
        print('ffmpeg', 'stderr', data);
    });
    ffmpeg.on('close', function () {
        // 後処理呼び出し
        programInfo['video'] = videoFilePath;
        programInfo['audio'] = audioFilePath;
        programInfo['thumbnail'] = thumbnailFilePath;
        callback(programInfo);
    });
}

// 録画
exports.record = function (programInfo, callback) {
    var flvPath = 'temp.flv';
    
    // rtmpdump呼び出し
    var rtmpdump = child_process.spawn('rtmpdump', [
        // stub
    ]);
    rtmpdump.stdout.on('data', function (data) {
        print('rtmpdump', 'stdout', data);
    });
    rtmpdump.stderr.on('data', function (data) {
        print('rtmpdump', 'stderr', data);
    });
    rtmpdump.on('close', function () {
        // エンコード
        encode(flvPath, programInfo, callback);
    });
}
    