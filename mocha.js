var config = require('config');
var port = config.port;

var express = require('express');
var app = express();
app.use(express.static(__dirname + '/streams'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

var router = require('./routes');
app.get('/', router.index);
app.get('/:page', router.page);
app.get('/player/:path', router.player);

var scheduler = require('./scheduler');
var recorder = require('./recorder');
var cronPattern = '45 29,59 * * * *';
scheduler.start(cronPattern, recorder.record);

var server = app.listen(port, function() {
    console.log('Listening at port %d', server.address().port);
});

