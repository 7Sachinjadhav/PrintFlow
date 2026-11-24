const CASHFREE_APP_ID = Buffer.from('MTUzNjc5OTgzMThmMWMzODAzNjg4OTAwOGI3OTk3NjM1MQ==', 'base64').toString('utf8');
const CASHFREE_SECRET_KEY = Buffer.from('Y2Zza19tYV9wcm9kXzQ5MWFmMmU2Nzc3MDczOWU2ODFkYjgzNDcwNDFkODFiXzI5N2FhNGJl', 'base64').toString('utf8');
const CASHFREE_API_URL = 'https://api.cashfree.com/pg';

async function testCashfreeAPI() {
  const ordRes = await fetch(`${CASHFREE_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: 'cf_ord_' + Date.now(),
      order_amount: 2.00,
      order_currency: 'INR',
      customer_details: {
        customer_id: 'cust_direct',
        customer_phone: '8073577702',
        customer_name: 'Sachin Jadhav',
        customer_email: 'sachin@printflow.local'
      },
      order_meta: {
        return_url: 'https://printflow-production-c9e53090.up.railway.app/token/test?cf_id={order_id}',
        notify_url: 'https://printflow-production-c9e53090.up.railway.app/api/payments/webhook/cashfree'
      }
    })
  });

  const ordData = await ordRes.json();
  console.log('Order status:', ordRes.status, 'Session:', ordData.payment_session_id?.substring(0, 30));

  const payRes = await fetch(`${CASHFREE_API_URL}/orders/sessions`, {
    method: 'POST',
    headers: {
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payment_session_id: ordData.payment_session_id,
      payment_method: {
        upi: {
          channel: 'link'
        }
      }
    })
  });

  const payData = await payRes.json();
  console.log('Pay Response status:', payRes.status);
  console.log('Pay Response data:', JSON.stringify(payData, null, 2));
}

testCashfreeAPI().catch(console.error);
