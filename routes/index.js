const express = require('express');
const path = require('path');
const curl = require('curl');
var fs = require('fs');

var QuillDeltaToHtmlConverter = require('quill-delta-to-html').QuillDeltaToHtmlConverter;

const Point = require('../models/Point');

const {
  ensureAuthenticated,
  forwardAuthenticated
} = require('../config/auth');

const router = express.Router();

router.get('/', function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  Point.find({
    display: true
  }, function(err, points) {
    res.render('map', {
      points,
      user
    });
  });
});

router.get('/point/:id', function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  Point.findOne({
    _id: req.params.id
  }, function(err, point) {
    res.render('point', {
      point,
      user
    });
  });
});

router.get('/dashboard', ensureAuthenticated, function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  Point.find({}, null, {
    sort: {
      date: -1
    }
  }, function(err, points) {
    res.render('dashboard', {
      user,
      points
    });
  });
});

router.post('/search', ensureAuthenticated, function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  Point.find({
    $or: [{
        "name": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "address": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "city": {
          $regex: new RegExp(req.body.search, 'i')
        }
      }
    ]
  }, null, {
    sort: {
      date: -1
    }
  }, function(err, points) {
    console.log(points);
    res.render('dashboard', {
      user,
      points,
      search: req.body.search
    });
  });
});

router.post('/activatePoint/:id', ensureAuthenticated, function(req, res) {
  var statut;
  (req.body.display == 'on') ? statut = true: statut = false;
  Point.findByIdAndUpdate({
    _id: req.params.id
  }, {
    display: statut
  }, function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('/dashboard');
    }
  })
});

router.get('/deletePoint/:id', ensureAuthenticated, function(req, res) {
  Point.findOne({
    _id: req.params.id
  }, function(err, point) {
    if (err) return handleError(err);
    var deleteFiles = [];
    var desc = JSON.parse(point.description);
    deleteFiles.push('./views/pictures/' + point.avatar);
    for (var i = 0; i < desc.length; i++) {
      if (typeof desc[i].insert == 'object' && Object.keys(desc[i].insert).indexOf("image") > -1) {
        deleteFiles.push('./views' + desc[i].insert.image);
      }
    }
    for (var i = 0; i < deleteFiles.length; i++) {
      // fs.unlinkSync(deleteFiles[i])
      fs.unlink(deleteFiles[i], (err) => {})
    }
  });

  Point.deleteOne({
    _id: req.params.id
  }, function(err) {
    if (err) return handleError(err);
    req.flash('success_msg', 'Le point a été supprimé.');
    res.redirect('/dashboard');
  });
});

router.get('/updatePoint/:id', ensureAuthenticated, function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  Point.findOne({
    _id: req.params.id
  }, function(err, point) {
    if (err) return handleError(err);
    res.render('updatePoint', {
      user,
      point
    });
  });
});

router.post('/updatePoint', ensureAuthenticated, async (req, res) => {
  let errors = [];
  var user;
  (req.user) ? user = true: user = false;

  function check() {
    var desc = JSON.parse(req.body.description).ops;
  }

  try {
    check();
  } catch (error) {
    if (error) {
      errors.push({
        msg: 'Erreur'
      });
      res.render('updatePoint', {
        errors,
        user,
        point: req.body
      })
    }
  }

  var desc = JSON.parse(req.body.description).ops;
  var idx = 0;

  for (var i = 0; i < desc.length; i++) {
    if (typeof desc[i].insert == 'object' && Object.keys(desc[i].insert).indexOf("image") > -1) {
      if (desc[i].insert.image.charAt(0) == 'd' && desc[i].insert.image.charAt(1) == 'a' && desc[i].insert.image.charAt(2) == 't' && desc[i].insert.image.charAt(3) == 'a') {
        var path = "/pictures/" + req.body.updates + "_" + req.body.name + "_" + idx + ".png";
        let base64String = desc[i].insert.image;
        let base64Image = base64String.split(';base64,').pop();
        idx++;
        desc[i].insert.image = path;
        fs.writeFile("./views" + path, base64Image, {
          encoding: 'base64'
        }, function(err) {
          console.log(path + ' created');
        });
      }
    }
  }

  var converter = new QuillDeltaToHtmlConverter(desc, {});
  var html = converter.convert();

  Point.findByIdAndUpdate({
    _id: req.body._id
  }, {
    description: JSON.stringify(desc),
    descriptionHTML: html,
    $inc: {
      updates: 1
    }
  }, function(err) {
    if (err) {
      console.log(err);
    } else {
      req.flash('success_msg', 'Le point a été modifié.');
      res.redirect('/point/' + req.body._id);
    }
  })
});

