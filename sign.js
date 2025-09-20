const http = require('http');
const { ethers } = require('ethers');

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/sign')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const {
      player,
      points = 100,
      amountTokens = '1000000000000000000',
      nonce = '0',
      expiry = Math.floor(Date.now() / 1000) + 86400,
      contractAddress = '0x3b807e75c5b3719b76d3ae0e4b3c9f02984f2f41'
    } = Object.fromEntries(urlObj.searchParams);

    if (!player || !ethers.utils.isAddress(player)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid player address' }));
    }
    if (!ethers.utils.isAddress(contractAddress)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid contract address' }));
    }
    const pointsNum = Number(points);
    const nonceNum = Number(nonce);
    const expiryNum = Number(expiry);
    if (isNaN(pointsNum) || pointsNum < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid points' }));
    }
    if (isNaN(nonceNum) || nonceNum < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid nonce' }));
    }
    if (isNaN(expiryNum) || expiryNum < Date.now() / 1000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid expiry' }));
    }
    const tokenAmount = ethers.utils.parseUnits(amountTokens.toString(), 18);

    let signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      signerPrivateKey = '0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0';
    }
    const wallet = new ethers.Wallet(signerPrivateKey);

    const payloadHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [player, pointsNum, tokenAmount, nonceNum, expiryNum, contractAddress]
      )
    );

    const ethHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n32' + payloadHash.slice(2))
    );

    const signature = await wallet.signMessage(ethers.utils.arrayify(ethHash));
    const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(ethHash), signature);

    const out = {
      player,
      points: pointsNum.toString(),
      amountTokens: ethers.utils.formatUnits(tokenAmount, 18),
      amountWei: tokenAmount.toString(),
      nonce: nonceNum.toString(),
      expiry: expiryNum.toString(),
      contractAddress,
      signerAddress: wallet.address,
      signature,
      recoveredSigner: recovered,
      success: recovered.toLowerCase() === wallet.address.toLowerCase()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});