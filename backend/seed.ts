import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  synchronize: false,
});

const challenges = [
  {
    title: 'DeFi Protocol Analysis',
    description: 'Analyse the tokenomics of Uniswap v3. Explain fee tiers, liquidity provision mechanics, and impermanent loss. Provide a 500-word report with your own calculations.',
    rubric: 'Score based on: accuracy of mechanics explanation (40%), quality of calculations (30%), practical insights (20%), clarity (10%)',
    skillTags: ['defi', 'tokenomics', 'research'],
    difficulty: 2,
    verificationType: 'llm',
    sbtRewardTitle: 'DeFi Analyst',
    trackId: 'web3_finance',
    moduleNumber: '1',
    minDaoLevel: 0,
  },
  {
    title: 'Solana Account Model',
    description: 'Explain the Solana account model. What is the difference between a program account and a data account? Write a simple Anchor program that stores a counter on-chain.',
    rubric: 'Score based on: conceptual accuracy (40%), code correctness (40%), explanation quality (20%)',
    skillTags: ['solana', 'anchor', 'smart-contract'],
    difficulty: 3,
    verificationType: 'llm',
    sbtRewardTitle: 'Solana Developer',
    trackId: 'blockchain_dev',
    moduleNumber: '1',
    minDaoLevel: 0,
  },
  {
    title: 'DAO Governance Research',
    description: 'Research MakerDAO governance. How are votes weighted? What is the quorum requirement? Describe a recent governance proposal and its outcome.',
    rubric: 'Score based on: factual accuracy (50%), depth of analysis (30%), original insights (20%)',
    skillTags: ['dao', 'governance', 'research'],
    difficulty: 2,
    verificationType: 'llm',
    sbtRewardTitle: 'DAO Researcher',
    trackId: 'dao_governance',
    moduleNumber: '1',
    minDaoLevel: 0,
  },
  {
    title: 'On-chain Analytics with Dune',
    description: 'Write a Dune Analytics SQL query that shows the top 10 wallets by trading volume on Uniswap v3 in the last 30 days. Explain your query logic.',
    rubric: 'Score based on: query correctness (50%), explanation quality (30%), insights from results (20%)',
    skillTags: ['dune', 'analytics', 'on-chain', 'defi'],
    difficulty: 3,
    verificationType: 'peer',
    sbtRewardTitle: 'On-chain Analyst',
    trackId: 'data_analytics',
    moduleNumber: '1',
    minDaoLevel: 1,
  },
  {
    title: 'Tokenomics Design',
    description: 'Design a tokenomics model for a hypothetical Web3 education platform. Include: supply schedule, distribution breakdown, utility mechanisms, and anti-inflation measures.',
    rubric: 'Score based on: economic soundness (40%), creativity (30%), completeness (20%), presentation (10%)',
    skillTags: ['tokenomics', 'research', 'defi'],
    difficulty: 4,
    verificationType: 'peer',
    sbtRewardTitle: 'Tokenomics Designer',
    trackId: 'web3_finance',
    moduleNumber: '2',
    minDaoLevel: 1,
  },
  {
    title: 'Web3 Legal Basics',
    description: 'What is the Howey Test and how does it apply to token offerings? Analyse whether a hypothetical governance token would be classified as a security under US law.',
    rubric: 'Score based on: legal accuracy (50%), application to case (30%), clarity (20%)',
    skillTags: ['legal', 'compliance', 'tokenomics'],
    difficulty: 2,
    verificationType: 'llm',
    sbtRewardTitle: 'Web3 Legal Analyst',
    trackId: 'web3_legal',
    moduleNumber: '1',
    minDaoLevel: 0,
  },
  {
    title: 'Community Growth Strategy',
    description: 'Create a 90-day community growth strategy for a new Solana DeFi protocol. Include: channels, content calendar, KPIs, and engagement mechanics.',
    rubric: 'Score based on: strategy quality (40%), practicality (30%), KPI definition (20%), creativity (10%)',
    skillTags: ['marketing', 'community', 'growth'],
    difficulty: 2,
    verificationType: 'llm',
    sbtRewardTitle: 'Web3 Marketer',
    trackId: 'web3_marketing',
    moduleNumber: '1',
    minDaoLevel: 0,
  },
  {
    title: 'Solana vs EVM Comparison',
    description: 'Write a technical comparison of Solana and EVM-based blockchains. Cover: consensus mechanisms, transaction throughput, programming model, and ecosystem maturity.',
    rubric: 'Score based on: technical accuracy (50%), depth (30%), balanced analysis (20%)',
    skillTags: ['solana', 'research', 'on-chain'],
    difficulty: 3,
    verificationType: 'llm',
    sbtRewardTitle: 'Blockchain Researcher',
    trackId: 'blockchain_dev',
    moduleNumber: '2',
    minDaoLevel: 1,
  },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to DB');

  const repo = AppDataSource.getRepository('Challenge');

  for (const ch of challenges) {
    const existing = await repo.findOne({ where: { title: ch.title } });
    if (existing) {
      console.log(`Skip (exists): ${ch.title}`);
      continue;
    }
    const entity = repo.create({ ...ch, active: true });
    await repo.save(entity);
    console.log(`Created: ${ch.title}`);
  }

  console.log('\nSeed complete!');
  await AppDataSource.destroy();
}

seed().catch(console.error);
