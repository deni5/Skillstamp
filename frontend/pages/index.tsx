import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../lib/api';

const DAO_LEVELS = ['Explorer', 'Learner', 'Practitioner', 'Contributor', 'Validator', 'Master'];

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, loginWithWallet, logout } = useAuth();
  const [walletInput, setWalletInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (!user.onboardingCompleted) {
        // show onboarding
      }
    }
  }, [isAuthenticated, user]);

  const handleLogin = async () => {
    if (!walletInput.trim()) {
      setError('Enter wallet address');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await loginWithWallet(walletInput.trim());
    } catch (e: any) {
      setError(e.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Skillstamp — Verify · Earn · Grow</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet" />
      </Head>

      <main style={{ minHeight: '100vh', background: '#F5F2EC' }}>
        {/* NAV */}
        <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E0DDD6' }}>
          <span style={{ fontFamily: 'DM Serif Display', fontSize: 22 }}>Skillstamp</span>
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#8A8680', fontFamily: 'DM Mono' }}>
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </span>
              <span style={{ fontSize: 12, background: '#1A1A1A', color: '#F5F2EC', padding: '4px 10px', borderRadius: 20 }}>
                {DAO_LEVELS[user.daoLevel]}
              </span>
              <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', border: '1px solid #1A1A1A', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                Dashboard
              </button>
              <button onClick={logout} style={{ padding: '8px 16px', background: '#1A1A1A', color: '#F5F2EC', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '8px 20px', background: '#1A1A1A', color: '#F5F2EC', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              Connect Wallet
            </button>
          )}
        </nav>

        {/* HERO */}
        <section style={{ maxWidth: 900, margin: '80px auto', padding: '0 40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: 12, letterSpacing: 2, marginBottom: 20, color: '#8A8680' }}>
            EDTECH × WEB3 · SOLANA
          </div>
          <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 72, lineHeight: 1.1, marginBottom: 24 }}>
            Your skills,<br />verified on-chain.
          </h1>
          <p style={{ fontSize: 18, color: '#8A8680', maxWidth: 500, margin: '0 auto 48px', lineHeight: 1.6 }}>
            Complete challenges. Earn Soul Bound Tokens. Get hired by Web3 companies.
          </p>

          {/* STATS */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginBottom: 64 }}>
            {[['7', 'Learning Tracks'], ['3', 'Smart Contracts'], ['∞', 'Skill Stamps']].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 40 }}>{val}</div>
                <div style={{ fontSize: 13, color: '#8A8680' }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* LOGIN / DASHBOARD CTA */}
        <section id="login-section" style={{ maxWidth: 480, margin: '0 auto 80px', padding: '0 40px' }}>
          {isAuthenticated && user ? (
            <div style={{ border: '1px dashed #1A1A1A', padding: 32, textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 24, marginBottom: 8 }}>
                Welcome back
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 13, color: '#8A8680', marginBottom: 24 }}>
                {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ border: '1px solid #E0DDD6', padding: 16 }}>
                  <div style={{ fontSize: 24, fontFamily: 'DM Serif Display' }}>{user.reputationScore}</div>
                  <div style={{ fontSize: 12, color: '#8A8680' }}>Reputation</div>
                </div>
                <div style={{ border: '1px solid #E0DDD6', padding: 16 }}>
                  <div style={{ fontSize: 24, fontFamily: 'DM Serif Display' }}>{DAO_LEVELS[user.daoLevel]}</div>
                  <div style={{ fontSize: 12, color: '#8A8680' }}>DAO Level</div>
                </div>
              </div>
              <button onClick={() => router.push('/dashboard')}
                style={{ width: '100%', padding: '14px', background: '#1A1A1A', color: '#F5F2EC', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans' }}>
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <div style={{ border: '1px dashed #1A1A1A', padding: 32 }}>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, marginBottom: 8 }}>Start Learning</div>
              <div style={{ fontSize: 13, color: '#8A8680', marginBottom: 24 }}>Enter your Solana wallet address to begin</div>
              <input
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Your Solana wallet address..."
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #E0DDD6', background: 'transparent', fontFamily: 'DM Mono', fontSize: 12, marginBottom: 12, outline: 'none' }}
              />
              {error && <div style={{ color: 'red', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button
                onClick={handleLogin}
                disabled={isLoading}
                style={{ width: '100%', padding: '14px', background: isLoading ? '#8A8680' : '#1A1A1A', color: '#F5F2EC', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                {isLoading ? 'Connecting...' : 'Connect & Start →'}
              </button>
              <div style={{ fontSize: 11, color: '#8A8680', marginTop: 12, textAlign: 'center' }}>
                No signature required in MVP · Privy wallet coming soon
              </div>
            </div>
          )}
        </section>

        {/* TRACKS */}
        <section style={{ maxWidth: 900, margin: '0 auto 80px', padding: '0 40px' }}>
          <h2 style={{ fontFamily: 'DM Serif Display', fontSize: 36, marginBottom: 32 }}>Learning Tracks</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { title: 'Web3 Finance & Tokenomics', tags: ['defi', 'tokenomics'], emoji: '₿' },
              { title: 'Blockchain Dev (Solana)', tags: ['solana', 'rust', 'anchor'], emoji: '⚙️' },
              { title: 'Web3 Research', tags: ['research', 'on-chain'], emoji: '🔬' },
              { title: 'On-chain Analytics', tags: ['dune', 'analytics'], emoji: '📊' },
              { title: 'DAO & Governance', tags: ['dao', 'governance'], emoji: '🗳️' },
              { title: 'Web3 Legal', tags: ['legal', 'compliance'], emoji: '⚖️' },
              { title: 'Web3 Marketing', tags: ['marketing', 'community'], emoji: '📣' },
            ].map(track => (
              <div key={track.title} style={{ border: '1px solid #E0DDD6', padding: 20, background: 'white' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{track.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{track.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {track.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', border: '1px solid #E0DDD6', color: '#8A8680' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ borderTop: '1px solid #E0DDD6', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', color: '#8A8680', fontSize: 12 }}>
          <span style={{ fontFamily: 'DM Mono' }}>Skillstamp Protocol · Solana Devnet</span>
          <span>Borys Grinchenko KMU × DeFiLab</span>
        </footer>
      </main>
    </>
  );
}
