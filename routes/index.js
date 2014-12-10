var fs = require('fs');
var config = require('config');
var outputDir = config.outputDir;

var getWeekNumber = function(date) {
  var year = date.getFullYear();

  var ordinaldate;
  if(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    ordinaldate = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  } else {
    ordinaldate = [0, 31, 59, 90, 120, 151, 182, 212, 243, 273, 304, 334];
  }

  var day = date.getDay();
  day = (day === 0) ? 7 : day;

  var weeknumber = Math.floor((ordinaldate[date.getMonth()] + date.getDate() - day + 10 ) / 7);
  if(weeknumber === 0) {
    year--;
	weeknumber = getWeekNumber(new Date(year, 11, 31)).weeknumber;
  } else if(weeknumber === 53) {
    var lastday = (new Date(year, 11, 31)).getDay();
	if(1 <= lastday && lastday <= 3) {
	  year++;
	  weeknumber = 1;
	}
  }

  return {
    "year": year,
    "weeknumber": weeknumber
  };
}

var enumerateRecFile = function(callback) {
  fs.readdir(outputDir, function(err, files) {
    if(err) {
      throw err;
    }

    var recfiles = {};
    for(var i=files.length - 1; i>=0; i--) {
      var element = files[i].match(/^\[([0-9]{4})([0-9]{2})([0-9]{2})\]\[(.*)\](.*)\.mp4$/);
      if(!element) {
        continue;
      }

      var recweeknum = getWeekNumber(new Date(element[1], element[2] - 1, element[3]));
      var recweek = recweeknum.year + "W" + recweeknum.weeknumber;
      if(!(recweek in recfiles)) {
	    recfiles[recweek] = [];
      }

      recfiles[recweek].push({
        path: element[0].slice(0,-4),
        title: element[5].split("_").join(" "),
        mc: element[4],
        recdate: {
          year: element[1],
          month: element[2],
          day: element[3],
        }
      });
    }

    for(var key in recfiles) {
      recfiles[key].reverse();
    }

    callback(recfiles);
  });
}

exports.index = function(req, res) {
  enumerateRecFile(function(recfiles) {
    res.render('list', {
      recfiles: recfiles,
      prev: -1,
      next: -1
    });
  });
}

exports.page = function(req, res) {
  var pagenum = parseInt(req.params.page);

  if(pagenum < 0) {
    res.send('invalid page number');
    return;
  }

  var nowdate = new Date();
  var showdate = new Date(nowdate.getTime() - (pagenum * 7 * 86400000));
  var showweeknum = getWeekNumber(showdate);
  var showweek = showweeknum.year + "W" + showweeknum.weeknumber;

  enumerateRecFile(function(recfiles) {
    var showfiles = {};
    if(showweek in recfiles) {
      showfiles[showweek] = recfiles[showweek];
    } else {
      showfiles[showweek] = [];
    }
    res.render('list', {
      recfiles: showfiles,
      prev: (pagenum === 0) ? -1 : pagenum - 1,
      next: pagenum + 1
    });
  });
}

exports.player = function(req, res) {
  res.render('player', {
    title: 'player',
    path: req.params.path + '.mp4'
  });
}

