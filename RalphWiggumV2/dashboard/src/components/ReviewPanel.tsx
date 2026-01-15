/**
 * ReviewPanel - LLM-as-Judge quality review interface
 *
 * Allows running quality reviews on text or visual artifacts
 * using Claude to evaluate against specified criteria.
 */

import { useState, useCallback } from 'react';
import type { ReviewConfig, ReviewResult, ReviewRunnerStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Square,
  FileText,
  Image,
  AlertCircle,
} from 'lucide-react';

interface ReviewPanelProps {
  status: ReviewRunnerStatus;
  output: string;
  result: ReviewResult | null;
  error: string | null;
  onRunReview: (config: ReviewConfig) => void;
  onCancel: () => void;
}

// Common review criteria presets
const CRITERIA_PRESETS = [
  {
    name: 'UX Clarity',
    criteria: 'The interface is clear, intuitive, and provides obvious next steps for users',
  },
  {
    name: 'Error Messaging',
    criteria: 'Error messages are user-friendly, specific, and provide actionable guidance',
  },
  {
    name: 'Visual Hierarchy',
    criteria: 'Layout demonstrates clear visual hierarchy with appropriate emphasis on key elements',
  },
  {
    name: 'Accessibility',
    criteria: 'Content follows accessibility best practices with proper contrast, labels, and focus states',
  },
  {
    name: 'Tone',
    criteria: 'The text uses a warm, professional tone appropriate for the target audience',
  },
  {
    name: 'Completeness',
    criteria: 'All required information is present and no placeholder content remains',
  },
];

export function ReviewPanel({
  status,
  output,
  result,
  error,
  onRunReview,
  onCancel,
}: ReviewPanelProps) {
  const [criteria, setCriteria] = useState('');
  const [artifact, setArtifact] = useState('');
  const [artifactType, setArtifactType] = useState<'text' | 'image'>('text');

  const handleRunReview = useCallback(() => {
    if (criteria.trim() && artifact.trim()) {
      onRunReview({
        criteria: criteria.trim(),
        artifact: artifact.trim(),
      });
    }
  }, [criteria, artifact, onRunReview]);

  const handlePresetClick = useCallback((preset: typeof CRITERIA_PRESETS[0]) => {
    setCriteria(preset.criteria);
  }, []);

  const isRunning = status.running;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Quality Review</h3>
        </div>
        {isRunning && (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        )}
      </div>

      {/* Criteria Input */}
      <div className="space-y-2">
        <Label htmlFor="criteria">Review Criteria</Label>
        <textarea
          id="criteria"
          className="w-full min-h-[80px] px-3 py-2 border rounded-md bg-background text-sm"
          placeholder="What should this artifact meet? (e.g., 'Uses warm, professional tone')"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          disabled={isRunning}
        />

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-1">
          {CRITERIA_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePresetClick(preset)}
              disabled={isRunning}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Artifact Type Toggle */}
      <div className="flex items-center gap-4">
        <Label>Artifact Type</Label>
        <div className="flex gap-2">
          <Button
            variant={artifactType === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setArtifactType('text')}
            disabled={isRunning}
          >
            <FileText className="h-4 w-4 mr-1" />
            Text
          </Button>
          <Button
            variant={artifactType === 'image' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setArtifactType('image')}
            disabled={isRunning}
          >
            <Image className="h-4 w-4 mr-1" />
            Image Path
          </Button>
        </div>
      </div>

      {/* Artifact Input */}
      <div className="space-y-2">
        <Label htmlFor="artifact">
          {artifactType === 'text' ? 'Text to Review' : 'Image Path'}
        </Label>
        {artifactType === 'text' ? (
          <textarea
            id="artifact"
            className="w-full min-h-[120px] px-3 py-2 border rounded-md bg-background text-sm font-mono"
            placeholder="Paste the text content to review..."
            value={artifact}
            onChange={(e) => setArtifact(e.target.value)}
            disabled={isRunning}
          />
        ) : (
          <input
            id="artifact"
            type="text"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            placeholder="./screenshots/dashboard.png"
            value={artifact}
            onChange={(e) => setArtifact(e.target.value)}
            disabled={isRunning}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isRunning ? (
          <Button variant="destructive" onClick={onCancel}>
            <Square className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        ) : (
          <Button
            onClick={handleRunReview}
            disabled={!criteria.trim() || !artifact.trim()}
          >
            <Play className="h-4 w-4 mr-2" />
            Run Review
          </Button>
        )}
      </div>

      {/* Output / Progress */}
      {output && (
        <div className="space-y-2">
          <Label>Review Output</Label>
          <ScrollArea className="h-[100px] rounded-md border p-2">
            <pre className="text-xs font-mono whitespace-pre-wrap">{output}</pre>
          </ScrollArea>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className={`p-4 rounded-md border ${
          result.pass
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {result.pass ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-500">PASS</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-500">FAIL</span>
              </>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <strong>Criteria:</strong> {result.criteria}
            </p>
            {result.feedback && (
              <p className="text-muted-foreground">
                <strong>Feedback:</strong> {result.feedback}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Reviewed: {new Date(result.reviewedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
