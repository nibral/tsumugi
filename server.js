'use strict';

var timetable = require('./bin/Timetable');
timetable.update();

var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.json(timetable.getPrograms());
});

app.get('/next', function (req, res) {
    res.json(timetable.getProgramInfo());
});

var server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
