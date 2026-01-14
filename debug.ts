import { Connection, PublicKey } from '@solana/web3.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  const proposalPubkey = new PublicKey('6cdhy4j6CAAJjE1z2iQDsFda2BrqJkhtHrRWT9QasSoa');
  const proposalInfo = await connection.getAccountInfo(proposalPubkey);

  if (!proposalInfo) {
    console.log('Proposal not found');
    return;
  }

  const data = proposalInfo.data;
  let offset = 8;

  const number = data.readUInt32LE(offset);
  offset += 4;
  offset += 32; // proposer
  offset += 8; // timestamp

  const stateVariant = data.readUInt8(offset);
  offset += 1;
  if (stateVariant === 0) offset += 8;

  offset += 32; // baseVault
  offset += 32; // quoteVault
  offset += 32; // dao
  offset += 1; // pdaBump
  offset += 32; // question
  offset += 4; // duration
  offset += 32; // squadsProposal

  const passBaseMint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const passQuoteMint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const failBaseMint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const failQuoteMint = new PublicKey(data.subarray(offset, offset + 32));

  console.log('=== Proposal #' + number + ' ===');
  console.log('State:', ['Draft', 'Pending', 'Passed', 'Failed'][stateVariant]);
  console.log('Pass base mint:', passBaseMint.toBase58());
  console.log('Pass quote mint:', passQuoteMint.toBase58());
  console.log('Fail base mint:', failBaseMint.toBase58());
  console.log('Fail quote mint:', failQuoteMint.toBase58());

  // Get token supply info
  await sleep(1000);
  console.log('\n=== Token Supply Info ===');

  try {
    const passBaseSupply = await connection.getTokenSupply(passBaseMint);
    console.log('Pass base supply:', passBaseSupply.value.uiAmountString);

    await sleep(1000);
    const failBaseSupply = await connection.getTokenSupply(failBaseMint);
    console.log('Fail base supply:', failBaseSupply.value.uiAmountString);

    await sleep(1000);
    const passQuoteSupply = await connection.getTokenSupply(passQuoteMint);
    console.log('Pass quote supply:', passQuoteSupply.value.uiAmountString);

    await sleep(1000);
    const failQuoteSupply = await connection.getTokenSupply(failQuoteMint);
    console.log('Fail quote supply:', failQuoteSupply.value.uiAmountString);
  } catch (e) {
    console.log('Error:', e);
  }

  // Try to find AMM by searching program accounts
  // dAMM v2 program: AMMxmwdLTM6b1fFgYK9A5tqk8EhQ8FmFFi6J2WcPJwvT (common)
  // Or search by MetaDAO's AMM program

  console.log('\n=== Searching for AMM Program Accounts ===');

  // Let's check the futarchy program (owner of proposal) for related accounts
  const futarchyProgram = proposalInfo.owner;
  console.log('Futarchy program:', futarchyProgram.toBase58());
}

main().catch(console.error);
