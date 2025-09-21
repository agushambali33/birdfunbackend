// /api/sign.js
import { ethers } from "ethers";

export default async function handler(req, res) {
  // CORS (allow from anywhere for testing)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const q = req.query || {};
    const player = q.player;
    const points = q.points ?? "100";
    const nonce = q.nonce ?? "0";
    const contractAddress = q.contractAddress;

    if (!player || !ethers.utils.isAddress(player)) {
      return res.status(400).json({ success: false, error: "Invalid player address" });
    }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
      return res.status(400).json({ success: false, error: "Invalid contract address" });
    }

    // OPERATOR private key (server signer)
    let OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
    if (!OPERATOR_PRIVATE_KEY) {
      console.warn("⚠️ OPERATOR_PRIVATE_KEY not set, using fallback TEST key. Don't use in production.");
      OPERATOR_PRIVATE_KEY = "0xdb308d012d8f24ae617092ac27477d509574441d3bfe3b53a1870233b98c7ef0";
    }
    const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);

    // expiry 24 hours ahead
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    // 1 point = 1 token (18 decimals)
    // points might be string; convert to BigNumber then * 10^18
    const pointsBN = ethers.BigNumber.from(points.toString());
    const tokenAmount = pointsBN.mul(ethers.BigNumber.from("1000000000000000000")); // 1e18

    // Build payload hash exactly as contract: keccak256(abi.encodePacked(player, points, tokenAmount, nonce, expiry, contractAddress))
    const payloadHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "uint256", "uint256", "address"],
        [player, pointsBN, tokenAmount, ethers.BigNumber.from(nonce.toString()), ethers.BigNumber.from(expiry.toString()), contractAddress]
      )
    );

    // ethers.signMessage expects arrayified bytes
    const arrayHash = ethers.utils.arrayify(payloadHash);
    const signature = await wallet.signMessage(arrayHash);

    const recovered = ethers.utils.verifyMessage(arrayHash, signature);

    const out = {
      player,
      points: pointsBN.toString(),
      tokenAmount: tokenAmount.toString(), // this is Wei (18 decimals)
      nonce: nonce.toString(),
      expiry,
      contractAddress,
      signature,
      signerAddress: wallet.address,
      recoveredSigner: recovered,
      success: recovered.toLowerCase() === wallet.address.toLowerCase()
    };

    return res.status(200).json(out);
  } catch (err) {
    console.error("sign error", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}