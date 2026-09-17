const express = require('express');
const router = express.Router();
const { listMandals, createMandal } = require('../controllers/mandal.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Either role can list mandals; creation is used from the citizen
// Report Issue flow ("+ Add a new mandal").
router.get('/mandals', authenticate, listMandals);
router.post('/mandals', authenticate, createMandal);

module.exports = router;
