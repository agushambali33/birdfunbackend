// sign.js
const { ethers } = require('ethers');

module.exports = async (req, res) => {
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);

  if (req.method === 'GET') {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const {
        player,
        points = '100',
        nonce = '0',
        expiry = (Math.floor(Date.now() / 1000) + 86400).toString(),
        contractAddress = '0x3b807e75c5b3719b76d3ae0e4b3c9f02984f2f41'
      } = Object.fromEntries(urlObj.searchParams);

      const pointsNum = Number(points);
      const nonceNum = Number(nonce);
      const expiryNum = Number(expiry);

      // RATE: 1 point = 1 Hbird
      const amountTokens = (pointsNum * 1).toString(); // string like '100' for 100 Hbird
      const tokenAmount = ethers.utils.parseUnits(amountTokens, 18); // in wei

      if (!player || !ethers.utils.isAddress(player)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid player address' }));
      }
      if (!ethers.utils.isAddress(contractAddress)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid contract address' }));
      }
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

      // signer key from env or fallback (dev only)
      let signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
      if (!signerPrivateKey) {
        // development fallback key (don't use on mainnet, rotate & store securely)
        signerPrivateKey = '0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0';
      }
      const wallet = new ethers.Wallet(signerPrivateKey);

      // Build payload exactly as contract expects:
      // keccak256(abi.encodePacked(player, points, tokenAmount, nonce, expiry, address(this)))
      const payloadHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
          [player, pointsNum, tokenAmount, nonceNum, expiryNum, contractAddress]
        )
      );

      // Sign the raw payloadHash bytes. Wallet.signMessage(arrayify(payloadHash))
      // creates the "\x19Ethereum Signed Message:\n32" prefix internally,
      // which matches the contract's toEthSignedMessageHash.
      const signature = await wallet.signMessage(ethers.utils.arrayify(payloadHash));
      const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), signature);

      const out = {
        player,
        points: pointsNum.toString(),
        amountTokens: amountTokens,                  // human readable token amount (Hbird)
        amountWei: tokenAmount.toString(),           // amount in wei (BigNumber -> string)
        nonce: nonceNum.toString(),
        expiry: expiryNum.toString(),
        contractAddress,
        signerAddress: wallet.address,
        signature,
        recoveredSigner: recovered,
        success: recovered.toLowerCase() === wallet.address.toLowerCase()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(out));
    } catch (err) {
      console.error('sign handler error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Internal server error', details: err?.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
};