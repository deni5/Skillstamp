import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { challengesApi, sbtsApi, recommendationsApi } from '../lib/api';

const DAO_LEVELS = ['Explorer', 'Learner', 'Practitioner', 'Contributor', 'Validator', 'Master'];
const DAO_XP = [0, 50, 200, 500, 1000, 2000];

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('challenges');

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated]);

  const { data: completions = [] } = useQuery({
    queryKey: ['completions'],
    queryFn: challengesApi.getMyCompletions,
    enabled: isAuthenticated,
  });

  const { data: sbts = [] } = useQuery({
    queryKey: ['sbts', user?.walletAddress],
    queryFn: () => sbtsApi.getStudentSbts(user!.walletAddress),
    enabled: !!user?.walletAddress,
  });

  const { data: learningPath } = useQuery({
    queryKey: ['learning-path'],
    queryFn: recommendationsApi.getLearningPath,
    enabled: isAuthenticated,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => challengesApi.getAll(),
    enabled: isAuthenticated,
  });

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#F5F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: 13 }}>Loading...</div>
    </div>
  );

  const currentXp = user.reputationScore;
  const nextLevelXp = DAO_XP[Math.min(user.daoLevel + 1, 5)];
  const currentLevelXp = DAO_XP[user.daoLevel];
  const progress = nextLevelXp > currentLevelXp
    ? Math.round(((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100)
    : 100;

  const fonts = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap';

  return (
    <div>
      <Head>
        <title>Dashboard - Skillstamp</title>
        <link href={fonts} rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#F5F2EC' }}>
        <nav style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E0DDD6', background: 'white' }}>
          <span style={{ fontFamily: 'DM Serif Display', fontSize: 20, cursor: 'pointer' }} onClick={() => router.push('/')}>Skillstamp</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#8A8680' }}>
              {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
            </span>
            <span style={{ fontSize: 11, background: '#1A1A1A', color: '#F5F2EC', padding: '3px 10px', borderRadius: 20 }}>
              {DAO_LEVELS[user.daoLevel]}
            </span>
            <button onClick={logout} style={{ fontSize: 12, background: 'none', border: '1px solid #E0DDD6', padding: '6px 12px', cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Reputation', value: user.reputationScore },
              { label: 'DAO Level', value: DAO_LEVELS[user.daoLevel] },
              { label: 'Stamps Earned', value: sbts.length },
              { label: 'Completed', value: completions.filter((c: any) => c.status === 'verified').length },
            ].map(stat => (
              <div key={stat.label} style={{ border: '1px solid #E0DDD6', padding: '20px 24px', background: 'white' }}>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 32, marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#8A8680' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid #E0DDD6', padding: 20, background: 'white', marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span>{DAO_LEVELS[user.daoLevel]}</span>
              <span style={{ color: '#8A8680', fontFamily: 'DM Mono', fontSize: 12 }}>{currentXp} / {nextLevelXp} XP</span>
              <span>{DAO_LEVELS[Math.min(user.daoLevel + 1, 5)]}</span>
            </div>
            <div style={{ height: 6, background: '#E0DDD6', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#1A1A1A', borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #E0DDD6' }}>
            {[['challenges', 'Challenges'], ['sbts', 'My Stamps'], ['path', 'Learning Path']].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #1A1A1A' : '2px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400, marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'challenges' && (
            <div>
              {challenges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#8A8680' }}>
                  <div style={{ fontFamily: 'DM Serif Display', fontSize: 24, marginBottom: 8 }}>No challenges yet</div>
                  <div style={{ fontSize: 14 }}>Add seed data to see challenges here</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {challenges.map((ch: any) => (
                    <div key={ch.id} style={{ border: '1px solid #E0DDD6', padding: '20px 24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{ch.title}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {ch.skillTags?.map((tag: string) => (
                            <span key={tag} style={{ fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', border: '1px solid #E0DDD6', color: '#8A8680' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#8A8680' }}>L{ch.difficulty}</span>
                        <button style={{ padding: '8px 16px', background: '#1A1A1A', color: '#F5F2EC', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          Start
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sbts' && (
            <div>
              {sbts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#8A8680' }}>
                  <div style={{ fontFamily: 'DM Serif Display', fontSize: 24, marginBottom: 8 }}>No stamps yet</div>
                  <div style={{ fontSize: 14 }}>Complete challenges to earn Soul Bound Tokens</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {sbts.map((sbt: any) => (
                    <div key={sbt.id} style={{ border: '1px solid #E0DDD6', padding: 24, background: 'white' }}>
                      <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, marginBottom: 8 }}>{sbt.title}</div>
                      <div style={{ fontSize: 12, color: '#8A8680', marginBottom: 12 }}>Score: {sbt.score}/100</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {sbt.skillTags?.map((tag: string) => (
                          <span key={tag} style={{ fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', border: '1px solid #E0DDD6' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'path' && (
            <div>
              {!learningPath ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#8A8680' }}>
                  <div style={{ fontSize: 14 }}>Loading path...</div>
                </div>
              ) : (
                <div>
                  <div style={{ border: '1px solid #E0DDD6', padding: 24, background: 'white', marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: 'DM Serif Display', fontSize: 24 }}>
                          {(learningPath.targetRole || 'web3_analyst').replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 13, color: '#8A8680' }}>Your learning path</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'DM Serif Display', fontSize: 32 }}>{learningPath.progress}%</div>
                        <div style={{ fontSize: 12, color: '#8A8680' }}>{learningPath.completed}/{learningPath.totalSteps} steps</div>
                      </div>
                    </div>
                    <div style={{ height: 8, background: '#E0DDD6', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${learningPath.progress}%`, background: '#1A1A1A', borderRadius: 4 }} />
                    </div>
                  </div>

                  {learningPath.nextChallenge && (
                    <div style={{ border: '1px dashed #1A1A1A', padding: 24, background: 'white' }}>
                      <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#8A8680', marginBottom: 8 }}>NEXT STEP</div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{learningPath.nextChallenge.title}</div>
                      <div style={{ fontSize: 13, color: '#8A8680' }}>{learningPath.nextChallenge.description}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
