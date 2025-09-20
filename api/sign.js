import { ethers } from "ethers";

// 🔑 PK test wallet (punya kamu, hanya untuk dev/test)
const PRIVATE_KEY = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0";
const SIGNER = new ethers.Wallet(PRIVATE_KEY);

// ✨ CORS middleware
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // ✅ preflight CORS
  }

  try {
    const { player, points, nonce = "0", contractAddress } = req.query;

    if (!player || !points || !contractAddress) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // 💰 Convert points -> token
    const amountTokens = points.toString();
    const amountWei = ethers.utils.parseUnits(amountTokens, 18).toString();

    // Expiry = 30 menit dari sekarang
    const expiry = Math.floor(Date.now() / 1000) + 1800;

    // Buat hash voucher
    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256", "uint256", "address"],
      [player, amountWei, nonce, expiry, contractAddress]
    );

    const messageHashBinary = ethers.utils.arrayify(messageHash);

    // ✍️ Tanda tangan voucher
    const signature = await SIGNER.signMessage(messageHashBinary);

    // Recovered signer (debug)
    const recoveredSigner = ethers.utils.verifyMessage(messageHashBinary, signature);

    return res.status(200).json({
      player,
      points,
      amountTokens,
      amountWei,
      nonce,
      expiry,
      contractAddress,
      signerAddress: SIGNER.address,
      signature,
      recoveredSigner,
      success: recoveredSigner.toLowerCase() === SIGNER.address.toLowerCase(),
    });
  } catch (err) {
    console.error("Error signing voucher:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}