router.get('/addPoint', ensureAuthenticated, function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  res.render('addPoint', {
    user
  });
});

router.post('/addPoint', ensureAuthenticated, async (req, res) => {
  console.log(req.get("content-length"));
  var user;
  (req.user) ? user = true: user = false;
  let errors = [];

  if (!req.files) {
    errors.push({
      msg: 'Veuillez ajouter un avatar.'
    });
  }
  if (!req.body.address || !req.body.city || !req.body.cp || !req.body.name) {
    errors.push({
      msg: 'Veuillez compléter tous les champs.'
    });
  }

  if (errors.length > 0) {
    res.render('addPoint', {
      errors,
      user,
      _body: req.body
    })
  } else {
    function check() {
      var desc = JSON.parse(req.body.description).ops;
    }

    try {
      check();
    } catch (error) {
      if (error) {
        errors.push({
          msg: 'Erreur'
        });
        res.render('addPoint', {
          errors,
          user,
          _body: req.body
        })
      }
    }

    var desc = JSON.parse(req.body.description).ops;
    var idx = 0;

    for (var i = 0; i < desc.length; i++) {
      if (typeof desc[i].insert == 'object' && Object.keys(desc[i].insert).indexOf("image") > -1) {
        var path = "/pictures/" + req.body.name + "_" + idx + ".png";
        let base64String = desc[i].insert.image;
        let base64Image = base64String.split(';base64,').pop();
        idx++;
        desc[i].insert.image = path;
        fs.writeFile("./views" + path, base64Image, {
          encoding: 'base64'
        }, function(err) {
          console.log(path + ' created');
        });
      }
    }

    var converter = new QuillDeltaToHtmlConverter(desc, {});
    var html = converter.convert();

    req.files.avatar.mv('./views/pictures/' + req.files.avatar.name);
    var query = "https://api-adresse.data.gouv.fr/search/?q=" + req.body.address + " " + req.body.city + " " + req.body.cp;
    curl.getJSON(query, {}, function(err, response, data) {
      req.session.newPoint = {
        date: new Date(Date.now()),
        name: req.body.name,
        address: req.body.address,
        city: req.body.city,
        cp: req.body.cp,
        description: JSON.stringify(desc),
        descriptionHTML: html,
        avatar: req.files.avatar.name,
        position: {
          lat: data.features[0].geometry.coordinates[1],
          lng: data.features[0].geometry.coordinates[0]
        }
      }
      if (err) {
        errors.push({
          msg: 'Erreur.'
        });
        res.render('addPoint', {
          user,
          errors
        })
      }
      res.redirect('/setPosition')
    });
  }
});

router.get('/setPosition', ensureAuthenticated, function(req, res) {
  var user;
  (req.user) ? user = true: user = false;
  res.render('setPosition', {
    position: req.session.newPoint.position,
    user
  });
});

router.post('/setPosition', ensureAuthenticated, function(req, res) {
  req.session.newPoint.position.lat = req.body.lng;
  req.session.newPoint.position.lng = req.body.lat;
  var point = new Point(req.session.newPoint)
  point.save(function(err) {
    if (err) return console.log(err);
    delete req.session.newPoint;
    req.flash('success_msg', 'Le point a été ajouté.');
    res.redirect('/dashboard')
  });
});

module.exports = router;
