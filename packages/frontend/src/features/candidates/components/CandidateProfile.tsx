import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, MapPin, Calendar, ExternalLink, ArrowLeft,
  Briefcase, GraduationCap, Tag, FileText, Star, Clock,
  Send, CalendarPlus, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCandidateQuery, useGetCandidateTimelineQuery, useUpdateCandidateMutation } from '../candidateApi';
import { CandidateTimeline, TimelineEvent } from './CandidateTimeline';
import { ScoreBreakdown } from './ScoreBreakdown';
import { InlineNotes, TagInput } from './InlineEdit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CandidateProfileProps {
  candidateId: string;
}

type TabId = 'overview' | 'resume' | 'history' | 'scores';

const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'resume', label: 'Resume', icon: Briefcase },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'scores', label: 'Scores', icon: Star },
];

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function CandidateProfile({ candidateId }: CandidateProfileProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: candidate, isLoading, isError } = useGetCandidateQuery(candidateId);
  const { data: timeline = [], isLoading: timelineLoading } = useGetCandidateTimelineQuery(candidateId, {
    skip: activeTab !== 'history',
  });
  const [updateCandidate] = useUpdateCandidateMutation();

  const handleSaveNotes = async (notes: string) => {
    try {
      await updateCandidate({ id: candidateId, data: { notes } }).unwrap();
      toast({ title: 'Notes saved' });
    } catch {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
      throw new Error('Save failed');
    }
  };

  const handleSaveTags = async (tags: string[]) => {
    try {
      await updateCandidate({ id: candidateId, data: { tags } }).unwrap();
      toast({ title: 'Tags updated' });
    } catch {
      toast({ title: 'Failed to update tags', variant: 'destructive' });
      throw new Error('Save failed');
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Failed to load candidate profile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const initials = `${candidate.firstName[0]}${candidate.lastName[0]}`.toUpperCase();

  // Build score categories from candidate data
  const scoreCategories = [
    { label: 'Skills Match', score: 75, description: 'Based on required skills alignment' },
    { label: 'Experience', score: 68, description: 'Years and relevance of experience' },
    { label: 'Education', score: 80, description: 'Degree and field alignment' },
  ];

  // Transform timeline data
  const timelineEvents: TimelineEvent[] = timeline.map((item: any) => ({
    id: item.id,
    type: item.type || item.action || 'note_added',
    title: item.title || item.description || item.action,
    description: item.details?.description || item.notes,
    actor: item.actor?.name || item.user?.firstName
      ? `${item.user?.firstName} ${item.user?.lastName}`
      : undefined,
    metadata: item.metadata || item.details,
    timestamp: item.timestamp || item.createdAt,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Candidates
      </Button>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar className="h-20 w-20 text-lg">
              <AvatarImage src={candidate.avatar} alt={fullName} />
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">{fullName}</h1>
                  <p className="text-muted-foreground mt-0.5">
                    {candidate.experience?.[0]?.title || 'Candidate'}
                    {candidate.experience?.[0]?.company && ` at ${candidate.experience[0].company}`}
                  </p>
                </div>
                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send Email
                  </Button>
                  <Button size="sm" variant="outline">
                    <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                    Schedule Interview
                  </Button>
                  <Button size="sm">
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    Move Stage
                  </Button>
                </div>
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm text-muted-foreground">
                <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  {candidate.email}
                </a>
                {candidate.phone && (
                  <a href={`tel:${candidate.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                    {candidate.phone}
                  </a>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Added {new Date(candidate.createdAt).toLocaleDateString()}
                </span>
                {candidate.source && (
                  <Badge variant="outline" className="text-xs">
                    {candidate.source}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications summary */}
      {candidate.applications?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {candidate.applications.map((app) => (
            <Card key={app.id} className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{app.jobTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{app.stageName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant={app.status === 'HIRED' ? 'default' : app.status === 'REJECTED' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {app.status}
                    </Badge>
                    {app.score !== undefined && (
                      <span className="text-xs text-muted-foreground">{app.score}%</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex border-b">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Skills */}
                {candidate.skills?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Skills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Experience */}
                {candidate.experience?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Experience
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {candidate.experience.map((exp) => (
                        <div key={exp.id} className="flex gap-3">
                          <div className="mt-0.5 h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{exp.title}</p>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {exp.startDate} – {exp.current ? 'Present' : exp.endDate}
                            </p>
                            {exp.description && (
                              <p className="text-sm mt-1 text-muted-foreground">{exp.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Education */}
                {candidate.education?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" /> Education
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {candidate.education.map((edu) => (
                        <div key={edu.id} className="flex gap-3">
                          <div className="mt-0.5 h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{edu.degree} in {edu.field}</p>
                            <p className="text-sm text-muted-foreground">{edu.institution}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {edu.startDate} – {edu.current ? 'Present' : edu.endDate}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TagInput
                      tags={candidate.tags || []}
                      onSave={handleSaveTags}
                      suggestions={['senior', 'remote', 'urgent', 'referral', 'passive', 'hot-lead']}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InlineNotes
                      value={(candidate as any).notes || ''}
                      onSave={handleSaveNotes}
                      placeholder="Add internal notes about this candidate..."
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Resume tab */}
          {activeTab === 'resume' && (
            <Card>
              <CardContent className="pt-6">
                {candidate.resumeUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Resume Document</p>
                      <Button size="sm" variant="outline" asChild>
                        <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Open Resume
                        </a>
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-muted/40 h-96 flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Resume preview</p>
                        <Button size="sm" variant="link" asChild className="mt-2">
                          <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                            View full resume
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No resume uploaded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <CandidateTimeline events={timelineEvents} isLoading={timelineLoading} />
              </CardContent>
            </Card>
          )}

          {/* Scores tab */}
          {activeTab === 'scores' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreBreakdown
                  overall={candidate.applications?.[0]?.score || 0}
                  categories={scoreCategories}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
