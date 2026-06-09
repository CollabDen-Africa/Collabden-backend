const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlist.controller');

// Join the waitlist
router.post('/', waitlistController.joinWaitlist);

// Download the waitlist as Excel
router.get('/download', waitlistController.downloadWaitlist);

module.exports = router;
