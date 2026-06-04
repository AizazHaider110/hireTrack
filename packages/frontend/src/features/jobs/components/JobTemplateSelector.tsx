import { useState } from 'react';
import { Search, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetJobTemplatesQuery } from '../jobApi';
import type { JobTemplate } from '../jobApi';

interface JobTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: JobTemplate) => void;
}

export function JobTemplateSelector({ open, onOpenChange, onSelect }: JobTemplateSelectorProps) {
  const [search, setSearch] = useState('');
  const { data: templates = [], isLoading } = useGetJobTemplatesQuery();

  const filtered = templates.filter((t) =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'No templates match your search' : 'No templates available'}
              </p>
            </div>
          ) : (
            filtered.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:shadow-sm hover:border-primary/50 transition-all group"
                onClick={() => { onSelect(template); onOpenChange(false); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{template.name}</p>
                        <Badge variant="outline" className="text-xs">{template.department}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{template.title}</p>
                      {template.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.skills.slice(0, 4).map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                          ))}
                          {template.skills.length > 4 && (
                            <Badge variant="outline" className="text-xs">+{template.skills.length - 4}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
