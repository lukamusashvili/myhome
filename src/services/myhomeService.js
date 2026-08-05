const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Node's own fetch gets a 403 from Cloudflare's bot detection (TLS/HTTP
// fingerprinting) even with identical headers; curl passes. Shelling out
// sidesteps that until we have a more robust fix.
async function fetchHtml(url) {
  const { stdout } = await execFileAsync('curl', [
    '-s',
    '-L',
    '-A', BROWSER_USER_AGENT,
    url,
  ]);
  return stdout;
}

async function getStatement(id) {
  const html = await fetchHtml(`https://www.myhome.ge/udzravi-qoneba/${id}/x/`);
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);

  if (!match) {
    return { status: 404, statement: null };
  }

  const data = JSON.parse(match[1]);
  const query = data.props.pageProps.dehydratedState.queries.find((q) =>
    q.queryKey.includes('details')
  );
  const statement = query?.state?.data?.data?.statement ?? null;

  return { status: statement ? 200 : 404, statement };
}

module.exports = { getStatement };
