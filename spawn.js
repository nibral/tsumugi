var http_port = 3000;

var child_process = require('child_process');

var express = require('express');
var app = express();

app.get('/sample', function(req, res) {
    res.writeHead(200, { 'Content-Type': 'audio/mp4' });

    var ffmpeg = child_process.spawn('D:\\tools/ffmpeg', [
        '-i', 'sample.mp4',
        '-f', 'mp4',
        '-vn',
        '-acodec', 'libfdk_aac',
        '-ac', '1',
        '-ab', '32k',
        '-ar', '24000',
        '-movflags', 'frag_keyframe+empty_moov',
        'pipe:1'
    ]);

    ffmpeg.stdout.pipe(res);
    // ffmpeg.stderr.pipe(res);
});

var server = app.listen(http_port, function() {
    console.log('listening at port %d', http_port);
});
