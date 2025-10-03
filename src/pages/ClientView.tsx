import { useEffect, useState } from 'react';
import { Calendar, MapPin, ChevronDown, ChevronUp, Eye, EyeOff, Printer, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProgressRing } from '../components/ProgressRing';
import { calculateBlockProgress, calculateTimelineProgress, calculateProgressByAssignee } from '../utils/progress';
import { BRAND, detectBackgroundBrightness } from '../config/brand';
import themes, { type ThemeKey } from '../lib/themes';
import type { Timeline, Task } from '../types';

export function ClientView() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [showBackground, setShowBackground] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['client', 'js', 'both']));
  const [logoSrc, setLogoSrc] = useState(BRAND.logoDark);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setError('Invalid or missing token');
      setLoading(false);
      return;
    }

    loadTimelineByToken(token);
  }, []);

  async function loadTimelineByToken(token: string) {
    try {
      const { data: shareLink, error: shareLinkError } = await supabase
        .from('share_links')
        .select('timeline_id, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (shareLinkError) throw shareLinkError;

      if (!shareLink) {
        setError('Invalid or expired link');
        setLoading(false);
        return;
      }

      if (new Date(shareLink.expires_at) < new Date()) {
        setError('This link has expired');
        setLoading(false);
        return;
      }

      const { data, error: timelineError } = await supabase
        .from('timelines')
        .select(`
          *,
          event:events(*),
          blocks(
            *,
            tasks(*)
          )
        `)
        .eq('id', shareLink.timeline_id)
        .single();

      if (timelineError) throw timelineError;

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

      if (data.background_url) {
        detectBackgroundBrightness(data.background_url).then((isBright) => {
          setLogoSrc(isBright ? BRAND.logoDark : BRAND.logoLight);
        });
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
      setError('Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }

  async function handleTaskToggle(task: Task) {
    if (!timeline || task.assignee === 'js') return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          done: !task.done,
          done_at: !task.done ? new Date().toISOString() : null,
          done_by: !task.done ? 'client' : null,
        })
        .eq('id', task.id);

      if (error) throw error;

      await supabase.from('audit_entries').insert({
        timeline_id: timeline.id,
        task_id: task.id,
        action: !task.done ? 'check' : 'uncheck',
        actor: 'client',
        changes: { done: { from: task.done, to: !task.done } },
      });

      if (timeline.blocks) {
        setTimeline({
          ...timeline,
          blocks: timeline.blocks.map((block) => ({
            ...block,
            tasks: block.tasks?.map((t) =>
              t.id === task.id ? { ...t, done: !t.done } : t
            ),
          })),
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
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

  function getAssigneeColor(assignee: string): string {
    switch (assignee) {
      case 'client':
        return 'bg-blue-100 text-blue-700';
      case 'js':
        return 'bg-purple-100 text-purple-700';
      case 'both':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function isTaskVisible(task: Task): boolean {
    return activeFilters.has(task.assignee);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading your timeline...</div>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error || 'Timeline not found'}</p>
        </div>
      </div>
    );
  }

  const allTasks = timeline.blocks?.flatMap((block) => block.tasks || []) || [];
  const progress = timeline.blocks ? calculateTimelineProgress(timeline.blocks) : null;
  const progressByAssignee = calculateProgressByAssignee(allTasks);

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
        <header className="client-header flex flex-col items-center py-6 px-4">
          <img
            id="client-logo"
            src={logoSrc}
            alt={BRAND.name}
            className="h-8 w-auto mb-3"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-end gap-3 mb-4 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white transition-colors shadow-sm border border-gray-200"
            >
              <Printer size={18} />
              Print Timeline
            </button>
            <button
              onClick={() => setShowBackground(!showBackground)}
              className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white transition-colors shadow-sm border border-gray-200"
            >
              {showBackground ? <EyeOff size={18} /> : <Eye size={18} />}
              {showBackground ? 'Hide' : 'Show'} Background
            </button>
          </div>

          <div className="block-card p-8 mb-6 border border-gray-200">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                  {timeline.event?.code}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                  {timeline.template_key.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {timeline.event?.title}
              </h1>
              <div className="flex items-center gap-4 text-gray-600">
                {timeline.event?.date && (
                  <div className="flex items-center gap-2">
                    <Calendar size={20} />
                    <span className="font-medium">
                      {new Date(timeline.event.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {timeline.event?.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin size={20} />
                    <span className="font-medium">{timeline.event.venue}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
                <ProgressRing percentage={progress?.percentage || 0} size={80} strokeWidth={8} />
                <div className="text-sm text-gray-600 text-center font-medium mt-2">
                  Overall Progress
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {progress?.completedTasks} / {progress?.totalTasks} tasks
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 flex flex-col items-center">
                <ProgressRing percentage={progressByAssignee.client.percentage} size={80} strokeWidth={8} color="#3b82f6" />
                <div className="text-sm text-blue-700 text-center font-medium mt-2">
                  Client Tasks
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {progressByAssignee.client.completedTasks} / {progressByAssignee.client.totalTasks} tasks
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 flex flex-col items-center">
                <ProgressRing percentage={progressByAssignee.js.percentage} size={80} strokeWidth={8} color="#a855f7" />
                <div className="text-sm text-purple-700 text-center font-medium mt-2">
                  JustSeventy Tasks
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  {progressByAssignee.js.completedTasks} / {progressByAssignee.js.totalTasks} tasks
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 flex flex-col items-center">
                <ProgressRing percentage={progressByAssignee.both.percentage} size={80} strokeWidth={8} color="#10b981" />
                <div className="text-sm text-green-700 text-center font-medium mt-2">
                  Joint Tasks
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {progressByAssignee.both.completedTasks} / {progressByAssignee.both.totalTasks} tasks
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
                  onClick={() => toggleFilter('both')}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    activeFilters.has('both')
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-gray-100 text-gray-400 border-2 border-transparent'
                  }`}
                >
                  Both
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> You can check off tasks assigned to you (marked as "client" or "both").
                Tasks marked "js\" are managed by JustSeventy.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {timeline.blocks?.map((block) => {
              const blockProgress = block.tasks ? calculateBlockProgress(block.tasks) : null;
              const isExpanded = expandedBlocks.has(block.id);

              return (
                <div key={block.id} className="block-card border border-gray-200">
                  <button
                    onClick={() => toggleBlock(block.id)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {blockProgress && <ProgressRing percentage={blockProgress.percentage} size={70} />}
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{block.title}</h3>
                        {blockProgress && (
                          <p className="text-sm text-gray-600 mt-1">
                            {blockProgress.completedTasks} of {blockProgress.totalTasks} tasks complete
                          </p>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </button>

                  {isExpanded && block.tasks && (
                    <div className="px-6 pb-6 space-y-3">
                      {block.tasks.filter(isTaskVisible).map((task) => {
                        const canToggle = task.assignee === 'client' || task.assignee === 'both';

                        return (
                          <div
                            key={task.id}
                            className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => handleTaskToggle(task)}
                              disabled={!canToggle}
                              className={`mt-1 w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                                canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                              }`}
                            />
                            <div className="flex-1">
                              <p className={`text-gray-900 font-medium ${task.done ? 'line-through opacity-60' : ''}`}>
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getAssigneeColor(task.assignee)}`}>
                                  {task.assignee}
                                </span>
                                {task.is_skeleton && (
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700">
                                    Key Task
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center text-gray-600 text-sm">
            <p>Powered by JustSeventy Event Planning</p>
          </div>
        </div>
      </div>
    </div>
  );
}
