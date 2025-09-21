// /api/sign.js
import { ethers } from "ethers";

export default async function handler(req, res) {
  // CORS (biar gampang diakses dari game frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const q = req.query || {};
    const player = q.player;
    const amount = q.amount ?? "0"; // jumlah token (dalam HBIRD, bukan Wei)
    const nonce = q.nonce ?? "1";
    const contractAddress = q.contractAddress ?? "0xb9ccd00c2016444f58e2492117b49da317f4899b";

    if (!player || !ethers.utils.isAddress(player)) {
      return res.status(400).json({ success: false, error: "Invalid player address" });
    }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
      return res.status(400).json({ success: false, error: "Invalid contract address" });
    }

    // Ambil PRIVATE KEY operator (server signer)
    let OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
    if (!OPERATOR_PRIVATE_KEY) {
      console.warn("⚠️ OPERATOR_PRIVATE_KEY not set, using fallback TEST key. Jangan dipakai di production!");
      OPERATOR_PRIVATE_KEY = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0";
    }
    const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);

    // Expiry = 1 jam ke depan
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60;

    // Konversi amount → Wei (18 decimals)
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);

    // Buat payload hash sesuai kontrak V4
    // keccak256(abi.encodePacked(player, amount, nonce, expiry, contractAddress))
    const payloadHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256", "uint256", "address"],
      [player, amountWei, nonce, expiry, contractAddress]
    );

    // Sign pakai operator wallet
    const signature = await wallet.signMessage(ethers.utils.arrayify(payloadHash));

    // Verifikasi balik (cek signer benar)
    const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), signature);

    return res.status(200).json({
      success: recovered.toLowerCase() === wallet.address.toLowerCase(),
      player,
      amount: amount.toString(),
      amountWei: amountWei.toString(),
      nonce: nonce.toString(),
      expiry,
      contractAddress,
      signature,
      signerAddress: wallet.address,
      recoveredSigner: recovered
    });

  } catch (err) {
    console.error("sign error", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}