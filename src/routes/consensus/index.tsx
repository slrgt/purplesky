/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Consensus Page – Polis-like Collaborative Decision Making
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Features:
 *  - Submit statements for group discussion
 *  - Vote agree/disagree/pass on each statement
 *  - Real-time consensus visualization (agreement bars, heatmaps)
 *  - Opinion cluster detection via WASM
 *  - Polls and surveys
 *  - Integration with forums (consensus topics link to forum threads)
 *  - Microcosm constellation cross-references
 *
 * HOW THIS WORKS (Polis-like):
 *  1. A topic is created with an initial set of statements
 *  2. Users vote agree/disagree/pass on each statement
 *  3. WASM analyzes votes to find opinion clusters and consensus
 *  4. Visualization shows which statements have broad agreement
 *
 * HOW TO EDIT:
 *  - To change the voting UI, edit the statement card section
 *  - To change how consensus is calculated, edit wasm/src/lib.rs
 *  - To add new visualization types, add components below
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { useAppState } from '~/context/app-context';
import type { ConsensusResult } from '~/lib/types';

export default component$(() => {
  const app = useAppState();

  // Example statements for demo
  const statements = useStore<Array<{ id: string; text: string; myVote: -1 | 0 | 1 | null }>>([
    { id: '1', text: 'Forums should support markdown formatting', myVote: null },
    { id: '2', text: 'Real-time collaboration features are more important than async tools', myVote: null },
    { id: '3', text: 'The app should prioritize mobile experience over desktop', myVote: null },
    { id: '4', text: 'Blender and Godot workflows should have dedicated UI sections', myVote: null },
    { id: '5', text: 'AI-powered content moderation would improve the community', myVote: null },
  ]);

  const newStatement = useSignal('');
  const result = useSignal<ConsensusResult | null>(null);
  const analyzing = useSignal(false);

  // Analyze consensus whenever votes change
  const analyze = $(async () => {
    analyzing.value = true;
    const votes = statements
      .filter((s) => s.myVote !== null)
      .map((s) => ({
        user_id: app.session.did ?? 'anonymous',
        statement_id: s.id,
        value: s.myVote as number,
      }));

    if (votes.length === 0) { analyzing.value = false; return; }

    try {
      const { analyzeConsensus } = await import('~/lib/wasm-bridge');
      result.value = await analyzeConsensus(votes);
    } catch (err) {
      console.error('Consensus analysis failed:', err);
    }
    analyzing.value = false;
  });

  const vote = $((statementId: string, value: -1 | 0 | 1) => {
    const stmt = statements.find((s) => s.id === statementId);
    if (stmt) {
      stmt.myVote = stmt.myVote === value ? null : value;
      analyze();
    }
  });

  const addStatement = $(() => {
    if (!newStatement.value.trim()) return;
    statements.push({
      id: `${Date.now()}`,
      text: newStatement.value.trim(),
      myVote: null,
    });
    newStatement.value = '';
  });

  // Get consensus data for a statement
  const getStatementResult = (id: string) => {
    return result.value?.statements.find((s) => s.statementId === id);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: '700', marginBottom: 'var(--space-sm)' }}>
        Consensus
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-xl)' }}>
        Vote on statements to find where the community agrees. Powered by WASM consensus analysis.
      </p>

      {/* Statement Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {statements.map((stmt) => {
          const sr = getStatementResult(stmt.id);
          return (
            <div key={stmt.id} class="glass" style={{ padding: 'var(--space-md)' }}>
              <p style={{ marginBottom: 'var(--space-md)', lineHeight: '1.5' }}>{stmt.text}</p>

              {/* Vote buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: sr ? 'var(--space-sm)' : '0' }}>
                <button
                  class={stmt.myVote === 1 ? 'btn' : 'btn-ghost'}
                  style={{ fontSize: 'var(--font-sm)', padding: '6px 16px', background: stmt.myVote === 1 ? 'var(--success)' : undefined }}
                  onClick$={() => vote(stmt.id, 1)}
                >
                  Agree
                </button>
                <button
                  class={stmt.myVote === -1 ? 'btn' : 'btn-ghost'}
                  style={{ fontSize: 'var(--font-sm)', padding: '6px 16px', background: stmt.myVote === -1 ? 'var(--error)' : undefined, color: stmt.myVote === -1 ? '#fff' : undefined }}
                  onClick$={() => vote(stmt.id, -1)}
                >
                  Disagree
                </button>
                <button
                  class={stmt.myVote === 0 ? 'btn' : 'btn-ghost'}
                  style={{ fontSize: 'var(--font-sm)', padding: '6px 16px', opacity: stmt.myVote === 0 ? 1 : 0.6 }}
                  onClick$={() => vote(stmt.id, 0)}
                >
                  Pass
                </button>
              </div>

              {/* Consensus bar (if results available) */}
              {sr && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--muted)', marginBottom: '4px' }}>
                    <span>{Math.round(sr.agreementRatio * 100)}% agree</span>
                    <span>Divisiveness: {Math.round(sr.divisiveness * 100)}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${sr.agreementRatio * 100}%`,
                      background: sr.agreementRatio > 0.66 ? 'var(--success)' : sr.agreementRatio > 0.33 ? 'var(--warning)' : 'var(--error)',
                      borderRadius: '3px', transition: 'width var(--transition-normal)',
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Statement */}
      <div class="glass-strong" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Add a Statement</h3>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <input
            type="text"
            placeholder="What should the community decide on?"
            value={newStatement.value}
            onInput$={(_, el) => { newStatement.value = el.value; }}
            style={{ flex: 1 }}
          />
          <button class="btn" onClick$={addStatement}>Add</button>
        </div>
      </div>

      {/* Cluster Visualization */}
      {result.value && result.value.clusterCount > 0 && (
        <div class="glass" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Opinion Clusters</h3>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-md)' }}>
            {result.value.totalParticipants} participant{result.value.totalParticipants !== 1 ? 's' : ''} ·{' '}
            {result.value.clusterCount} opinion group{result.value.clusterCount !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            {result.value.clusters.map((cluster) => (
              <div key={cluster.id} class="glass" style={{ padding: 'var(--space-md)', flex: '1 1 200px' }}>
                <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
                  Group {cluster.id + 1}
                </h4>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)' }}>
                  {cluster.memberCount} member{cluster.memberCount !== 1 ? 's' : ''} ·{' '}
                  Avg agreement: {Math.round(cluster.avgAgreement * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
