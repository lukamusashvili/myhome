const STATEMENTS_CREATE_URL = 'https://api-statements.tnet.ge/v1/statements/create';

async function createStatement(token, fields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, String(value));
  }

  const response = await fetch(STATEMENTS_CREATE_URL, {
    method: 'POST',
    headers: {
      'global-authorization': token,
      locale: 'ka',
      'x-referrer-key': 'myhome',
      'x-website-key': 'myhome',
    },
    body: formData,
  });

  const data = await response.json();

  return { status: response.status, data };
}

module.exports = { createStatement };
