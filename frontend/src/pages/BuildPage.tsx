// ??$$$ group 4 - Build & Firmware Compilation (Phase 3)
// @ts-nocheck
// ??$$$ FORGE: BuildPage.tsx — Stage 3: Milestone Runner & Debug Workspace
// Three-panel: Milestone Sidebar | Code/Simulator Workspace | Test/Debug Coach
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
// ??$$$ old code
// import { useParams, useNavigate } from 'react-router-dom';
// ??$$$ newer code
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/useThemeStore';
import { useProjectStore } from '../store/useProjectStore';
import WokwiSimulator from '../components/WokwiSimulator';
import useIsMobile from '../hooks/useIsMobile';

const Simulator3D = lazy(() => import('../components/Simulator3D'));

export default function BuildPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // ??$$$ newer code
  const [searchParams] = useSearchParams();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const {
    project,
    generateMilestones,
    loadMilestones,
    updateMilestone,
    compileMilestone,
    confirmMilestone,
    failMilestone,
    skipMilestone,
    chatDebugCoach,
    regenerateMilestoneCode,
    reportComponentIssue,
    validateSerial,
    refreshStageStatus
  } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [activeMilestoneId, setActiveMilestoneId] = useState(null);
  const [simView, setSimView] = useState('2d'); // 2d | 3d
  const [centerTab, setCenterTab] = useState('instructions'); // instructions | code | simulator
  const [registry, setRegistry] = useState({});
  const [compilingLocal, setCompilingLocal] = useState(false);
  const [generatingMilestones, setGeneratingMilestones] = useState(false);

  // Milestone local code & debounced save
  const [localCode, setLocalCode] = useState('');
  const saveTimer = useRef(null);

  // Serial validation state
  const [serialInput, setSerialInput] = useState('');
  const [validatingSerial, setValidatingSerial] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Debug Coach chat input state
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState(null);

  // Advisor Modal (Wrong component escape hatch)
  const [advisorModal, setAdvisorModal] = useState({
    open: false,
    componentKey: '',
    problem: '',
    response: '',
    loading: false
  });

  // Skip Modal
  const [skipModal, setSkipModal] = useState({
    open: false,
    milestoneId: '',
    notes: ''
  });

  // ??$$$ old code
  /*
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const view = params.get('view');
    if (tab) setCenterTab(tab);
    if (view) setSimView(view);
  }, []);
  */
  // ??$$$ newer code - parse query parameters using useSearchParams hook to automatically open 3D simulator on redirect
  useEffect(() => {
    const tab = searchParams.get('tab');
    const view = searchParams.get('view');
    if (tab) setCenterTab(tab);
    if (view) setSimView(view);
  }, [searchParams]);

  // Load project & milestones on mount
  useEffect(() => {
    const init = async () => {
      if (!id) return;
      setLoading(true);
      try {
        await loadMilestones(id);
      } catch (err) {
        console.error("Failed to load milestones:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
    axiosInstance.get("/wokwi/registry").then(res => setRegistry(res.data)).catch(console.error);
  }, [id]);

  // Set initial active milestone
  useEffect(() => {
    if (project?.milestones && project.milestones.length > 0) {
      if (project.activeMilestoneId) {
        setActiveMilestoneId(project.activeMilestoneId);
      } else {
        setActiveMilestoneId(project.milestones[0].id);
      }
    }
  }, [project?.activeMilestoneId, project?.milestones]);

  const milestone = project?.milestones?.find(m => m.id === activeMilestoneId) || project?.milestones?.[0];
  // ??$$$ newer code
  const milestoneIndex = project?.milestones ? project.milestones.findIndex(m => m.id === (milestone?.id || activeMilestoneId)) : -1;
  const previousMilestone = milestoneIndex > 0 ? project.milestones[milestoneIndex - 1] : null;
  const isPreviousMilestoneConfirmed = previousMilestone ? (previousMilestone.userConfirmed || previousMilestone.status === 'passed') : true;

  // Sync local code state on milestone change
  useEffect(() => {
    if (milestone) {
      setLocalCode(milestone.code || '');
      setSerialInput(milestone.serialOutput || '');
      setValidationResult(null);
    }
  }, [milestone?.id]);

  // Handle local code editing with auto-save
  const handleCodeChange = (e) => {
    const val = e.target.value;
    setLocalCode(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (milestone) {
        await updateMilestone(id, milestone.id, { code: val });
      }
    }, 1200);
  };

  /* old code
  // Compile milestone code
  const handleCompileMilestone = async () => {
    if (!milestone) return;
    setCompilingLocal(true);
    try {
      // Save code first
      await updateMilestone(id, milestone.id, { code: localCode });
      const result = await compileMilestone(id, milestone.id);
      if (result?.success) {
        toast.success("Compiled successfully!");
      } else {
        toast.error("Compilation failed. Check terminal.");
      }
    } catch (err) {
      toast.error("Compilation request failed.");
    } finally {
      setCompilingLocal(false);
    }
  };
  */
  // ??$$$ newer code - Compile milestone with auto debug coach pre-fill and manual libs validation checks
  const handleCompileMilestone = async () => {
    if (!milestone) return;
    setCompilingLocal(true);
    try {
      // Save code first
      await updateMilestone(id, milestone.id, { code: localCode });
      const result = await compileMilestone(id, milestone.id);
      if (result?.success) {
        toast.success("Compiled successfully!");
      } else {
        toast.error("Compilation failed. Check terminal.");
        const compileErrStr = result?.errors?.join("\n") || "Compilation failed.";
        setChatInput(`I ran into a compilation error:\n${compileErrStr}`);
        toast.success("Error details pre-filled in Debug Coach input! Ask Coach for help.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error;
      if (errMsg === 'manual_libs_required') {
        toast.error("Manual libraries installation required. Please check instructions.");
      } else {
        toast.error(err?.response?.data?.message || "Compilation request failed.");
        const compileErrStr = err?.response?.data?.error || err?.message || "Compilation failed.";
        setChatInput(`I ran into a compilation error:\n${compileErrStr}`);
      }
    } finally {
      setCompilingLocal(false);
    }
  };

  // ??$$$ newer code - handle manual libraries acknowledgement trigger
  const handleAcknowledgeManualLibs = async () => {
    if (!milestone) return;
    try {
      await updateMilestone(id, milestone.id, { manualLibsAcknowledged: true });
      toast.success("Acknowledged manual library installation.");
      // Trigger compile
      handleCompileMilestone();
    } catch (err) {
      toast.error("Failed to acknowledge manual library installation.");
    }
  };

  // Skip milestone
  const handleConfirmSkip = async () => {
    if (!skipModal.milestoneId) return;
    try {
      const res = await skipMilestone(id, skipModal.milestoneId, skipModal.notes);
      toast.success("Milestone skipped.");
      setSkipModal({ open: false, milestoneId: '', notes: '' });
      if (res?.allComplete) {
        toast.success("All milestones completed! Advancing to simulation.");
        navigate(`/project/${id}/simulation`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to skip milestone.");
    }
  };

  // Confirm manual verification
  const handleConfirmMilestone = async () => {
    if (!milestone) return;
    try {
      const res = await confirmMilestone(id, milestone.id, serialInput, "Manually confirmed pass");
      toast.success("Milestone verified and completed!");
      if (res?.allComplete) {
        toast.success("Congratulations! All milestones completed.");
        navigate(`/project/${id}/simulation`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Verification failed. Check dependencies.");
    }
  };

  // Report manual failure
  const handleReportFailure = async () => {
    if (!milestone) return;
    try {
      const res = await failMilestone(id, milestone.id, serialInput, "Serial log did not match expected pattern.");
      toast.error("Milestone marked failed. Debug Coach is active.");
      setCenterTab('instructions');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Fail registration failed.");
    }
  };

  // Validate serial telemetry using AI Agent
  const handleValidateSerial = async () => {
    if (!milestone || !serialInput.trim()) return;
    setValidatingSerial(true);
    setValidationResult(null);
    try {
      const result = await validateSerial(id, milestone.id, serialInput);
      setValidationResult(result);
      if (result?.success) {
        toast.success("AI Validation Passed!");
        // Auto pass on AI success
        const res = await confirmMilestone(id, milestone.id, serialInput, "Validated automatically via AI Serial Validator");
        if (res?.allComplete) {
          navigate(`/project/${id}/simulation`);
        }
      } else {
        toast.error("AI Validation Failed. Check feedback.");
        await failMilestone(id, milestone.id, serialInput, `Validation Failed: ${result?.feedback}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "AI validation failed.");
    } finally {
      setValidatingSerial(false);
    }
  };

  // Chat with Debug Coach
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!milestone || !chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    setChatError(null);
    const msg = chatInput;
    setChatInput('');
    try {
      await chatDebugCoach(id, milestone.id, msg);
    } catch (err: any) {
      setChatError("Failed to send chat. Please try again.");
    } finally {
      setSendingChat(false);
    }
  };

  // Submit Wrong Component escape hatch
  const handleReportComponentIssue = async () => {
    if (!advisorModal.componentKey || !advisorModal.problem.trim()) return;
    setAdvisorModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await reportComponentIssue(id, milestone.id, advisorModal.componentKey, advisorModal.problem);
      setAdvisorModal(prev => ({ ...prev, response: res?.advice || 'No advice received', loading: false }));
    } catch (err) {
      toast.error("Failed to fetch advice.");
      setAdvisorModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRegenerateCode = async () => {
    if (!milestone) return;
    if (!confirm("Are you sure you want to regenerate? This will overwrite your current code edits for this milestone.")) return;
    try {
      await regenerateMilestoneCode(id, milestone.id);
      toast.success("Code regenerated successfully!");
    } catch (err) {
      toast.error("Regeneration failed.");
    }
  };

  // Global Overlay if milestones are not generated yet
  if (!project?.milestonesGenerated || !project?.milestones || project.milestones.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 52px)',
        background: isDark ? '#141414' : '#f5f5f5',
        color: isDark ? '#f1f3f9' : '#1a1a1a',
        padding: '2rem',
        textAlign: 'center',
      }}>
        {generatingMilestones && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: '#fff',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255,255,255,0.1)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '1.25rem',
            }} />
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Generating your build milestones...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div style={{
          background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: '24px',
          padding: '3rem 2rem',
          maxWidth: '480px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}>
          <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1.5rem' }}>🎯</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Milestone-Based Build Runner</h2>
          <p style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.6, marginBottom: '2rem' }}>
            We'll break down your physical project into structured, step-by-step verification milestones customized to your skill level.
          </p>
          <button
            onClick={async () => {
              setGeneratingMilestones(true);
              try {
                await generateMilestones(id);
                toast.success('Milestones generated successfully!');
              } catch (err: any) {
                toast.error(err?.response?.data?.error || 'Milestone generation failed. Please try again.');
              } finally {
                setGeneratingMilestones(false);
              }
            }}
            disabled={generatingMilestones}
            style={{
              padding: '0.875rem 2rem',
              borderRadius: '12px',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            }}
          >
            {generatingMilestones ? 'Generating Milestones...' : 'Start Generating'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: 'calc(100vh - 52px)',
      background: isDark ? '#0d0e12' : '#f8fafc',
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      overflow: 'hidden',
    }}>
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          border-radius: 4px;
        }
        .tab-btn {
          padding: 0.5rem 1rem;
          font-weight: 600;
          font-size: 0.8rem;
          border-bottom: 2px solid transparent;
          color: ${isDark ? '#94a3b8' : '#64748b'};
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
      `}</style>

      {/* ── Panel 1: Milestone Sidebar (25%) ────────────────────────────────── */}
      <div style={{
        width: '25%',
        minWidth: '280px',
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? '#111216' : '#fff',
      }}>
        <div style={{ padding: '1.25rem', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: '#3b82f6', margin: 0 }}>
            Curriculum Runner
          </p>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '4px 0 0' }}>Build Milestones</h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {project.milestones.map((m) => {
            const isActive = m.id === activeMilestoneId;
            const isLocked = m.status === 'locked';
            const isCompleted = m.status === 'passed';
            const isFailed = m.status === 'failed';
            const isReady = m.status === 'ready' || m.status === 'in_progress';

            let statusIcon = '⚪';
            let statusColor = '#64748b';
            if (isLocked) { statusIcon = '🔒'; statusColor = '#475569'; }
            else if (isCompleted) { statusIcon = '✅'; statusColor = '#22c55e'; }
            else if (isFailed) { statusIcon = '❌'; statusColor = '#ef4444'; }
            else if (isReady) { statusIcon = '🔵'; statusColor = '#3b82f6'; }

            return (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMilestoneId(m.id);
                  setCenterTab('instructions');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.875rem 1rem',
                  borderRadius: '12px',
                  background: isActive 
                    ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)')
                    : 'transparent',
                  border: `1px solid ${isActive 
                    ? '#3b82f6' 
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}`,
                  cursor: 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.9rem' }}>{statusIcon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: statusColor }}>
                        Step {m.order}
                      </span>
                      {m.simulatable ? (
                        <span style={{ fontSize: '0.6rem', background: '#3b82f620', color: '#3b82f6', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>SIM</span>
                      ) : (
                        <span style={{ fontSize: '0.6rem', background: '#fb923c20', color: '#ea580c', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>PHYSICAL</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: '4px 0 0', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {m.title}
                    </p>
                    {isLocked && m.dependsOn?.length > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        Requires step {project.milestones.find(dm => dm.id === m.dependsOn[0])?.order || m.dependsOn[0]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel 2: Center Workspace (50%) ────────────────────────────────── */}
      <div style={{
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? '#0d0e12' : '#f8fafc',
      }}>
        {/* Workspace Tab Header */}
        <div style={{
          padding: '0 1rem',
          height: '48px',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isDark ? '#111216' : '#fff',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`tab-btn ${centerTab === 'instructions' ? 'active' : ''}`} onClick={() => setCenterTab('instructions')}>
              📖 Instructions
            </button>
            <button className={`tab-btn ${centerTab === 'code' ? 'active' : ''}`} onClick={() => setCenterTab('code')}>
              📝 Code Editor
            </button>
            {milestone?.simulatable && (
              <button className={`tab-btn ${centerTab === 'simulator' ? 'active' : ''}`} onClick={() => setCenterTab('simulator')}>
                📐 Simulator
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {centerTab === 'simulator' && (
              <button
                onClick={() => setSimView(simView === '2d' ? '3d' : '2d')}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {simView === '2d' ? '🚀 Enter 3D' : '📐 Switch to 2D'}
              </button>
            )}
            <button
              onClick={() => setSkipModal({ open: true, milestoneId: milestone.id, notes: '' })}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                background: 'transparent',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                color: isDark ? '#94a3b8' : '#475569',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⏭ Skip
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', position: 'relative', minHeight: 0 }}>
          {centerTab === 'instructions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* ??$$$ Manual Library Installation Warning Card */}
              {milestone.requiredLibraries?.some(lib => lib.type === 'manual') && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  color: isDark ? '#fca5a5' : '#b91c1c'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>⚠️ Manual Library Installation Required</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    This milestone requires standard/third-party library dependencies that must be manually installed in your Arduino IDE or local CLI environment.
                  </p>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {milestone.requiredLibraries.filter(lib => lib.type === 'manual').map((lib, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        <strong>{lib.name}</strong>: {lib.installCommand || `arduino-cli lib install "${lib.name}"`}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={handleAcknowledgeManualLibs}
                      disabled={milestone.manualLibsAcknowledged}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: milestone.manualLibsAcknowledged ? '#4b5563' : '#ef4444',
                        color: '#fff',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: milestone.manualLibsAcknowledged ? 'default' : 'pointer'
                      }}
                    >
                      {milestone.manualLibsAcknowledged ? '✓ Libraries Acknowledged' : 'I have installed these libraries'}
                    </button>
                    {milestone.manualLibsAcknowledged && (
                      <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>Ready to compile!</span>
                    )}
                  </div>
                </div>
              )}
              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.3)' : '#fff',
                padding: '1.25rem',
                borderRadius: '16px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>Objective</h3>
                <p style={{ margin: 0, fontSize: '0.825rem', lineHeight: 1.6, color: isDark ? '#94a3b8' : '#475569' }}>
                  {milestone.objective}
                </p>
              </div>

              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.3)' : '#fff',
                padding: '1.25rem',
                borderRadius: '16px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>Wiring Instructions</h3>
                <p style={{ margin: 0, fontSize: '0.825rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: isDark ? '#94a3b8' : '#475569' }}>
                  {milestone.wiringInstructions}
                </p>
              </div>

              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.3)' : '#fff',
                padding: '1.25rem',
                borderRadius: '16px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>Expected Telemetry Output</h3>
                <div style={{
                  background: isDark ? '#070a13' : '#f1f5f9',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: isDark ? '#38bdf8' : '#0369a1',
                  border: `1px solid ${isDark ? '#0284c730' : '#bae6fd'}`,
                  marginBottom: '0.5rem'
                }}>
                  {milestone.test?.expectedSerialOutput}
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                  <strong>Pass Condition:</strong> {milestone.test?.passCondition}
                </p>
              </div>

              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.3)' : '#fff',
                padding: '1.25rem',
                borderRadius: '16px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>Components Involved</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {milestone.componentsInvolved?.map((c) => (
                    <span key={c} style={{
                      background: isDark ? '#1e293b' : '#e2e8f0',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      fontSize: '0.7rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}>{c}</span>
                  ))}
                </div>
                <button
                  onClick={() => setAdvisorModal({ open: true, componentKey: milestone.componentsInvolved?.[0] || '', problem: '', response: '', loading: false })}
                  style={{
                    marginTop: '1rem',
                    background: 'transparent',
                    border: '1px dashed #ef4444',
                    color: '#ef4444',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  ⚠️ Wrong component? Ask Component Advisor Escape Hatch
                </button>
              </div>
            </div>
          )}

          {centerTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' }}>
              {!isPreviousMilestoneConfirmed ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  background: isDark ? 'rgba(30, 41, 59, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  padding: '2rem',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: isDark ? '#fff' : '#1e293b' }}>Code Editor Locked</h3>
                  <p style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', maxWidth: '360px', lineHeight: 1.5, margin: 0 }}>
                    Please complete and pass the previous milestone <strong>Step {previousMilestone?.order}: "{previousMilestone?.title}"</strong> to unlock the code editor.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{
                    padding: '0.5rem',
                    background: isDark ? '#0b0f19' : '#f1f5f9',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderBottom: 'none'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>sketch.ino</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleRegenerateCode}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Regenerate AI Code
                      </button>
                      <button
                        onClick={handleCompileMilestone}
                        disabled={compilingLocal}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#22c55e',
                          color: '#fff',
                          borderRadius: '4px',
                          border: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {compilingLocal ? 'Compiling...' : '▶ Compile'}
                      </button>
                    </div>
                  </div>
                  
                  {/* ??$$$ Required Libraries Status Badge List */}
                  {milestone.requiredLibraries && milestone.requiredLibraries.length > 0 && (
                    <div style={{
                      padding: '8px 12px',
                      background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderBottom: 'none',
                      fontSize: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Required Libraries:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {milestone.requiredLibraries.map((lib, idx) => {
                          let icon = '✓';
                          let color = '#22c55e';
                          let statusText = 'installed';
                          if (lib.type === 'core') {
                            statusText = 'built-in';
                          } else if (lib.type === 'library_manager') {
                            const hasNoFileError = milestone.compilationErrors?.some(e => e.includes(lib.name) || e.includes("No such file or directory"));
                            if (hasNoFileError) {
                              icon = '⬇';
                              color = '#fb923c';
                              statusText = 'installing...';
                            } else {
                              statusText = 'installed';
                            }
                          } else if (lib.type === 'manual') {
                            icon = '⚠';
                            color = '#fb7185';
                            statusText = milestone.manualLibsAcknowledged ? 'acknowledged' : 'manual install required';
                          }
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isDark ? '#1e293b' : '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                              <span style={{ color, fontWeight: 800 }}>{icon}</span>
                              <span style={{ fontWeight: 600 }}>{lib.name}</span>
                              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>({statusText})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <textarea
                    value={localCode}
                    onChange={handleCodeChange}
                    spellCheck={false}
                    style={{
                      flex: 1,
                      minHeight: '260px',
                      background: isDark ? '#070a13' : '#fff',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      fontFamily: '"Fira Code", monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.6,
                      padding: '1rem',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                  <div style={{
                    height: '140px',
                    background: '#000000', // ??$$$ pure black terminal
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{ padding: '4px 8px', background: '#111111', fontSize: '0.65rem', color: '#ffffff', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                      Compiler Output Terminal
                    </div>
                    <div style={{ flex: 1, padding: '8px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', color: '#ffffff' }}>
                      {milestone.compilationErrors?.length > 0 ? (
                        milestone.compilationErrors.map((err, idx) => (
                          <div key={idx} style={{ color: '#ff3333' }}>{err}</div> // ??$$$ bright red error text
                        ))
                      ) : milestone.compiledHex ? (
                        <div style={{ color: '#22c55e' }}>✓ Compilation successful. Firmware ready for Wokwi Simulation.</div>
                      ) : (
                        <div style={{ color: '#888888' }}>Idle. Click Compile to test the code.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {centerTab === 'simulator' && milestone?.simulatable && (
            <div style={{ height: '100%', minHeight: '380px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              {!isPreviousMilestoneConfirmed ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  background: isDark ? 'rgba(30, 41, 59, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(12px)',
                  padding: '2rem',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: '#fff' }}>Simulator Locked</h3>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '360px', lineHeight: 1.5, margin: 0 }}>
                    Please complete and pass the previous milestone <strong>Step {previousMilestone?.order}: "{previousMilestone?.title}"</strong> to unlock the simulator.
                  </p>
                </div>
              ) : project?.diagram && Object.keys(project.diagram).length > 0 ? (
                simView === '2d' ? (
                  <WokwiSimulator
                    hexCode={milestone.compiledHex || ''}
                    diagramJson={project.diagram}
                    sketchCode={milestone.code || ''}
                    projectId={id}
                  />
                ) : (
                  <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Initializing 3D CAD...</div>}>
                    <Simulator3D
                      diagram={project.diagram}
                      hexCode={milestone.compiledHex}
                      registry={registry}
                      bom={project.bom || []}
                      projectId={id}
                      onDiagramChange={async (newDiagram) => {
                        // Background update diagram if needed
                      }}
                    />
                  </Suspense>
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '0.8rem' }}>
                  No diagram layout configured.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 3: Test & Debug Coach (25%) ───────────────────────────────── */}
      <div style={{
        width: '25%',
        minWidth: '280px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? '#111216' : '#fff',
      }}>
        {/* Validation / Serial Grading */}
        <div style={{
          padding: '1.25rem',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800 }}>Serial Output Grading</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Paste hardware serial logs below to validate:</p>
          <textarea
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="[Serial Monitor Logs...]"
            style={{
              width: '100%',
              height: '60px',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              padding: '6px',
              borderRadius: '8px',
              background: isDark ? '#070a13' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              color: isDark ? '#e2e8f0' : '#1e293b',
              resize: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleValidateSerial}
              disabled={validatingSerial || !serialInput.trim() || !isPreviousMilestoneConfirmed}
              style={{
                flex: 1,
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {validatingSerial ? 'Grading...' : '🔍 Validate'}
            </button>
            <button
              onClick={handleConfirmMilestone}
              disabled={!isPreviousMilestoneConfirmed}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Pass
            </button>
            <button
              onClick={handleReportFailure}
              disabled={!isPreviousMilestoneConfirmed}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fail
            </button>
          </div>

          {validationResult && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              borderRadius: '8px',
              background: validationResult.success ? '#22c55e15' : '#ef444415',
              border: `1px solid ${validationResult.success ? '#22c55e30' : '#ef444430'}`,
              fontSize: '0.75rem',
            }}>
              <div style={{ fontWeight: 700, color: validationResult.success ? '#22c55e' : '#ef4444', marginBottom: '4px' }}>
                {validationResult.success ? 'Success!' : 'Validation Issue'}
              </div>
              <p style={{ margin: 0, color: isDark ? '#d1d5db' : '#374151' }}>{validationResult.feedback}</p>
            </div>
          )}
        </div>

        {/* Debug Coach Chat Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Debug Coach AI</span>
            <span style={{ fontSize: '0.6rem', color: '#22c55e', background: '#22c55e20', padding: '2px 6px', borderRadius: '4px' }}>Online</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {milestone?.debugMessages && milestone.debugMessages.length > 0 ? (
              milestone.debugMessages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={index} style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: isUser ? '#3b82f6' : (isDark ? '#1e293b' : '#f1f5f9'),
                    color: isUser ? '#fff' : (isDark ? '#e2e8f0' : '#1e293b'),
                    padding: '0.625rem 0.875rem',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: '0.75rem',
                    lineHeight: 1.45,
                    border: isUser ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  }}>
                    <div style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{isUser ? 'You' : 'Coach'}</span>
                      <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '0.75rem', textAlign: 'center', padding: '1rem' }}>
                Having issues building this step? Describe the problem below to start chatting with the Coach.
              </div>
            )}
          </div>

          {chatError && (
            <div style={{ padding: '4px 12px', background: '#ef444420', color: '#ef4444', fontSize: '0.7rem' }}>
              {chatError}
            </div>
          )}

          <form onSubmit={handleSendChat} style={{ padding: '0.75rem', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask the coach for help..."
              disabled={sendingChat || !isPreviousMilestoneConfirmed}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: isDark ? '#070a13' : '#f1f5f9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                color: isDark ? '#e2e8f0' : '#1e293b',
                fontSize: '0.75rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim() || !isPreviousMilestoneConfirmed}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {sendingChat ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Advisor Modal (Component Advisor escape hatch) ──────────────────── */}
      {advisorModal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setAdvisorModal(prev => ({ ...prev, open: false }))}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#111216' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: '20px', padding: '1.5rem',
              width: '100%', maxWidth: '520px',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Component Advisor Escape Hatch</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Select Component:</label>
              <select
                value={advisorModal.componentKey}
                onChange={e => setAdvisorModal(prev => ({ ...prev, componentKey: e.target.value }))}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: isDark ? '#070a13' : '#f1f5f9',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                {milestone.componentsInvolved?.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Describe the Issue / Compatibility Problem:</label>
              <textarea
                value={advisorModal.problem}
                onChange={e => setAdvisorModal(prev => ({ ...prev, problem: e.target.value }))}
                placeholder="E.g., I don't have this component, can I swap it with another sensor? Or is this I2C pin layout correct?"
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '8px',
                  borderRadius: '8px',
                  background: isDark ? '#070a13' : '#f1f5f9',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  fontSize: '0.75rem',
                  resize: 'none',
                }}
              />
            </div>

            <button
              onClick={handleReportComponentIssue}
              disabled={advisorModal.loading || !advisorModal.problem.trim()}
              style={{
                padding: '0.625rem',
                borderRadius: '10px',
                background: '#ef4444',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {advisorModal.loading ? 'Asking AI Advisor...' : 'Ask AI Advisor'}
            </button>

            {advisorModal.response && (
              <div style={{
                maxHeight: '160px', overflowY: 'auto',
                padding: '0.75rem', borderRadius: '8px',
                background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                fontSize: '0.75rem', lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 800, marginBottom: '4px' }}>Advisor Suggestion:</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{advisorModal.response}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setAdvisorModal(prev => ({ ...prev, open: false }));
                  navigate(`/project/${id}/components`);
                }}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px',
                  background: '#2563eb', color: '#fff', border: 'none',
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                ↩ Swap Components on BOM Page
              </button>
              <button
                onClick={() => setAdvisorModal(prev => ({ ...prev, open: false }))}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px',
                  background: 'transparent', color: isDark ? '#a3a3a3' : '#555',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Skip Modal ──────────────────────────────────────────────────────── */}
      {skipModal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setSkipModal(prev => ({ ...prev, open: false }))}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#111216' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: '20px', padding: '1.5rem',
              width: '100%', maxWidth: '420px',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Skip Milestone</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Provide a reason or notes for bypassing this step:</p>
            <textarea
              value={skipModal.notes}
              onChange={e => setSkipModal(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Why are you skipping? E.g., 'Already verified physical wiring' or 'No simulator equivalent needed'."
              style={{
                width: '100%',
                height: '80px',
                padding: '8px',
                borderRadius: '8px',
                background: isDark ? '#070a13' : '#f1f5f9',
                color: isDark ? '#e2e8f0' : '#1e293b',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                fontSize: '0.75rem',
                resize: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleConfirmSkip}
                style={{
                  flex: 1, padding: '0.625rem', borderRadius: '10px',
                  background: '#3b82f6', color: '#fff', fontWeight: 700, border: 'none',
                  fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                Confirm Skip
              </button>
              <button
                onClick={() => setSkipModal(prev => ({ ...prev, open: false }))}
                style={{
                  padding: '0.625rem 1rem', borderRadius: '10px',
                  background: 'transparent', color: isDark ? '#a3a3a3' : '#555',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
