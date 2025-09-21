const { ethers } = require("ethers");

module.exports = async (req, res) => {
  // ====== CORS ======
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end(); // ✅ handle preflight
  }

  try {
    const q = req.query || {};
    const player = q.player;
    const points = q.points ?? "100";
    const amountTokens = q.amountTokens ?? "1"; // dalam token unit (nanti parse ke 18 decimals)
    const nonce = q.nonce ?? "0";
    const expiry = q.expiry ?? Math.floor(Date.now() / 1000) + 86400; // default 1 hari
    const contractAddress = q.contractAddress;

    // ====== Validasi ======
    if (!player || !ethers.utils.isAddress(player)) {
      return res.status(400).json({ error: "Invalid player address" });
    }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
      return res.status(400).json({ error: "Invalid contract address" });
    }

    const pointsNum = ethers.BigNumber.from(points.toString());
    const nonceNum = ethers.BigNumber.from(nonce.toString());
    const expiryNum = ethers.BigNumber.from(expiry.toString());
    const tokenAmount = ethers.utils.parseUnits(amountTokens.toString(), 18); // ke wei

    // ====== Ambil signer key ======
    let signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      console.warn("⚠️ SIGNER_PRIVATE_KEY not set in env, using fallback test key!");
      signerPrivateKey = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0"; // fallback test key
    }
    const wallet = new ethers.Wallet(signerPrivateKey);

    // ====== Buat payload hash (harus sama persis kaya kontrak) ======
    const payloadHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "uint256", "uint256", "address"],
        [player, pointsNum, tokenAmount, nonceNum, expiryNum, contractAddress]
      )
    );

    // ====== Sign (ethers signMessage otomatis kasih prefix) ======
    const signature = await wallet.signMessage(ethers.utils.arrayify(payloadHash));

    // Verify signer buat debug
    const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), signature);

    // ====== Output voucher ======
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
      success: recovered.toLowerCase() === wallet.address.toLowerCase(),
    };

    return res.status(200).json(out);
  } catch (err) {
    console.error("❌ sign error", err);
    return res.status(500).json({ error: String(err) });
  }
};