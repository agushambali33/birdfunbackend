// api/sign.js
const { ethers } = require('ethers');

module.exports = async (req, res) => {
  // allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // read params from query (GET)
    const q = req.query || {};
    const player = q.player;
    const points = q.points ?? "100";
    const amountTokens = q.amountTokens ?? "1"; // token units (not wei) - we'll parse to 18 decimals
    const nonce = q.nonce ?? "0";
    const expiry = q.expiry ?? Math.floor(Date.now() / 1000) + 86400;
    const contractAddress = q.contractAddress;

    if (!player || !ethers.utils.isAddress(player)) {
      return res.status(400).json({ error: "Invalid player address" });
    }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
      return res.status(400).json({ error: "Invalid contractAddress" });
    }

    const pointsNum = ethers.BigNumber.from(points.toString());
    const nonceNum = ethers.BigNumber.from(nonce.toString());
    const expiryNum = ethers.BigNumber.from(expiry.toString());
    // parse amountTokens as decimal token count -> convert to wei (18 decimals)
    const tokenAmount = ethers.utils.parseUnits(amountTokens.toString(), 18); // BigNumber

    // signer private key from env
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      return res.status(500).json({ error: "SIGNER_PRIVATE_KEY not set in env" });
    }
    const wallet = new ethers.Wallet(signerPrivateKey);

    // compute payload hash exactly like contract:
    // keccak256(abi.encodePacked(player, points, tokenAmount, nonce, expiry, address(this)))
    const payloadHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [player, pointsNum, tokenAmount, nonceNum, expiryNum, contractAddress]
      )
    );

    // SIGNING:
    // signMessage(arrayify(payloadHash)) -> ethers will prefix "\x19Ethereum Signed Message:\n32" and sign keccak256(prefix + payloadHash)
    const signature = await wallet.signMessage(ethers.utils.arrayify(payloadHash));

    // verify recovered locally
    const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), signature);

    const out = {
      player,
      points: pointsNum.toString(),
      amountTokens: amountTokens.toString(),
      amountWei: tokenAmount.toString(),
      nonce: nonceNum.toString(),
      expiry: expiryNum.toString(),
      contractAddress,
      signerAddress: wallet.address,
      signature,
      recoveredSigner: recovered,
      success: recovered.toLowerCase() === wallet.address.toLowerCase()
    };

    return res.status(200).json(out);
  } catch (err) {
    console.error("sign error", err);
    return res.status(500).json({ error: String(err) });
  }
};