import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Calendar, MapPin, ChevronDown, ChevronUp, Eye, EyeOff, Printer, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProgressRing } from '../components/ProgressRing';
import { calculateBlockProgress, calculateTimelineProgress, calculateProgressByAssignee } from '../utils/progress';
import type { Timeline, Block, Task } from '../types';

export function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [shareLink, setShareLink] = useState<string>('');
  const [showBackground, setShowBackground] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['client', 'js', 'both']));

  useEffect(() => {
    if (id) {
      loadTimeline(id);
      loadShareLink(id);
    }
  }, [id]);

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

    const assignees = ['client', 'js', 'both'];
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

  const allTasks = timeline.blocks?.flatMap((block) => block.tasks || []) || [];
  const progress = timeline.blocks ? calculateTimelineProgress(timeline.blocks) : null;
  const progressByAssignee = calculateProgressByAssignee(allTasks);

  return (
    <div className="min-h-screen relative">
      {showBackground && timeline.background_url && (
        <>
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${timeline.background_url})` }}
          />
          <div className="fixed inset-0 bg-white/90 backdrop-blur-sm" />
        </>
      )}

      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors print:hidden"
          >
            <ArrowLeft size={20} />
            Back to Timelines
          </a>
          <div className="flex items-center gap-3 print:hidden">
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

        <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
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
            <div className="flex items-center gap-4 text-gray-600">
              {timeline.event?.date && (
                <div className="flex items-center gap-1">
                  <Calendar size={18} />
                  {new Date(timeline.event.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              )}
              {timeline.event?.venue && (
                <div className="flex items-center gap-1">
                  <MapPin size={18} />
                  {timeline.event.venue}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
              <ProgressRing percentage={progress?.percentage || 0} size={70} strokeWidth={7} />
              <div className="text-sm text-gray-600 text-center font-medium mt-2">
                Overall Progress
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {progress?.completedTasks} / {progress?.totalTasks} tasks
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 flex flex-col items-center">
              <ProgressRing percentage={progressByAssignee.client.percentage} size={70} strokeWidth={7} color="#3b82f6" />
              <div className="text-sm text-blue-700 text-center font-medium mt-2">
                Client Tasks
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {progressByAssignee.client.completedTasks} / {progressByAssignee.client.totalTasks} tasks
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 flex flex-col items-center">
              <ProgressRing percentage={progressByAssignee.js.percentage} size={70} strokeWidth={7} color="#a855f7" />
              <div className="text-sm text-purple-700 text-center font-medium mt-2">
                JustSeventy Tasks
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {progressByAssignee.js.completedTasks} / {progressByAssignee.js.totalTasks} tasks
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 flex flex-col items-center">
              <ProgressRing percentage={progressByAssignee.both.percentage} size={70} strokeWidth={7} color="#10b981" />
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
        </div>

        <div className="space-y-4">
          {timeline.blocks?.map((block) => {
            const blockProgress = block.tasks ? calculateBlockProgress(block.tasks) : null;
            const isExpanded = expandedBlocks.has(block.id);

            return (
              <div key={block.id} className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200">
                <button
                  onClick={() => toggleBlock(block.id)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {blockProgress && <ProgressRing percentage={blockProgress.percentage} />}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{block.title}</h3>
                      {blockProgress && (
                        <p className="text-sm text-gray-600 mt-1">
                          {blockProgress.completedTasks} of {blockProgress.totalTasks} tasks complete
                        </p>
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
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => handleTaskToggle(task)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className={`text-gray-900 ${task.done ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
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
    </div>
  );
}
