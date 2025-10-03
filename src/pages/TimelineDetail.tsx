import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Calendar, MapPin, ChevronDown, ChevronUp, Eye, EyeOff, Printer, Filter, RefreshCw, Lock, Unlock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProgressRing } from '../components/ProgressRing';
import { calculateBlockProgress, calculateTimelineProgress, calculateProgressByAssignee } from '../utils/progress';
import { calculateLeadTimeMonths, calculateScaleFactor } from '../utils/recalibration';
import { calculateCountdown } from '../utils/countdown';
import { trafficLight, trafficLabel } from '../utils/trafficLight';
import { getEventSourceHead, updateEventDate, recalcTimeline } from '../api/events';
import { BRAND } from '../config/brand';
import themes, { type ThemeKey } from '../lib/themes';
import type { Timeline, Block, Task } from '../types';

export function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [shareLink, setShareLink] = useState<string>('');
  const [showBackground, setShowBackground] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['client', 'js', 'joint']));
  const [recalculating, setRecalculating] = useState(false);
  const [respectLocks, setRespectLocks] = useState(true);
  const [distribution, setDistribution] = useState<'balanced' | 'frontload' | 'even'>('frontload');

  const [localDate, setLocalDate] = useState<string>('');
  const [initialDate, setInitialDate] = useState<string>('');
  const [sourceHead, setSourceHead] = useState<{date:string;sourceVersion:number}|null>(null);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showAcceptJsChange, setShowAcceptJsChange] = useState(false);
  const [pendingNewDate, setPendingNewDate] = useState<string|undefined>(undefined);
  const pollRef = useRef<number | null>(null);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState<'client' | 'js' | 'joint'>('client');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskWeight, setNewTaskWeight] = useState(1);

  const isDirty = localDate && initialDate && localDate !== initialDate;

  useEffect(() => {
    if (id) {
      loadTimeline(id);
      loadShareLink(id);
    }
  }, [id]);

  useEffect(() => {
    const d = timeline?.event?.date ? timeline.event.date.substring(0,10) : '';
    setLocalDate(d);
    setInitialDate(d);
  }, [timeline?.event?.date]);

  useEffect(() => {
    if (!timeline?.event?.id) return;

    async function poll() {
      try {
        const head = await getEventSourceHead(String(timeline.event.id));
        setSourceHead(head);
        const jsDate = head.date?.substring(0,10);
        const uiBaseline = initialDate;
        if (jsDate && uiBaseline && jsDate !== uiBaseline) {
          setShowAcceptJsChange(true);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    }
    poll();
    pollRef.current = window.setInterval(poll, 60000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [timeline?.event?.id, initialDate]);

  async function loadTimeline(timelineId: string) {
    try {
      const { data, error } = await supabase
        .from('timelines')
        .select(`
          *,
          event:events(*),
          blocks(
            *,
            tasks(*)
          )
        `)
        .eq('id', timelineId)
        .single();

      if (error) throw error;

      if (data.blocks) {
        data.blocks.sort((a, b) => a.order - b.order);
        data.blocks.forEach((block) => {
          if (block.tasks) {
            block.tasks.sort((a, b) => a.order - b.order);
          }
        });
      }

      setTimeline(data);
      setExpandedBlocks(new Set(data.blocks?.map((b) => b.id) || []));
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadShareLink(timelineId: string) {
    try {
      const { data } = await supabase
        .from('share_links')
        .select('token')
        .eq('timeline_id', timelineId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (data?.token) {
        const baseUrl = window.location.origin;
        setShareLink(`${baseUrl}/client?token=${data.token}`);
      }
    } catch (error) {
      console.error('Error loading share link:', error);
    }
  }

  async function handleTaskToggle(task: Task) {
    if (!timeline) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          done: !task.done,
          done_at: !task.done ? new Date().toISOString() : null,
          done_by: !task.done ? 'admin' : null,
        })
        .eq('id', task.id);

      if (error) throw error;

      await supabase.from('audit_entries').insert({
        timeline_id: timeline.id,
        task_id: task.id,
        action: !task.done ? 'check' : 'uncheck',
        actor: 'admin',
        changes: { done: { from: task.done, to: !task.done } },
      });

      loadTimeline(timeline.id);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  async function handleAssigneeChange(task: Task) {
    if (!timeline) return;

    const assignees = ['client', 'js', 'joint'];
    const currentIndex = assignees.indexOf(task.assignee);
    const newAssignee = assignees[(currentIndex + 1) % assignees.length];

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assignee: newAssignee })
        .eq('id', task.id);

      if (error) throw error;

      await supabase.from('audit_entries').insert({
        timeline_id: timeline.id,
        task_id: task.id,
        action: 'update',
        actor: 'admin',
        changes: { assignee: { from: task.assignee, to: newAssignee } },
      });

      loadTimeline(timeline.id);
    } catch (error) {
      console.error('Error updating assignee:', error);
    }
  }

  async function handleGenerateShareLink() {
    if (!timeline) return;

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/timelines/${timeline.id}/share`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresInDays: 90 }),
      });

      if (!response.ok) throw new Error('Failed to generate share link');

      const data = await response.json();
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/client?token=${data.token}`;
      setShareLink(link);

      navigator.clipboard.writeText(link);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error generating share link:', error);
      alert('Failed to generate share link');
    }
  }

  function toggleBlock(blockId: string) {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }

  function toggleFilter(assignee: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(assignee)) {
        next.delete(assignee);
      } else {
        next.add(assignee);
      }
      return next;
    });
  }

  async function handleAddGeneralTask() {
    if (!timeline || !newTaskTitle.trim()) return;

    const generalBlock = timeline.blocks?.find(b => b.is_general);
    if (!generalBlock) return;

    try {
      const maxOrder = Math.max(0, ...(generalBlock.tasks?.map(t => t.order) || [0]));

      const { error } = await supabase
        .from('tasks')
        .insert({
          timeline_id: timeline.id,
          block_id: generalBlock.id,
          title: newTaskTitle.trim(),
          assignee: newTaskAssignee,
          weight: newTaskWeight,
          is_skeleton: false,
          done: false,
          due_date: newTaskDueDate || null,
          order: maxOrder + 1,
        });

      if (error) throw error;

      setNewTaskTitle('');
      setNewTaskAssignee('client');
      setNewTaskDueDate('');
      setNewTaskWeight(1);
      setShowAddTask(false);

      loadTimeline(timeline.id);
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task');
    }
  }

  async function handleToggleGeneralSetting(field: 'allow_client_task_create' | 'include_general_in_totals', value: boolean) {
    if (!timeline) return;

    try {
      const { error } = await supabase
        .from('timelines')
        .update({ [field]: value })
        .eq('id', timeline.id);

      if (error) throw error;

      setTimeline({ ...timeline, [field]: value });
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Failed to update setting');
    }
  }

  function getAssigneeColor(assignee: string): string {
    switch (assignee) {
      case 'client':
        return 'bg-blue-100 text-blue-700';
      case 'js':
        return 'bg-purple-100 text-purple-700';
      case 'joint':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function isTaskVisible(task: Task): boolean {
    return activeFilters.has(task.assignee);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async function handleRecalculate() {
    if (!timeline || !id) return;

    setRecalculating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/timelines-recalculate/${id}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          respectLocks,
          distribution,
        }),
      });

      if (!response.ok) {
        throw new Error('Recalculation failed');
      }

      const result = await response.json();

      alert(`Timeline recalibrated successfully!\nLead time: ${result.lead_time_months} months\nScale factor: ${result.scale_factor.toFixed(2)}`);

      await loadTimeline(id);
    } catch (error) {
      console.error('Error recalculating timeline:', error);
      alert('Failed to recalculate timeline. Please try again.');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleTaskLockToggle(task: Task) {
    if (!timeline) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ locked: !task.locked })
        .eq('id', task.id);

      if (error) throw error;

      await loadTimeline(id!);
    } catch (error) {
      console.error('Error toggling task lock:', error);
      alert('Failed to toggle task lock');
    }
  }

  function handleLocalDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalDate(e.target.value);
  }

  function requestUpdateJsLive() {
    if (!localDate) return;
    setPendingNewDate(localDate);
    setShowUpdateConfirm(true);
  }

  async function confirmUpdateJsLive(force = false) {
    if (!pendingNewDate || !timeline?.event?.id) return;
    setShowUpdateConfirm(false);
    try {
      const mutationId = crypto?.randomUUID?.() || String(Date.now());
      const res = await updateEventDate(String(timeline.event.id), pendingNewDate, mutationId, force);
      alert('Date updated in JS Live');
      setInitialDate(pendingNewDate);
      setLocalDate(pendingNewDate);
      const doRecalc = window.confirm('Recalculate the timeline to fit the new date?');
      if (doRecalc) {
        await recalcTimeline(String(timeline.id), { respectLocks: true, distribution: 'frontload' });
        alert('Timeline recalculated');
        await loadTimeline(timeline.id);
      }
    } catch (err:any) {
      const msg = String(err?.message || err);
      if (msg.includes('conflict') || msg.includes('sourceVersion')) {
        const overwrite = window.confirm(
          `JS Live changed the date while you were editing.\n` +
          `JS Live: ${sourceHead?.date?.substring(0,10)}\n` +
          `Yours: ${pendingNewDate}\n\n` +
          `Overwrite JS Live with your date?`
        );
        if (overwrite) return confirmUpdateJsLive(true);
        if (sourceHead?.date) {
          const js = sourceHead.date.substring(0,10);
          setLocalDate(js);
          setInitialDate(js);
          alert('Kept JS Live date');
        }
      } else {
        alert(msg);
      }
    } finally {
      setPendingNewDate(undefined);
    }
  }

  function dismissJsChangeBanner() {
    setShowAcceptJsChange(false);
  }

  async function acceptJsChange() {
    if (!sourceHead?.date) return;
    const js = sourceHead.date.substring(0,10);
    setLocalDate(js);
    setInitialDate(js);
    setShowAcceptJsChange(false);
    const doRecalc = window.confirm('JS Live date accepted. Recalculate the timeline now?');
    if (doRecalc) {
      await recalcTimeline(String(timeline!.id), { respectLocks: true, distribution: 'frontload' });
      alert('Timeline recalculated');
      await loadTimeline(timeline!.id);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Timeline not found</div>
      </div>
    );
  }

  const includeGeneral = timeline.include_general_in_totals ?? true;
  const allTasks = timeline.blocks?.flatMap((block) => block.tasks || []) || [];
  const generalTasks = timeline.blocks?.filter(b => b.is_general).flatMap((block) => block.tasks || []) || [];
  const progress = timeline.blocks ? calculateTimelineProgress(timeline.blocks, includeGeneral) : null;
  const progressByAssignee = calculateProgressByAssignee(allTasks);
  const generalProgress = calculateBlockProgress(generalTasks);

  const themeKey = timeline.template_key as ThemeKey;
  const backgroundImage = themes[themeKey] || themes.wedding;

  return (
    <div className="min-h-screen relative">
      {showBackground && (
        <>
          <div className="timeline-bg" style={{ backgroundImage: `url(${backgroundImage})` }} />
          <div className="timeline-overlay" />
        </>
      )}

      <div className="timeline-content">
      <header className="app-header relative z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 print:hidden sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <a href="/" className="brand flex items-center gap-3">
              <img
                id="brand-logo"
                src={BRAND.logoLight}
                alt={BRAND.name}
                className="h-7 w-auto"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              <ArrowLeft size={18} />
              Back to Timelines
            </a>
          </div>
        </div>
      </header>

      <div className="print-header hidden print:flex items-center gap-3 border-b border-gray-300 pb-2 mb-4">
        <img src={BRAND.logoLight} alt={BRAND.name} className="h-6 w-auto" />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {timeline.event?.code} — {timeline.event?.title}
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <span>
              {timeline.event?.date && formatDate(timeline.event.date)}
            </span>
            {(() => {
              const countdown = calculateCountdown(timeline.event?.date);
              if (!countdown) return null;
              return (
                <span className={`px-2 py-0.5 rounded font-semibold ${
                  countdown.isToday
                    ? 'bg-green-100 text-green-700'
                    : countdown.isPast
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {countdown.formatted}
                </span>
              );
            })()}
            <span>• Overall progress: {progress?.percentage || 0}%</span>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-end print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white transition-colors shadow-sm border border-gray-200"
            >
              <Printer size={18} />
              Print
            </button>
            {timeline.background_url && (
              <button
                onClick={() => setShowBackground(!showBackground)}
                className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white transition-colors shadow-sm border border-gray-200"
              >
                {showBackground ? <EyeOff size={18} /> : <Eye size={18} />}
                {showBackground ? 'Hide' : 'Show'} Background
              </button>
            )}
          </div>
        </div>

        <div className="block-card p-6 mb-6 border border-gray-200">
          {showAcceptJsChange && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div className="flex-1 text-sm text-yellow-800">
                JS Live changed the event date to <b>{sourceHead?.date?.substring(0,10)}</b>. Accept?
              </div>
              <button
                onClick={acceptJsChange}
                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={dismissJsChangeBanner}
                className="px-3 py-1 text-yellow-700 text-sm hover:bg-yellow-100 rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                {timeline.event?.code}
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {timeline.template_key.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {timeline.event?.title}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {timeline.event?.date && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Event date</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={localDate || ''}
                      onChange={handleLocalDateChange}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      disabled={!isDirty}
                      onClick={requestUpdateJsLive}
                      title="Update JS Live with this date"
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    {(() => {
                      const countdown = calculateCountdown(timeline.event.date);
                      if (!countdown) return null;
                      return (
                        <div className={`flex items-center gap-1 px-3 py-2 rounded-md font-semibold text-sm ${
                          countdown.isToday
                            ? 'bg-green-100 text-green-700'
                            : countdown.isPast
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {countdown.formatted}
                        </div>
                      );
                    })()}
                  </div>
                  <small className="text-xs text-gray-500">Changes here sync to JS Live for {timeline.event?.code}</small>
                </div>
              )}
              {timeline.event?.venue && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Venue</label>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={18} />
                    {timeline.event.venue}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 print-kpis">
            <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center kpi">
              <ProgressRing percentage={progress?.percentage || 0} size={60} strokeWidth={6} />
              <div className="text-sm text-gray-600 text-center font-medium mt-2">
                Overall Progress
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {progress?.completedTasks} / {progress?.totalTasks} tasks
              </div>
              {(() => {
                const overall = progress?.percentage || 0;
                const status = trafficLight(overall);
                return (
                  <span className={`mt-2 badge ${
                    status === 'red' ? 'bg-tl-red' :
                    status === 'amber' ? 'bg-tl-amber' :
                    status === 'green' ? 'bg-tl-green' : 'bg-tl-done'
                  }`}>
                    {trafficLabel(status)}
                  </span>
                );
              })()}
            </div>

            <div className="bg-blue-50 rounded-lg p-4 flex flex-col items-center kpi">
              <ProgressRing percentage={progressByAssignee.client.percentage} size={60} strokeWidth={6} color="#3b82f6" />
              <div className="text-sm text-blue-700 text-center font-medium mt-2">
                Client Involved
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {progressByAssignee.client.completedTasks} / {progressByAssignee.client.totalTasks} tasks
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 flex flex-col items-center kpi">
              <ProgressRing percentage={progressByAssignee.js.percentage} size={60} strokeWidth={6} color="#a855f7" />
              <div className="text-sm text-purple-700 text-center font-medium mt-2">
                JustSeventy Involved
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {progressByAssignee.js.completedTasks} / {progressByAssignee.js.totalTasks} tasks
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 flex flex-col items-center kpi">
              <ProgressRing percentage={progressByAssignee.joint.percentage} size={60} strokeWidth={6} color="#10b981" />
              <div className="text-sm text-green-700 text-center font-medium mt-2">
                Joint Tasks
              </div>
              <div className="text-xs text-green-600 mt-1">
                {progressByAssignee.joint.completedTasks} / {progressByAssignee.joint.totalTasks} tasks
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 flex flex-col items-center kpi">
              <ProgressRing percentage={generalProgress.percentage} size={60} strokeWidth={6} color="#f59e0b" />
              <div className="text-sm text-amber-700 text-center font-medium mt-2">
                General Tasks
              </div>
              <div className="text-xs text-amber-600 mt-1">
                {generalProgress.completedTasks} / {generalProgress.totalTasks} tasks
              </div>
            </div>
          </div>

          <div className="mb-4 print:hidden">
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filter by assignee:</span>
              <button
                onClick={() => toggleFilter('client')}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  activeFilters.has('client')
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-400 border-2 border-transparent'
                }`}
              >
                Client
              </button>
              <button
                onClick={() => toggleFilter('js')}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  activeFilters.has('js')
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-400 border-2 border-transparent'
                }`}
              >
                JustSeventy
              </button>
              <button
                onClick={() => toggleFilter('joint')}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  activeFilters.has('joint')
                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                    : 'bg-gray-100 text-gray-400 border-2 border-transparent'
                }`}
              >
                Both
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex gap-3">
              <button
                onClick={handleGenerateShareLink}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Link2 size={18} />
                {shareLink ? 'Regenerate' : 'Generate'} Client Link
              </button>
              {shareLink && (
                <>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      alert('Link copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Copy Link
                  </button>
                  <a
                    href={shareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Open Client View
                  </a>
                </>
              )}
            </div>
            {shareLink && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-700 mb-1">Client Access Link:</p>
                <p className="text-sm text-blue-900 font-mono break-all">{shareLink}</p>
                <p className="text-xs text-blue-600 mt-2">This link expires in 30 days and allows clients to view and check off their tasks.</p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline Recalibration</h3>

            {timeline.event?.date && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Lead Time:</span>{' '}
                    {calculateLeadTimeMonths(new Date(timeline.event.date))} months
                  </div>
                  {timeline.scale_factor && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Scale Factor:</span>{' '}
                      {parseFloat(timeline.scale_factor).toFixed(2)}
                    </div>
                  )}
                  {timeline.last_recalculated_at && (
                    <div className="text-xs text-gray-500">
                      Last recalculated:{' '}
                      {new Date(timeline.last_recalculated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={respectLocks}
                    onChange={(e) => setRespectLocks(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Respect locks and completed tasks</span>
                </label>

                <select
                  value={distribution}
                  onChange={(e) => setDistribution(e.target.value as 'balanced' | 'frontload' | 'even')}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="frontload">Front-load skeleton</option>
                  <option value="balanced">Balanced</option>
                  <option value="even">Even by count</option>
                </select>
              </div>

              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              >
                <RefreshCw size={18} className={recalculating ? 'animate-spin' : ''} />
                {recalculating ? 'Recalculating...' : 'Recalculate Schedule'}
              </button>

              <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-700">Distribution Strategies:</p>
                <ul className="space-y-1 ml-2">
                  <li><span className="font-semibold">Front-load:</span> Places first 50% of tasks in the first 25% of available time, keeping critical work early.</li>
                  <li><span className="font-semibold">Balanced:</span> Distributes tasks evenly throughout the block with consistent spacing.</li>
                  <li><span className="font-semibold">Even by count:</span> Spreads tasks uniformly based on mathematical distribution (i/(N-1)).</li>
                </ul>
                <p className="mt-2 pt-2 border-t border-gray-200">
                  <span className="font-semibold">Respect Locks:</span> When checked, locked tasks stay fixed and act as anchors, splitting blocks into segments. Unlocked tasks distribute around them. When unchecked, all tasks (including locked ones) are repositioned.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">General Tasks Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timeline.include_general_in_totals ?? true}
                    onChange={(e) => handleToggleGeneralSetting('include_general_in_totals', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Include General Tasks in overall progress</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timeline.allow_client_task_create ?? false}
                    onChange={(e) => handleToggleGeneralSetting('allow_client_task_create', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow clients to add tasks in General block</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 print-columns">
          {timeline.blocks?.filter(b => !b.is_general).map((block) => {
            const blockProgress = block.tasks ? calculateBlockProgress(block.tasks) : null;
            const isExpanded = expandedBlocks.has(block.id);

            return (
              <div key={block.id} className="block-card border border-gray-200 print-block">
                <div className="hidden print:flex items-center justify-between mb-3">
                  <h2 className="block-title m-0 border-0 pb-0">{block.title}</h2>
                  {blockProgress && (() => {
                    const blockStatus = trafficLight(blockProgress.percentage);
                    return (
                      <span className={`badge ${
                        blockStatus === 'red' ? 'bg-tl-red' :
                        blockStatus === 'amber' ? 'bg-tl-amber' :
                        blockStatus === 'green' ? 'bg-tl-green' : 'bg-tl-done'
                      }`}>
                        {blockProgress.percentage}% — {trafficLabel(blockStatus)}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => toggleBlock(block.id)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors print:hidden"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {blockProgress && <ProgressRing percentage={blockProgress.percentage} />}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{block.title}</h3>
                      {blockProgress && (
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">
                            {blockProgress.completedTasks} of {blockProgress.totalTasks} tasks complete
                          </p>
                          {(() => {
                            const blockStatus = trafficLight(blockProgress.percentage);
                            return (
                              <span className={`badge text-xs ${
                                blockStatus === 'red' ? 'bg-tl-red' :
                                blockStatus === 'amber' ? 'bg-tl-amber' :
                                blockStatus === 'green' ? 'bg-tl-green' : 'bg-tl-done'
                              }`}>
                                {trafficLabel(blockStatus)}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {isExpanded && block.tasks && (
                  <div className="px-6 pb-6 space-y-2">
                    {block.tasks.filter(isTaskVisible).map((task) => (
                      <div
                        key={task.id}
                        className="task-card flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => handleTaskToggle(task)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer print:w-4 print:h-4"
                        />
                        <div className="flex-1">
                          <p className={`task-title text-gray-900 ${task.done ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </p>
                          <div className="task-meta flex items-center gap-2 mt-1">
                            <button
                              onClick={() => handleAssigneeChange(task)}
                              className={`px-2 py-0.5 text-xs font-medium rounded transition-all hover:ring-2 hover:ring-offset-1 ${getAssigneeColor(task.assignee)} ${
                                task.assignee === 'client' ? 'hover:ring-blue-300' :
                                task.assignee === 'js' ? 'hover:ring-purple-300' :
                                'hover:ring-green-300'
                              } cursor-pointer print:cursor-default`}
                              title="Click to change assignee"
                            >
                              {task.assignee}
                            </button>
                            {task.is_skeleton && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                                Key Task
                              </span>
                            )}
                            <span className="text-xs text-gray-500">Weight: {task.weight}</span>
                            {task.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            <button
                              onClick={() => handleTaskLockToggle(task)}
                              className={`ml-auto p-1 rounded transition-colors ${
                                task.locked
                                  ? 'text-orange-600 hover:bg-orange-100'
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title={task.locked ? 'Task locked (won\'t be recalculated)' : 'Click to lock task'}
                            >
                              {task.locked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {timeline.blocks?.filter(b => b.is_general).map((block) => {
            const blockProgress = block.tasks ? calculateBlockProgress(block.tasks) : null;
            const isExpanded = expandedBlocks.has(block.id);

            return (
              <div key={block.id} className="block-card border border-gray-200 print-block bg-gray-50">
                <div className="hidden print:flex items-center justify-between mb-3">
                  <h2 className="block-title m-0 border-0 pb-0">{block.title}</h2>
                  {blockProgress && (() => {
                    const blockStatus = trafficLight(blockProgress.percentage);
                    return (
                      <span className={`badge ${
                        blockStatus === 'red' ? 'bg-tl-red' :
                        blockStatus === 'amber' ? 'bg-tl-amber' :
                        blockStatus === 'green' ? 'bg-tl-green' : 'bg-tl-done'
                      }`}>
                        {blockProgress.percentage}% — {trafficLabel(blockStatus)}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => toggleBlock(block.id)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-100 transition-colors print:hidden"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {blockProgress && <ProgressRing percentage={blockProgress.percentage} />}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{block.title}</h3>
                      {blockProgress && (
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">
                            {blockProgress.completedTasks} of {blockProgress.totalTasks} tasks complete
                          </p>
                          {(() => {
                            const blockStatus = trafficLight(blockProgress.percentage);
                            return (
                              <span className={`badge text-xs ${
                                blockStatus === 'red' ? 'bg-tl-red' :
                                blockStatus === 'amber' ? 'bg-tl-amber' :
                                blockStatus === 'green' ? 'bg-tl-green' : 'bg-tl-done'
                              }`}>
                                {trafficLabel(blockStatus)}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 space-y-2">
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      {!showAddTask ? (
                        <button
                          onClick={() => setShowAddTask(true)}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Add Task
                        </button>
                      ) : (
                        <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task title..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={newTaskAssignee}
                              onChange={(e) => setNewTaskAssignee(e.target.value as 'client' | 'js' | 'joint')}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="client">Client</option>
                              <option value="js">JustSeventy</option>
                              <option value="joint">Joint</option>
                            </select>
                            <input
                              type="number"
                              value={newTaskWeight}
                              onChange={(e) => setNewTaskWeight(parseInt(e.target.value) || 1)}
                              min="1"
                              placeholder="Weight"
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleAddGeneralTask}
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setShowAddTask(false);
                                setNewTaskTitle('');
                                setNewTaskDueDate('');
                                setNewTaskWeight(1);
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {block.tasks && block.tasks.filter(isTaskVisible).map((task) => (
                      <div
                        key={task.id}
                        className="task-card flex items-start gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => handleTaskToggle(task)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer print:w-4 print:h-4"
                        />
                        <div className="flex-1">
                          <p className={`task-title text-gray-900 ${task.done ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </p>
                          <div className="task-meta flex items-center gap-2 mt-1">
                            <button
                              onClick={() => handleAssigneeChange(task)}
                              className={`px-2 py-0.5 text-xs font-medium rounded transition-all hover:ring-2 hover:ring-offset-1 ${getAssigneeColor(task.assignee)} ${
                                task.assignee === 'client' ? 'hover:ring-blue-300' :
                                task.assignee === 'js' ? 'hover:ring-purple-300' :
                                'hover:ring-green-300'
                              } cursor-pointer print:cursor-default`}
                              title="Click to change assignee"
                            >
                              {task.assignee}
                            </button>
                            {task.is_skeleton && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                                Key Task
                              </span>
                            )}
                            <span className="text-xs text-gray-500">Weight: {task.weight}</span>
                            {task.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            <button
                              onClick={() => handleTaskLockToggle(task)}
                              className={`ml-auto p-1 rounded transition-colors ${
                                task.locked
                                  ? 'text-orange-600 hover:bg-orange-100'
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title={task.locked ? 'Task locked (won\'t be recalculated)' : 'Click to lock task'}
                            >
                              {task.locked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {showUpdateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Update event date</h3>
              <p className="text-gray-600 mb-4">
                You changed the event date to <b>{pendingNewDate}</b>.<br/>
                This will update JS Live for job <b>{timeline?.event?.code}</b>. Continue?
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowUpdateConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmUpdateJsLive(false)}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update JS Live
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
