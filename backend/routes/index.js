'use strict';

const express = require('express');
const router = express.Router();

router.use('/matches', require('./matches'));
router.use('/teams', require('./teams'));
router.use('/leagues', require('./leagues'));
router.use('/players', require('./players'));
router.use('/predictions', require('./predictions'));
router.use('/live', require('./live'));
router.use('/search', require('./search'));
router.use('/admin', require('./admin'));

module.exports = router;
