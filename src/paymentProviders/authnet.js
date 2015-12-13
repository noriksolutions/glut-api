'use strict';

let config = require('config');
let request = require('request');
let _ = require('lodash');
let paymentUtils = require('../utils/payment');

let authNet = config.paymentProviders.authnet;

let merchantAuthentication = {
  name: authNet.apiLoginId,
  transactionKey: authNet.transactionKey
};

let validationMode = authNet.sandbox ? 'testMode' : 'liveMode';

function authenticate() {
  return authNetRequest({
    authenticateTestRequest: {
      merchantAuthentication: merchantAuthentication
    }
  });
}

function createCustomer(options) {
  let expDate = paymentUtils.parseExpiration(options.expirationDate);
  let promise = new Promise(function(resolve, reject) {
    authNetRequest({
      createCustomerProfileRequest: {
        merchantAuthentication: merchantAuthentication,
        profile: {
          email: options.email,
          paymentProfiles: {
            customerType: 'individual',
            payment: {
              creditCard: {
                cardNumber: options.cardNumber,
                expirationDate: expDate.month + '-' + expDate.year
              }
            }
          }
        },
        validationMode: validationMode
      }
    })
    .then(function(body) {
      resolve({
        customerId: _.get(body, 'customerId'),
        paymentId: _.get(body, 'paymentId'),
        gateway: 'authnet',
        last4: paymentUtils.last4(options.cardNumber),
        expMonth: paymentUtils.padLeft('00', expDate.month),
        expYear: paymentUtils.padLeft('00', expDate.year)
      });
    })
    .catch(function(err) {
      reject(err);
    });
  });
  return promise;
}

function deleteCustomer(options) {
  return authNetRequest({
    deleteCustomerProfileRequest: {
      merchantAuthentication: merchantAuthentication,
      customerProfileId: options.customerProfileId
    }
  });
}

function updateCustomer(options) {
  // ?? validation for newEmail, customerProfileId
  return authNetRequest({
    updateCustomerProfileRequest: {
      merchantAuthentication: merchantAuthentication,
      profile: {
        email: options.email,
        customerProfileId: options.customerId
      }
    }
  });
}

function updateCustomerPaymentProfile(options) {
  // ?? validation for customerProfileId, paymentProfileId, creditCard, expirationDate
  return authNetRequest({
    updateCustomerPaymentProfileRequest: {
      merchantAuthentication: merchantAuthentication,
      customerProfileId: options.customerId,
      paymentProfile: {
        payment: {
          creditCard: {
            cardNumber: options.cardNumber,
            expirationDate: options.expirationDate
          }
        },
        customerPaymentProfileId: options.paymentId
      },
      validationMode: validationMode
    }
  });
}

function createTransaction(options) {
  return authNetRequest({
    createTransactionRequest: {
      merchantAuthentication: merchantAuthentication,
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: options.amount,
        payment: {
          creditCard: {
            cardNumber: options.cardNumber,
            expirationDate: options.expMonth + '-' + options.expYear,
            cardCode: options.cvv2
          }
        }
      }
    }
  });
}

function chargeCreditCard(options) {
  // ?? validation for amount, customerProfileId, paymentProfileId
  let promise = new Promise(function(resolve, reject) {
    authNetRequest({
      createCustomerProfileTransactionRequest: {
        merchantAuthentication: merchantAuthentication,
        transaction: {
          profileTransAuthCapture: {
            amount: options.amount,
            customerProfileId: options.customerId,
            customerPaymentProfileId: options.paymentId,
            cardCode: options.cardCode
          }
        }
      }
    })
    .then(function(resp) {
      resolve({
        customerId: resp.customerProfileId,
        paymentId: resp.paymentProfiles[0].customerPayment
      });
    })
    .catch(reject);
  });
  return promise;
}

function getCustomerProfile(options) {
  // ?? validation for customerProfileId
  return authNetRequest({
    getCustomerProfileRequest: {
      merchantAuthentication: merchantAuthentication,
      customerProfileId: options.customerId
    }
  });
}

function getCustomerProfileIds() {
  return authNetRequest({
    getCustomerProfileIdsRequest: {
      merchantAuthentication: merchantAuthentication
    }
  });
}

function authNetRequest(json) {
  var promise = new Promise(function(resolve, reject) {
    request({
      url: authNet.endpoint,
      json: true,
      body: json,
      method: 'post'
    }, function(err, httpResponse, body) {
      if (err) {
        reject({ err: 'auth.net error.' });
        return;
      }
      var parsedJson;
      try {
        parsedJson = JSON.parse(body.trim());
      } catch (ex) {}
      var resultCode = _.get(parsedJson, 'messages.resultCode');
      if (resultCode === 'Ok')
        resolve({ refId: _.get(parseJson, 'refId') });
      else
        reject({ message: _.get(parseJson, 'messages.message[0].text') });
    });
  });
  return promise;
}

function methods() {
  var promise = new Promise(function(resolve, reject) {
    resolve({
      Visa: 'Visa',
      MasterCard: 'Master Card',
      AmericanExpress: 'American Express',
      Discover: 'Discover',
      JCB: 'JCB',
      DinersClub: 'Diners Club'
    });
  });
  return promise;
}

module.exports = {
  authenticate,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  updateCustomerPaymentProfile,
  createTransaction,
  chargeCreditCard,
  getCustomerProfile,
  getCustomerProfileIds,
  methods
};