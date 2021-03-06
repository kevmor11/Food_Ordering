const express = require('express');
const sendSMS = require('../send-sms').sendSMS;
const callResturant = require('../send-sms').callResturant;
const bodyParser = require('body-parser');

const router = express.Router();
module.exports = (knex) => {
  router.get('/', (req, res) => {
    knex
      .select('*')
      .from('dishes')
      .then((dishes) => {
        res.json(dishes);
      });
  });

  router.put('/', (req, res) => {
    knex
      .select('name', 'price')
      .from('dishes')
      .then((selected) => {
        res.json(selected);
      });
  });
  const dataGlobal = {
    id: {},
    quantity: {}
  };
  router.post('/checkout', (req, res) => {
    const dataBody = req.body;
    const dishIDs = Object.keys(dataBody);
    const dishQuantities = {};
    dishIDs.forEach((dishID) => {
      dishQuantities[dishID] = Number(dataBody[dishID].quantity);
    });
    dataGlobal.id = dishIDs;
    dataGlobal.quantity = dishQuantities;
  });

  router.post('/payment', (req, res) => {
    const dataBody = req.body;
    const customerName = dataBody.name;
    const customerPhone = dataBody.tel;
    const customerAddress = 'fake';
    let nextID;
    knex('clients').insert({ name: customerName, phone_number: customerPhone, address: customerAddress }).asCallback((err) => {
      if (err) {
        knex.destroy();
        return console.error('error inserting client', err);
      }

      knex('clients').orderBy('id', 'desc').limit(1).asCallback((err, rows) => {
        const clientID = rows[0].id;
        knex('orders').insert({ client_id: clientID }).asCallback((err, rows) => {
          if (err) {
            knex.destroy();
            return console.error('error inserting order', err);
          }
          knex('orders').orderBy('id', 'desc').limit(1).asCallback((err, rows) => {
            if (err) {
              knex.destroy();
              return console.error('error querying order id', err);
            }
            if (!(rows[0].id)) {
              nextID = 1;
            } else {
              nextID = (rows[0].id);
              dataGlobal.id.forEach((id_num) => {
                const qty = dataGlobal.quantity[id_num];
                knex('order_quantity').insert({ quantity: qty, dish_id: id_num, order_id: nextID }).asCallback((err) => {
                  if (err) {
                    knex.destroy();
                    return console.error('error inserting into order_quantity table', err);
                  }
                  console.log('New order successfully added order quantity');
                });
              });
            }
          });
        });
      });
                  // knex.destroy();
    });

    console.log("Calling the restaurant");
    callResturant(customerName, customerPhone);
    res.redirect('/thankyou');

  });

  router.post('/callcontent/:name/:phoneNum', (req, res) => {
    let reqName = req.params.name;
    let reqPhoneNumber = req.params.phoneNum;

    knex
    .select('orders.id')
    .from('orders')
    .join('clients', 'clients.id', '=', 'orders.client_id')
    .where('name', reqName)
    .andWhere('phone_number', reqPhoneNumber)
    .orderBy('id', 'desc')
    .limit(1)
    .asCallback((err, rows) => {
      if (err) {
        knex.destroy();
        return console.error('error inserting into order_quantity table', err);
      }
      let dbOrderNumber = rows[0].id;
      knex
      .select('dishes.name')
      .from('dishes')
      .join('order_quantity', 'order_quantity.dish_id', '=', 'dishes.id')
      .join('orders', 'orders.id', '=', 'order_quantity.order_id')
      .join('clients', 'clients.id', '=', 'orders.client_id')
      .where('clients.name', reqName)
      .andWhere('clients.phone_number', reqPhoneNumber)
      .asCallback((err, rows) => {
        if (err) {
          knex.destroy();
          return console.error('error selecting name from dishes table', err);
        }
        let dishes = [];
        rows.forEach((dish)=> {
          dishes.push(dish.name);
        });
        knex
        .select('order_quantity.quantity')
        .from('order_quantity')
        .join('orders', 'orders.id', '=', 'order_quantity.order_id')
        .join('clients', 'clients.id', '=', 'orders.client_id')
        .where('clients.name', reqName)
        .andWhere('clients.phone_number', reqPhoneNumber)
        .asCallback((err, rows)=> {
          if (err) {
            knex.destroy();
            return console.error('error selecting name from order quantities table', err);
          }
          let quantity = [];
          rows.forEach((item)=> {
            quantity.push(item.quantity);
          });
          const orderData = {
            orderNumber: dbOrderNumber,
            clientInfo: {
              name: reqName,
              phoneNumber: reqPhoneNumber,
              address: '128 W. Hastings Ave, Vancouver, BC'
            },
            dishes: dishes,
            quantity: quantity
          };

          res.set('Content-Type', 'text/xml');
          res.render('order', orderData);
        });
      });
    });
  });

  router.post('/call', (req, res) => {
    res.send('calling');
  });

  router.post('/customerupdate', (req, res) => {
    const clientMessage = `Thanks for your order 
    you order number is ${req.body.ordernumber}
    and will be ready in ${req.body.preptime} minutes`;
    sendSMS(clientMessage);
    res.redirect('/restaurant');
  });
  return router;
};
