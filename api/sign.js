// sign.js (Vercel Serverless Function)
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    // Ambil parameter dari query
    const { player, points, nonce, contractAddress } = req.query;

    if (!player || !points || !nonce || !contractAddress) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    // Pakai private key test (JANGAN pakai di production!)
    const PRIVATE_KEY = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0";
    const wallet = new ethers.Wallet(PRIVATE_KEY);

    // Expiry 24 jam ke depan
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    // Convert points ke token 1:1 dengan 18 desimal
    const amountWei = ethers.utils.parseUnits(points.toString(), 18);

    // Buat message hash
    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256", "uint256", "uint256", "address"],
      [player, points, amountWei, nonce, expiry, contractAddress]
    );

    // Arrayify sebelum sign
    const arrayHash = ethers.utils.arrayify(messageHash);

    // Sign message
    const signature = await wallet.signMessage(arrayHash);

    // Cek siapa signer hasil recover
    const recoveredSigner = ethers.utils.verifyMessage(arrayHash, signature);

    return res.status(200).json({
      player,
      points,
      amountTokens: points,
      amountWei: amountWei.toString(),
      nonce,
      expiry,
      contractAddress,
      signerAddress: wallet.address,
      signature,
      recoveredSigner,
      success: recoveredSigner.toLowerCase() === wallet.address.toLowerCase(),
    });
  } catch (err) {
    console.error("sign.js error", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}