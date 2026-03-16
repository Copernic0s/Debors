const axios = require('axios');
axios.get('http://localhost:3001/api/debtors')
  .then(res => console.log('Debtors:', res.data.debtors.length, 'Clients:', res.data.clientsByAgent.length))
  .catch(err => console.error(err.message));
