import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ReviewGeneratorStatus, ReviewGeneratorMode } from '@/types';
import {
  Search,
  Play,
  Square,
  Copy,
  FileDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  AlertTriangle,
  FileSearch,
  Zap,
  FileText,
} from 'lucide-react';

interface ReviewGeneratorProps {
  reviewStatus: ReviewGeneratorStatus;
  reviewOutput: string;
  reviewComplete: { report: string; output: string } | null;
  reviewError: string | null;
  onGenerateReview: (options: {
    mode: ReviewGeneratorMode;
    focusArea?: string;
    specFile?: string;
  }) => void;
  onCancelReview: () => void;
  onClearOutput: () => void;
}

const MODE_INFO: Record<ReviewGeneratorMode, { name: string; description: string; icon: typeof Search }> = {
  review: {
    name: 'Full Review',
    description: 'Comprehensive analysis - verifies all tasks and discovers technical debt',
    icon: Search,
  },
  'review-quick': {
    name: 'Quick Scan',
    description: 'Fast scan for TODOs, FIXMEs, and skipped tests only',
    icon: Zap,
  },
  'review-spec': {
    name: 'Spec Focus',
    description: 'Verify implementation against a specific spec file',
    icon: FileText,
  },
};

export function ReviewGenerator({
  reviewStatus,
  reviewOutput,
  reviewComplete,
  reviewError,
  onGenerateReview,
  onCancelReview,
  onClearOutput,
}: ReviewGeneratorProps) {
  const [mode, setMode] = useState<ReviewGeneratorMode>('review');
  const [focusArea, setFocusArea] = useState('');
  const [specFile, setSpecFile] = useState('');

  const handleGenerate = () => {
    if (mode === 'review-spec' && !specFile.trim()) return;

    onGenerateReview({
      mode,
      focusArea: focusArea.trim() || undefined,
      specFile: mode === 'review-spec' ? specFile.trim() : undefined,
    });
  };

  const handleCopyToClipboard = () => {
    const content = reviewComplete?.report || reviewOutput;
    navigator.clipboard.writeText(content);
  };

  const handleSaveReport = () => {
    const content = reviewComplete?.report || reviewOutput;
    if (content) {
      // This would be handled by the server to write to REVIEW_REPORT.md
      // For now, just copy to clipboard
      navigator.clipboard.writeText(content);
    }
  };

  const isGenerating = reviewStatus.generating;
  const hasOutput = reviewOutput.length > 0 || reviewComplete !== null;

  // Parse health score from output if available
  const parseHealthScore = (output: string): { completed: number; total: number } | null => {
    const match = output.match(/Health Score:\s*(\d+)\/(\d+)/);
    if (match) {
      return { completed: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
  };

  const healthScore = parseHealthScore(reviewComplete?.report || reviewOutput);

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Code Review Generator
          </CardTitle>
          <CardDescription>
            Analyze your codebase against documentation to identify what is actually functional
            vs what remains incomplete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Review Mode</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(MODE_INFO) as ReviewGeneratorMode[]).map((modeKey) => {
                const ModeIcon = MODE_INFO[modeKey].icon;
                return (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => setMode(modeKey)}
                    disabled={isGenerating}
                    className={`flex cursor-pointer flex-col rounded-lg border-2 bg-transparent p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      mode === modeKey ? 'border-primary' : 'border-muted'
                    }`}
                  >
                    <span className="font-semibold flex items-center gap-2">
                      <ModeIcon className="h-4 w-4" />
                      {MODE_INFO[modeKey].name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {MODE_INFO[modeKey].description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Focus Area (optional for all modes) */}
          <div className="space-y-2">
            <Label htmlFor="focusArea">Focus Area (optional)</Label>
            <Input
              id="focusArea"
              placeholder="e.g., 'Feature Set 5' or 'authentication' or 'dashboard components'"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Narrow the review to a specific area of the codebase
            </p>
          </div>

          {/* Spec File (for review-spec mode) */}
          {mode === 'review-spec' && (
            <div className="space-y-2">
              <Label htmlFor="specFile">Spec File</Label>
              <Input
                id="specFile"
                placeholder="e.g., '05-agent-installation.md'"
                value={specFile}
                onChange={(e) => setSpecFile(e.target.value)}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Name of the spec file in specs/ directory to verify against
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || (mode === 'review-spec' && !specFile.trim())}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Review
                </>
              )}
            </Button>
            {isGenerating && (
              <Button variant="destructive" onClick={onCancelReview} className="gap-2">
                <Square className="h-4 w-4" />
                Cancel
              </Button>
            )}

            {hasOutput && !isGenerating && (
              <Button variant="outline" onClick={onClearOutput} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Health Score Card (if available) */}
      {healthScore && !isGenerating && (
        <Card className={healthScore.completed === healthScore.total ? 'border-green-500' : 'border-yellow-500'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {healthScore.completed === healthScore.total ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                )}
                <div>
                  <h3 className="text-lg font-semibold">Health Score</h3>
                  <p className="text-sm text-muted-foreground">
                    {healthScore.completed === healthScore.total
                      ? 'All verified tasks are complete!'
                      : 'Some tasks need attention'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {healthScore.completed}/{healthScore.total}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Math.round((healthScore.completed / healthScore.total) * 100)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Output Section */}
      {(hasOutput || isGenerating || reviewError) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing Codebase...
                  </>
                ) : reviewError ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Error
                  </>
                ) : reviewComplete ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Review Complete
                  </>
                ) : (
                  'Output'
                )}
              </CardTitle>
              {reviewStatus.mode && (
                <Badge variant="secondary">
                  {MODE_INFO[reviewStatus.mode as ReviewGeneratorMode]?.name || reviewStatus.mode}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewError && (
              <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
                {reviewError}
              </div>
            )}

            {(reviewOutput || reviewComplete) && (
              <>
                <ScrollArea className="h-[400px] rounded-lg border bg-muted/30">
                  <pre className="whitespace-pre-wrap p-4 font-mono text-sm">
                    {reviewComplete?.report || reviewOutput}
                  </pre>
                </ScrollArea>

                {/* Action Buttons */}
                {!isGenerating && (
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveReport} className="gap-2">
                      <FileDown className="h-4 w-4" />
                      Save to REVIEW_REPORT.md
                    </Button>
                    <Button variant="outline" onClick={handleCopyToClipboard} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy to Clipboard
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            The Review Generator analyzes your codebase against its documentation to identify
            discrepancies between what's claimed as complete vs what's actually implemented.
          </p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Review Modes:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Full Review:</strong> Comprehensive verification of all tasks, discovery of
                technical debt, and spec compliance check
              </li>
              <li>
                <strong>Quick Scan:</strong> Fast scan for TODOs, FIXMEs, skipped tests, and other
                technical debt markers
              </li>
              <li>
                <strong>Spec Focus:</strong> Verify implementation against a specific spec file's
                acceptance criteria
              </li>
            </ul>
          </div>
          <p>
            The review outputs to REVIEW_REPORT.md which can be used to generate fix tasks
            by running the plan mode afterwards.
          </p>
          <p className="text-xs border-t pt-3 mt-3">
            CLI: <code className="bg-muted px-1 rounded">./loop.sh review</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
