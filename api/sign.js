// sign.js
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    const { player, points, nonce, contractAddress } = req.query;

    if (!player || !points || !nonce || !contractAddress) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    // Operator private key (server signer)
    // ⚠️ hanya untuk testing, jangan taruh private key asli di public repo
    const OPERATOR_PRIVATE_KEY = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0";
    const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);

    // Expiry 24 jam
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    // Points dikonversi ke token amount (1:1, 18 decimals)
    const tokenAmount = ethers.utils.parseUnits(points.toString(), 18);

    // Buat payload hash persis sama dengan kontrak
    const payloadHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256", "uint256", "uint256", "address"],
      [player, points, tokenAmount, nonce, expiry, contractAddress]
    );

    // Hash yang ditandatangani
    const arrayHash = ethers.utils.arrayify(payloadHash);

    // Operator sign
    const signature = await operatorWallet.signMessage(arrayHash);

    // Verifikasi signer untuk debug
    const recovered = ethers.utils.verifyMessage(arrayHash, signature);

    return res.status(200).json({
      player,
      points,
      tokenAmount: tokenAmount.toString(),
      nonce,
      expiry,
      contractAddress,
      signature,
      signerAddress: operatorWallet.address,
      recovered,
      success: recovered.toLowerCase() === operatorWallet.address.toLowerCase()
    });
  } catch (err) {
    console.error("sign.js error", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}