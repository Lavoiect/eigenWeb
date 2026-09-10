import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleCheckBig,
    CircleX,
    ImageIcon,
    RefreshCw,
    Shuffle,
    Video,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { sanitizeRichTextHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

type LessonBlock = {
    id: string;
    type: string;
    [key: string]: unknown;
};

type LessonDraft = {
    id: number;
    title: string;
    slug: string;
    body: string;
    position: number;
    duration_minutes: string;
    is_final_assessment: boolean;
    status: 'draft' | 'published';
    published_at: string;
    content: LessonBlock[];
};

type Stage = 'start' | 'running' | 'lesson_complete' | 'complete';

type CourseRunSnapshot = {
    version: 1;
    stage: Stage;
    lessonId: number | null;
    blockId: string | null;
    pendingLessonId: number | null;
    questionResults: Record<string, boolean>;
    completedLessonIds: number[];
    savedAt: string;
};

type FeedbackState =
    | {
          variant: 'neutral';
          message: string | null;
      }
    | {
          variant: 'success' | 'error';
          message: string;
      };

type Props = {
    courseTitle: string;
    courseDescription: string | null;
    learningObjectives: string[];
    passingScore: number | null;
    estimatedMinutes: number | null;
    lessons: LessonDraft[];
    startLessonId: number | null;
    onClose: () => void;
};

function LessonImage({ block }: { block: LessonBlock }) {
    const url = String(block.url ?? '').trim();
    const alt =
        String(block.alt ?? '').trim() ||
        String(block.caption ?? '').trim() ||
        'Lesson image';
    const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const isLoaded = loadedUrl === url;

    if (!url || failedUrl === url) {
        return (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-slate-50 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                    <ImageIcon className="size-6" />
                </span>
                <div>
                    <p className="text-sm font-semibold text-slate-800">
                        {url
                            ? 'This image could not be loaded'
                            : 'No image added'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {url
                            ? 'Check that the image link is public and try again.'
                            : 'Add an image URL in the course editor.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border bg-slate-50 p-2">
            {!isLoaded && (
                <div className="absolute inset-0 animate-pulse bg-slate-100" />
            )}
            <img
                src={url}
                alt={alt}
                className={cn(
                    'relative max-h-[32rem] max-w-full rounded-xl object-contain transition-opacity duration-300',
                    isLoaded ? 'opacity-100' : 'opacity-0',
                )}
                referrerPolicy="no-referrer"
                onLoad={() => setLoadedUrl(url)}
                onError={() => setFailedUrl(url)}
            />
        </div>
    );
}

function shuffle<T>(items: T[]): T[] {
    const next = [...items];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex) {
        return [...items];
    }

    const next = [...items];
    const [spliced] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, spliced);

    return next;
}

function blockLabel(type: string): string {
    switch (type) {
        case 'text':
            return 'Text';
        case 'image':
            return 'Image';
        case 'video':
            return 'Video';
        case 'document':
            return 'File or resource';
        case 'callout':
            return 'Callout';
        case 'multiple_choice':
            return 'Multiple Choice';
        case 'true_false':
            return 'True / False';
        case 'ordering':
            return 'Ordering';
        case 'matching':
            return 'Matching';
        case 'scenario':
            return 'Scenario';
        default:
            return 'Activity';
    }
}

function getVisibleBody(lesson: LessonDraft): string {
    return (
        lesson.body.trim() ||
        'Start the test run to experience the lesson as a learner would.'
    );
}

const gradedBlockTypes = new Set([
    'multiple_choice',
    'true_false',
    'ordering',
    'matching',
]);

function isGradedBlock(block: LessonBlock): boolean {
    return gradedBlockTypes.has(block.type);
}

function courseRunStorageKey(
    courseTitle: string,
    lessons: LessonDraft[],
    startLessonId: number | null,
): string {
    const lessonSignature = lessons
        .map((lesson) => `${lesson.id}:${lesson.slug}:${lesson.position}`)
        .join('|');

    return `course-test-runner:${encodeURIComponent(courseTitle)}:${startLessonId ?? 'none'}:${lessonSignature}`;
}

function findLessonIndexById(
    lessons: LessonDraft[],
    lessonId: number | null,
): number | null {
    if (lessonId === null) {
        return null;
    }

    const index = lessons.findIndex((lesson) => lesson.id === lessonId);

    return index >= 0 ? index : null;
}

function getBlockIndexById(
    lesson: LessonDraft | null,
    blockId: string | null,
): number {
    if (!lesson || blockId === null) {
        return -1;
    }

    const index = lesson.content.findIndex((block) => block.id === blockId);

    return index >= 0 ? index : -1;
}

function readSavedRun(key: string): CourseRunSnapshot | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(key);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<CourseRunSnapshot>;

        if (parsed.version !== 1) {
            return null;
        }

        return {
            version: 1,
            stage:
                parsed.stage === 'start' ||
                parsed.stage === 'running' ||
                parsed.stage === 'lesson_complete' ||
                parsed.stage === 'complete'
                    ? parsed.stage
                    : 'start',
            lessonId:
                typeof parsed.lessonId === 'number' ? parsed.lessonId : null,
            blockId: typeof parsed.blockId === 'string' ? parsed.blockId : null,
            pendingLessonId:
                typeof parsed.pendingLessonId === 'number'
                    ? parsed.pendingLessonId
                    : null,
            questionResults:
                parsed.questionResults &&
                typeof parsed.questionResults === 'object'
                    ? Object.fromEntries(
                          Object.entries(parsed.questionResults).map(
                              ([id, result]) => [id, Boolean(result)],
                          ),
                      )
                    : {},
            completedLessonIds: Array.isArray(parsed.completedLessonIds)
                ? parsed.completedLessonIds.filter(
                      (value): value is number => typeof value === 'number',
                  )
                : [],
            savedAt:
                typeof parsed.savedAt === 'string'
                    ? parsed.savedAt
                    : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function writeSavedRun(key: string, snapshot: CourseRunSnapshot): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
        // Ignore storage quota and private browsing failures.
    }
}

function clearSavedRun(key: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore storage failures.
    }
}

type ResetBlockStateArgs = {
    stage: Stage;
    block: LessonBlock | null;
    setFeedback: React.Dispatch<React.SetStateAction<FeedbackState>>;
    setSelectedChoice: React.Dispatch<React.SetStateAction<number | null>>;
    setSelectedTrueFalse: React.Dispatch<React.SetStateAction<boolean | null>>;
    setOrdering: React.Dispatch<React.SetStateAction<string[]>>;
    setMatchingSelections: React.Dispatch<
        React.SetStateAction<Record<string, string>>
    >;
    setMatchingOptions: React.Dispatch<React.SetStateAction<string[]>>;
};

function resetCurrentBlockState({
    stage,
    block,
    setFeedback,
    setSelectedChoice,
    setSelectedTrueFalse,
    setOrdering,
    setMatchingSelections,
    setMatchingOptions,
}: ResetBlockStateArgs) {
    setFeedback({ variant: 'neutral', message: null });
    setSelectedChoice(null);
    setSelectedTrueFalse(null);
    setOrdering([]);
    setMatchingSelections({});
    setMatchingOptions([]);

    if (!block || stage !== 'running') {
        return;
    }

    if (block.type === 'ordering') {
        const items = Array.isArray(block.items)
            ? block.items
                  .map((item) => String(item ?? '').trim())
                  .filter(Boolean)
            : [];
        setOrdering(shuffle(items));
    }

    if (block.type === 'matching') {
        const pairs = Array.isArray(block.pairs) ? block.pairs : [];
        setMatchingOptions(
            shuffle(
                pairs
                    .map((pair) => String(pair?.right ?? '').trim())
                    .filter(Boolean),
            ),
        );
    }
}

export default function CourseTestRunner({
    courseTitle,
    courseDescription,
    learningObjectives,
    passingScore,
    estimatedMinutes,
    lessons,
    startLessonId,
    onClose,
}: Props) {
    const storageKey = useMemo(
        () => courseRunStorageKey(courseTitle, lessons, startLessonId),
        [courseTitle, lessons, startLessonId],
    );
    const startingLessonIndex = useMemo(() => {
        if (startLessonId === null) {
            return 0;
        }

        const index = lessons.findIndex(
            (lesson) => lesson.id === startLessonId,
        );

        return index >= 0 ? index : 0;
    }, [lessons, startLessonId]);

    const [stage, setStage] = useState<Stage>('start');
    const [lessonIndex, setLessonIndex] = useState(startingLessonIndex);
    const [blockIndex, setBlockIndex] = useState(-1);
    const [pendingLessonIndex, setPendingLessonIndex] = useState<number | null>(
        null,
    );
    const [feedback, setFeedback] = useState<FeedbackState>({
        variant: 'neutral',
        message: null,
    });
    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [selectedTrueFalse, setSelectedTrueFalse] = useState<boolean | null>(
        null,
    );
    const [ordering, setOrdering] = useState<string[]>([]);
    const [matchingSelections, setMatchingSelections] = useState<
        Record<string, string>
    >({});
    const [matchingOptions, setMatchingOptions] = useState<string[]>([]);
    const [questionResults, setQuestionResults] = useState<
        Record<string, boolean>
    >({});
    const [completedLessonIds, setCompletedLessonIds] = useState<number[]>([]);
    const [isProgressLoaded, setIsProgressLoaded] = useState(false);

    const currentLesson = lessons[lessonIndex] ?? null;
    const currentBlock = currentLesson?.content[blockIndex] ?? null;
    const nextLesson =
        pendingLessonIndex !== null
            ? (lessons[pendingLessonIndex] ?? null)
            : null;

    const totalSteps = useMemo(
        () =>
            lessons.reduce(
                (total, lesson) => total + 2 + lesson.content.length,
                1,
            ),
        [lessons],
    );

    const currentStep = useMemo(() => {
        if (stage === 'start') {
            return 0;
        }

        if (stage === 'complete') {
            return totalSteps;
        }

        const lessonOffset = lessons
            .slice(0, lessonIndex)
            .reduce((total, lesson) => total + 2 + lesson.content.length, 1);

        return (
            lessonOffset +
            1 +
            Math.max(0, blockIndex + 1) +
            (stage === 'lesson_complete' ? 1 : 0)
        );
    }, [blockIndex, lessonIndex, lessons, stage, totalSteps]);

    const progressPercent = Math.round(
        (currentStep / Math.max(1, totalSteps)) * 100,
    );

    const scoredQuestionIds = useMemo(() => {
        const hasFinalAssessment = lessons.some(
            (lesson) => lesson.is_final_assessment,
        );

        return new Set(
            lessons
                .filter(
                    (lesson) =>
                        !hasFinalAssessment || lesson.is_final_assessment,
                )
                .flatMap((lesson) =>
                    lesson.content
                        .filter((block) => isGradedBlock(block))
                        .map((block) => block.id),
                ),
        );
    }, [lessons]);
    const answeredQuestionCount = useMemo(
        () =>
            Object.keys(questionResults).filter((questionId) =>
                scoredQuestionIds.has(questionId),
            ).length,
        [questionResults, scoredQuestionIds],
    );
    const correctQuestionCount = useMemo(
        () =>
            Object.entries(questionResults).filter(
                ([questionId, correct]) =>
                    correct && scoredQuestionIds.has(questionId),
            ).length,
        [questionResults, scoredQuestionIds],
    );
    const scorePercent = useMemo(() => {
        if (answeredQuestionCount === 0) {
            return null;
        }

        return Math.round((correctQuestionCount / answeredQuestionCount) * 100);
    }, [answeredQuestionCount, correctQuestionCount]);
    const passingScoreReached =
        passingScore !== null && scorePercent !== null
            ? scorePercent >= passingScore
            : null;
    const completedLessonCount = completedLessonIds.length;
    const totalGradedQuestions = scoredQuestionIds.size;

    useEffect(() => {
        if (isProgressLoaded) {
            return;
        }

        const saved = readSavedRun(storageKey);
        const timer = window.setTimeout(() => {
            if (saved) {
                const restoredLessonIndex =
                    findLessonIndexById(lessons, saved.lessonId) ??
                    startingLessonIndex;
                const restoredLesson = lessons[restoredLessonIndex] ?? null;
                const restoredBlockIndex = getBlockIndexById(
                    restoredLesson,
                    saved.blockId,
                );

                setStage(saved.stage);
                setLessonIndex(restoredLessonIndex);
                setBlockIndex(
                    saved.stage === 'running' ||
                        saved.stage === 'lesson_complete'
                        ? restoredBlockIndex
                        : -1,
                );
                setPendingLessonIndex(
                    findLessonIndexById(lessons, saved.pendingLessonId),
                );
                setQuestionResults(saved.questionResults);
                setCompletedLessonIds(saved.completedLessonIds);
            }

            setIsProgressLoaded(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [isProgressLoaded, lessons, startingLessonIndex, storageKey]);

    useEffect(() => {
        if (!isProgressLoaded) {
            return;
        }

        const currentLessonId = currentLesson?.id ?? null;
        const currentBlockId =
            currentBlock && stage !== 'start' ? currentBlock.id : null;

        writeSavedRun(storageKey, {
            version: 1,
            stage,
            lessonId: currentLessonId,
            blockId: currentBlockId,
            pendingLessonId:
                pendingLessonIndex !== null
                    ? (lessons[pendingLessonIndex]?.id ?? null)
                    : null,
            questionResults,
            completedLessonIds,
            savedAt: new Date().toISOString(),
        });
    }, [
        completedLessonIds,
        currentBlock,
        currentLesson,
        isProgressLoaded,
        lessons,
        pendingLessonIndex,
        questionResults,
        stage,
        storageKey,
    ]);

    useEffect(() => {
        if (stage !== 'running') {
            return;
        }

        resetCurrentBlockState({
            stage,
            block: currentBlock,
            setFeedback,
            setSelectedChoice,
            setSelectedTrueFalse,
            setOrdering,
            setMatchingSelections,
            setMatchingOptions,
        });
    }, [currentBlock, stage]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const finishLesson = (nextIndex: number | null) => {
        if (currentLesson) {
            setCompletedLessonIds((current) =>
                current.includes(currentLesson.id)
                    ? current
                    : [...current, currentLesson.id],
            );
        }

        setPendingLessonIndex(nextIndex);
        setStage('lesson_complete');
    };

    const goToNextStep = () => {
        if (stage === 'start') {
            setStage('running');
            setLessonIndex(startingLessonIndex);
            setBlockIndex(-1);
            setPendingLessonIndex(null);

            return;
        }

        if (stage === 'lesson_complete') {
            if (pendingLessonIndex !== null) {
                setLessonIndex(pendingLessonIndex);
                setBlockIndex(-1);
                setPendingLessonIndex(null);
                setStage('running');

                return;
            }

            setStage('complete');

            return;
        }

        if (stage === 'complete') {
            return;
        }

        if (!currentLesson) {
            setStage('complete');

            return;
        }

        if (blockIndex < currentLesson.content.length - 1) {
            setBlockIndex(blockIndex + 1);

            return;
        }

        const nextLessonIndex = lessonIndex + 1;

        if (nextLessonIndex < lessons.length) {
            finishLesson(nextLessonIndex);

            return;
        }

        finishLesson(null);
    };

    const goBack = () => {
        if (stage === 'lesson_complete') {
            setStage('running');

            if (currentLesson) {
                setBlockIndex(Math.max(currentLesson.content.length - 1, -1));
            }

            return;
        }

        if (stage !== 'running') {
            return;
        }

        if (blockIndex > -1) {
            setBlockIndex(blockIndex - 1);

            return;
        }

        const previousLessonIndex = lessonIndex - 1;

        if (previousLessonIndex >= 0) {
            const previousLesson = lessons[previousLessonIndex];
            setLessonIndex(previousLessonIndex);
            setBlockIndex(previousLesson.content.length - 1);
        }
    };

    const checkMultipleChoice = () => {
        if (!currentBlock || selectedChoice === null) {
            return;
        }

        const correctIndex = Number(currentBlock.correct_index ?? 0);
        const isCorrect = selectedChoice === correctIndex;
        setQuestionResults((current) => ({
            ...current,
            [currentBlock.id]: isCorrect,
        }));

        setFeedback({
            variant: isCorrect ? 'success' : 'error',
            message: isCorrect
                ? String(currentBlock.correct_feedback ?? '').trim() ||
                  'Correct. Nice work.'
                : String(currentBlock.incorrect_feedback ?? '').trim() ||
                  'Not quite. Review the prompt and try again.',
        });
    };

    const checkTrueFalse = () => {
        if (!currentBlock || selectedTrueFalse === null) {
            return;
        }

        const isCorrect =
            selectedTrueFalse === Boolean(currentBlock.correct_answer ?? true);
        setQuestionResults((current) => ({
            ...current,
            [currentBlock.id]: isCorrect,
        }));

        setFeedback({
            variant: isCorrect ? 'success' : 'error',
            message: isCorrect
                ? String(currentBlock.correct_feedback ?? '').trim() ||
                  'Correct.'
                : String(currentBlock.incorrect_feedback ?? '').trim() ||
                  'Not quite. Try again.',
        });
    };

    const checkOrdering = () => {
        if (!currentBlock) {
            return;
        }

        const correctOrdering = Array.isArray(currentBlock.items)
            ? currentBlock.items
                  .map((item) => String(item ?? '').trim())
                  .filter(Boolean)
            : [];
        const isCorrect =
            correctOrdering.length === ordering.length &&
            correctOrdering.every((item, index) => item === ordering[index]);
        setQuestionResults((current) => ({
            ...current,
            [currentBlock.id]: isCorrect,
        }));

        setFeedback({
            variant: isCorrect ? 'success' : 'error',
            message: isCorrect
                ? 'Correct order. Great work.'
                : 'That order is off. Revisit the sequence and try again.',
        });
    };

    const checkMatching = () => {
        if (!currentBlock) {
            return;
        }

        const pairs = Array.isArray(currentBlock.pairs)
            ? currentBlock.pairs
            : [];
        const isCorrect = pairs.every((pair) => {
            const left = String(pair?.left ?? '').trim();
            const right = String(pair?.right ?? '').trim();

            return matchingSelections[left] === right;
        });
        setQuestionResults((current) => ({
            ...current,
            [currentBlock.id]: isCorrect,
        }));

        setFeedback({
            variant: isCorrect ? 'success' : 'error',
            message: isCorrect
                ? 'Perfect match. Nice job.'
                : 'Some matches are still off. Take another pass.',
        });
    };

    const restart = () => {
        clearSavedRun(storageKey);
        setStage('start');
        setLessonIndex(startingLessonIndex);
        setBlockIndex(-1);
        setPendingLessonIndex(null);
        setFeedback({ variant: 'neutral', message: null });
        setSelectedChoice(null);
        setSelectedTrueFalse(null);
        setOrdering([]);
        setMatchingSelections({});
        setMatchingOptions([]);
        setQuestionResults({});
        setCompletedLessonIds([]);
    };

    const renderCurrentBlock = () => {
        if (!currentBlock) {
            return (
                <div className="space-y-4 rounded-3xl border border-dashed p-6 text-center">
                    <div className="text-sm font-medium">Lesson ready</div>
                    <p className="text-sm text-muted-foreground">
                        Start this lesson to move into the first activity.
                    </p>
                    <Button onClick={goToNextStep} className="w-full">
                        Start lesson
                    </Button>
                </div>
            );
        }

        switch (currentBlock.type) {
            case 'text': {
                const richText = String(currentBlock.rich_text ?? '').trim();

                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                Text
                            </div>
                            <Badge variant="outline">Read</Badge>
                        </div>
                        <div className="rounded-2xl border-l-4 border-primary/80 bg-slate-50 p-4">
                            {richText ? (
                                <div
                                    className="text-sm leading-6 text-slate-900 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
                                    dangerouslySetInnerHTML={{
                                        __html: sanitizeRichTextHtml(richText),
                                    }}
                                />
                            ) : (
                                <p className="text-sm leading-6 text-slate-900">
                                    {String(currentBlock.text ?? '').trim() ||
                                        getVisibleBody(
                                            currentLesson ??
                                                lessons[lessonIndex],
                                        )}
                                </p>
                            )}
                        </div>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            }
            case 'callout': {
                const style = String(currentBlock.style ?? 'information');
                const styles = {
                    information: {
                        label: 'Information',
                        className:
                            'border-sky-200 border-l-sky-500 bg-sky-50 text-sky-950',
                    },
                    tip: {
                        label: 'Tip',
                        className:
                            'border-emerald-200 border-l-emerald-500 bg-emerald-50 text-emerald-950',
                    },
                    warning: {
                        label: 'Warning',
                        className:
                            'border-amber-200 border-l-amber-500 bg-amber-50 text-amber-950',
                    },
                    stop: {
                        label: 'Stop and escalate',
                        className:
                            'border-rose-200 border-l-rose-500 bg-rose-50 text-rose-950',
                    },
                } as const;
                const calloutStyle =
                    styles[style as keyof typeof styles] ?? styles.information;

                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Callout
                        </div>
                        <div
                            className={cn(
                                'rounded-2xl border border-l-4 p-4',
                                calloutStyle.className,
                            )}
                        >
                            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase">
                                {calloutStyle.label}
                            </div>
                            <p className="mt-2 text-sm leading-6">
                                {String(currentBlock.text ?? '').trim() ||
                                    'Callout message'}
                            </p>
                        </div>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            }
            case 'image':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Image
                        </div>
                        <LessonImage block={currentBlock} />
                        {String(currentBlock.caption ?? '').trim() && (
                            <p className="px-1 text-sm leading-6 text-muted-foreground">
                                {String(currentBlock.caption).trim()}
                            </p>
                        )}
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            case 'video':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                Video
                            </div>
                            <Badge variant="outline">Watch</Badge>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-inner">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
                                    <Video className="size-5 text-white/80" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">
                                        {String(
                                            currentBlock.caption ?? '',
                                        ).trim() || 'Video preview'}
                                    </div>
                                    <div className="mt-1 text-xs text-white/60">
                                        {String(
                                            currentBlock.url ?? '',
                                        ).trim() ||
                                            'Paste a video URL in the builder.'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                                <span>
                                    Tap continue after reviewing the clip.
                                </span>
                                <span>Video</span>
                            </div>
                        </div>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            case 'document':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                Document
                            </div>
                            <Badge variant="outline">Open</Badge>
                        </div>
                        <div className="rounded-2xl border bg-slate-50 p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                    <BookOpen className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="text-sm font-medium">
                                        {String(
                                            currentBlock.title ?? '',
                                        ).trim() || 'Job aid'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {String(
                                            currentBlock.description ??
                                                currentBlock.url ??
                                                '',
                                        ).trim() ||
                                            'Reference material for learners.'}
                                    </div>
                                    <div className="text-[11px] break-all text-muted-foreground">
                                        {String(
                                            currentBlock.url ?? '',
                                        ).trim() || 'No file attached yet.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            case 'multiple_choice':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Multiple Choice
                        </div>
                        <p className="text-sm leading-6 font-medium text-slate-900">
                            {String(currentBlock.prompt ?? '').trim() ||
                                'Question prompt'}
                        </p>
                        <div className="space-y-2">
                            {(Array.isArray(currentBlock.choices)
                                ? currentBlock.choices
                                : []
                            ).map((choice, index) => (
                                <label
                                    key={`${currentBlock.id}-choice-${index}`}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition',
                                        selectedChoice === index
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 bg-white hover:border-slate-300',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        checked={selectedChoice === index}
                                        onChange={() =>
                                            setSelectedChoice(index)
                                        }
                                    />
                                    <span>
                                        {String(choice ?? '').trim() ||
                                            `Choice ${index + 1}`}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {feedback.message && (
                            <div
                                className={cn(
                                    'rounded-2xl border p-3 text-sm',
                                    feedback.variant === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                        : feedback.variant === 'error'
                                          ? 'border-rose-200 bg-rose-50 text-rose-950'
                                          : 'border-slate-200 bg-slate-50',
                                )}
                            >
                                {feedback.message}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                className="flex-1"
                                onClick={checkMultipleChoice}
                                variant="outline"
                            >
                                <CheckCircle2 className="size-4" />
                                Check answer
                            </Button>
                            <Button className="flex-1" onClick={goToNextStep}>
                                Continue
                            </Button>
                        </div>
                    </div>
                );
            case 'true_false':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            True / False
                        </div>
                        <p className="text-sm leading-6 font-medium text-slate-900">
                            {String(currentBlock.statement ?? '').trim() ||
                                'Statement'}
                        </p>
                        <div className="space-y-2">
                            {[true, false].map((choice) => (
                                <button
                                    key={String(choice)}
                                    type="button"
                                    onClick={() => setSelectedTrueFalse(choice)}
                                    className={cn(
                                        'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition',
                                        selectedTrueFalse === choice
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 bg-white hover:border-slate-300',
                                    )}
                                >
                                    <span>{choice ? 'True' : 'False'}</span>
                                    {selectedTrueFalse === choice && (
                                        <CircleCheckBig className="size-4 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                        {feedback.message && (
                            <div
                                className={cn(
                                    'rounded-2xl border p-3 text-sm',
                                    feedback.variant === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                        : 'border-rose-200 bg-rose-50 text-rose-950',
                                )}
                            >
                                {feedback.message}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                className="flex-1"
                                onClick={checkTrueFalse}
                                variant="outline"
                            >
                                <CheckCircle2 className="size-4" />
                                Check answer
                            </Button>
                            <Button className="flex-1" onClick={goToNextStep}>
                                Continue
                            </Button>
                        </div>
                    </div>
                );
            case 'ordering':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Ordering
                        </div>
                        <p className="text-sm leading-6 font-medium text-slate-900">
                            {String(currentBlock.prompt ?? '').trim() ||
                                'Put these steps in order'}
                        </p>
                        <div className="space-y-2">
                            {ordering.map((item, index) => (
                                <div
                                    key={`${currentBlock.id}-${item}-${index}`}
                                    className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm"
                                >
                                    <span>{item}</span>
                                    <div className="flex gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={index === 0}
                                            onClick={() =>
                                                setOrdering(
                                                    moveItem(
                                                        ordering,
                                                        index,
                                                        index - 1,
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronUp className="size-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={
                                                index === ordering.length - 1
                                            }
                                            onClick={() =>
                                                setOrdering(
                                                    moveItem(
                                                        ordering,
                                                        index,
                                                        index + 1,
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronDown className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {feedback.message && (
                            <div
                                className={cn(
                                    'rounded-2xl border p-3 text-sm',
                                    feedback.variant === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                        : 'border-rose-200 bg-rose-50 text-rose-950',
                                )}
                            >
                                {feedback.message}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                className="flex-1"
                                onClick={checkOrdering}
                                variant="outline"
                            >
                                <Shuffle className="size-4" />
                                Check order
                            </Button>
                            <Button className="flex-1" onClick={goToNextStep}>
                                Continue
                            </Button>
                        </div>
                    </div>
                );
            case 'matching':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Matching
                        </div>
                        <p className="text-sm leading-6 font-medium text-slate-900">
                            {String(currentBlock.prompt ?? '').trim() ||
                                'Match the pairs'}
                        </p>
                        <div className="space-y-3">
                            {(Array.isArray(currentBlock.pairs)
                                ? currentBlock.pairs
                                : []
                            ).map((pair, index) => {
                                const left =
                                    String(pair?.left ?? '').trim() ||
                                    `Left ${index + 1}`;

                                return (
                                    <div
                                        key={`${currentBlock.id}-pair-${index}`}
                                        className="grid gap-2 rounded-2xl border p-3"
                                    >
                                        <div className="text-sm font-medium">
                                            {left}
                                        </div>
                                        <select
                                            value={
                                                matchingSelections[left] ?? ''
                                            }
                                            onChange={(event) =>
                                                setMatchingSelections(
                                                    (current) => ({
                                                        ...current,
                                                        [left]: event.target
                                                            .value,
                                                    }),
                                                )
                                            }
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        >
                                            <option value="">
                                                Choose a match
                                            </option>
                                            {matchingOptions.map((option) => (
                                                <option
                                                    key={option}
                                                    value={option}
                                                >
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                        {feedback.message && (
                            <div
                                className={cn(
                                    'rounded-2xl border p-3 text-sm',
                                    feedback.variant === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                        : 'border-rose-200 bg-rose-50 text-rose-950',
                                )}
                            >
                                {feedback.message}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                className="flex-1"
                                onClick={checkMatching}
                                variant="outline"
                            >
                                <CheckCircle2 className="size-4" />
                                Check matches
                            </Button>
                            <Button className="flex-1" onClick={goToNextStep}>
                                Continue
                            </Button>
                        </div>
                    </div>
                );
            case 'scenario':
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Scenario
                        </div>
                        <p className="text-sm leading-6 font-medium text-slate-900">
                            {String(currentBlock.prompt ?? '').trim() ||
                                'Scenario prompt'}
                        </p>
                        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-muted-foreground">
                            {String(currentBlock.guidance ?? '').trim() ||
                                'Scenario interactions will eventually branch here.'}
                        </div>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
            default:
                return (
                    <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                        <div className="text-sm font-medium">
                            {blockLabel(currentBlock.type)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This activity type is not yet fully simulated in
                            test mode.
                        </p>
                        <Button onClick={goToNextStep} className="w-full">
                            Continue
                        </Button>
                    </div>
                );
        }
    };

    const renderLessonComplete = () => (
        <div className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-center">
                <CircleCheckBig className="size-12 text-emerald-600" />
            </div>
            <div className="space-y-1 text-center">
                <h2 className="text-lg font-semibold">Lesson complete</h2>
                <p className="text-sm text-muted-foreground">
                    {currentLesson?.title || 'This lesson'} is marked complete
                    in the learner flow.
                </p>
                <p className="text-sm text-muted-foreground">
                    {nextLesson
                        ? `Next up: ${nextLesson.title}.`
                        : 'You have reached the end of the course.'}
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-3 text-left">
                    <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                        Lesson states
                    </div>
                    <div className="mt-1 text-sm font-medium">
                        {completedLessonCount} of {lessons.length} completed
                    </div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3 text-left">
                    <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                        Knowledge checks
                    </div>
                    <div className="mt-1 text-sm font-medium">
                        {answeredQuestionCount} scored so far
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>
                    <ArrowLeft className="size-4" />
                    Review lesson
                </Button>
                <Button className="flex-1" onClick={goToNextStep}>
                    {nextLesson ? 'Continue to next lesson' : 'Finish course'}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 p-4 backdrop-blur">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose}>
                            <ArrowLeft className="size-4" />
                            Back to builder
                        </Button>
                        <div className="space-y-0.5">
                            <div className="text-sm font-semibold">
                                {courseTitle}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Preview as learner. Practice progress stays
                                local to this preview.
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">Saved locally</Badge>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid flex-1 gap-6 overflow-hidden p-4 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
                    <Card className="hidden h-full overflow-hidden xl:flex">
                        <CardHeader>
                            <CardTitle>Lesson states</CardTitle>
                            <CardDescription>
                                What the learner will step through.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 overflow-auto">
                            <button
                                type="button"
                                onClick={() => setStage('start')}
                                className={cn(
                                    'w-full rounded-2xl border px-3 py-2 text-left text-sm',
                                    stage === 'start'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border',
                                )}
                            >
                                Start screen
                            </button>
                            {lessons.map((lesson, index) => (
                                <div key={lesson.id} className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStage('running');
                                            setLessonIndex(index);
                                            setBlockIndex(-1);
                                            setPendingLessonIndex(null);
                                        }}
                                        className={cn(
                                            'w-full rounded-2xl border px-3 py-2 text-left text-sm',
                                            stage !== 'start' &&
                                                lessonIndex === index
                                                ? 'border-primary bg-primary/5'
                                                : completedLessonIds.includes(
                                                        lesson.id,
                                                    )
                                                  ? 'border-emerald-200 bg-emerald-50/70'
                                                  : 'border-border',
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span>
                                                Lesson {index + 1}:{' '}
                                                {lesson.title}
                                            </span>
                                            {completedLessonIds.includes(
                                                lesson.id,
                                            ) ? (
                                                <CircleCheckBig className="size-4 text-emerald-600" />
                                            ) : stage !== 'start' &&
                                              lessonIndex === index ? (
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full"
                                                >
                                                    Live
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </button>
                                    <div className="space-y-1 pl-3">
                                        {lesson.content.map(
                                            (block, blockIdx) => (
                                                <button
                                                    key={block.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setStage('running');
                                                        setLessonIndex(index);
                                                        setBlockIndex(blockIdx);
                                                    }}
                                                    className={cn(
                                                        'w-full rounded-xl border px-3 py-2 text-left text-xs',
                                                        stage === 'running' &&
                                                            lessonIndex ===
                                                                index &&
                                                            blockIndex ===
                                                                blockIdx
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border',
                                                    )}
                                                >
                                                    {blockLabel(block.type)}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="flex h-full flex-col items-center justify-center overflow-auto">
                        <div className="w-full max-w-[360px] rounded-[2.5rem] border border-slate-300 bg-slate-950 p-3 shadow-2xl">
                            <div className="rounded-[2rem] bg-white p-4">
                                <div className="mb-4 rounded-[1.25rem] bg-slate-950 px-4 py-3 text-white">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-semibold tracking-[0.24em] text-white/60 uppercase">
                                                Learner preview
                                            </div>
                                            <div className="text-sm font-medium">
                                                {courseTitle}
                                            </div>
                                        </div>
                                        <div className="text-right text-[11px] text-white/70">
                                            <div>
                                                {completedLessonCount} lesson
                                                {completedLessonCount === 1
                                                    ? ''
                                                    : 's'}{' '}
                                                complete
                                            </div>
                                            <div>
                                                {answeredQuestionCount}/
                                                {totalGradedQuestions} checks
                                                scored
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="border-white/20 text-white"
                                        >
                                            {progressPercent}%
                                        </Badge>
                                    </div>
                                    <div className="mt-3 h-1.5 rounded-full bg-white/10">
                                        <div
                                            className="h-1.5 rounded-full bg-white"
                                            style={{
                                                width: `${progressPercent}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {stage === 'start' ? (
                                    <div className="space-y-4">
                                        <Card className="border-slate-200 shadow-none">
                                            <CardHeader className="space-y-2">
                                                <CardTitle>
                                                    {courseTitle}
                                                </CardTitle>
                                                <CardDescription>
                                                    {courseDescription ||
                                                        'A mobile-first course run-through for authors.'}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        Lessons
                                                    </span>
                                                    <span className="font-medium">
                                                        {lessons.length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        Completed lessons
                                                    </span>
                                                    <span className="font-medium">
                                                        {completedLessonCount}/
                                                        {lessons.length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        Knowledge checks
                                                    </span>
                                                    <span className="font-medium">
                                                        {totalGradedQuestions}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        Estimated time
                                                    </span>
                                                    <span className="font-medium">
                                                        {estimatedMinutes
                                                            ? `${estimatedMinutes} min`
                                                            : 'Not set'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        Passing score
                                                    </span>
                                                    <span className="font-medium">
                                                        {passingScore !== null
                                                            ? `${passingScore}%`
                                                            : 'Not set'}
                                                    </span>
                                                </div>
                                                <div className="rounded-2xl border border-dashed bg-slate-50 p-3 text-xs text-muted-foreground">
                                                    Progress and results are
                                                    saved automatically on this
                                                    browser.
                                                </div>
                                                {learningObjectives.length >
                                                    0 && (
                                                    <div className="space-y-2 pt-2">
                                                        <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                            Learning objectives
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {learningObjectives
                                                                .slice(0, 4)
                                                                .map(
                                                                    (
                                                                        objective,
                                                                    ) => (
                                                                        <Badge
                                                                            key={
                                                                                objective
                                                                            }
                                                                            variant="secondary"
                                                                            className="max-w-full truncate"
                                                                        >
                                                                            {
                                                                                objective
                                                                            }
                                                                        </Badge>
                                                                    ),
                                                                )}
                                                            {learningObjectives.length >
                                                                4 && (
                                                                <Badge variant="outline">
                                                                    +
                                                                    {learningObjectives.length -
                                                                        4}{' '}
                                                                    more
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                        <Button
                                            onClick={goToNextStep}
                                            className="w-full"
                                        >
                                            Start course
                                        </Button>
                                    </div>
                                ) : stage === 'lesson_complete' ? (
                                    renderLessonComplete()
                                ) : stage === 'complete' ? (
                                    <div className="space-y-4 rounded-3xl border p-6 text-center">
                                        {passingScoreReached === false ? (
                                            <CircleX className="mx-auto size-10 text-rose-600" />
                                        ) : (
                                            <CircleCheckBig className="mx-auto size-10 text-emerald-600" />
                                        )}
                                        <div className="space-y-1">
                                            <h2 className="text-lg font-semibold">
                                                Course complete
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                You finished the learner test
                                                run. Nothing was reported.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-2xl border bg-slate-50 p-3 text-left">
                                                <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    Score
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold">
                                                    {scorePercent !== null
                                                        ? `${scorePercent}%`
                                                        : 'N/A'}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border bg-slate-50 p-3 text-left">
                                                <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    Checks
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {correctQuestionCount} of{' '}
                                                    {answeredQuestionCount}{' '}
                                                    correct
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border bg-slate-50 p-3 text-left">
                                                <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    Lessons
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {completedLessonCount} of{' '}
                                                    {lessons.length} complete
                                                </div>
                                            </div>
                                        </div>
                                        {passingScore !== null && (
                                            <div
                                                className={cn(
                                                    'rounded-2xl border p-3 text-sm',
                                                    passingScoreReached === true
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                                        : passingScoreReached ===
                                                            false
                                                          ? 'border-rose-200 bg-rose-50 text-rose-950'
                                                          : 'border-slate-200 bg-slate-50',
                                                )}
                                            >
                                                {passingScoreReached === true
                                                    ? `Passed the target of ${passingScore}%.`
                                                    : passingScoreReached ===
                                                        false
                                                      ? `Below the target of ${passingScore}%.`
                                                      : 'No scored checks were submitted yet.'}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={restart}
                                            >
                                                <RefreshCw className="size-4" />
                                                Replay
                                            </Button>
                                            <Button
                                                className="flex-1"
                                                onClick={onClose}
                                            >
                                                Close
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {currentLesson && blockIndex === -1 ? (
                                            <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
                                                <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    Lesson
                                                </div>
                                                <h2 className="text-lg font-semibold">
                                                    {currentLesson.title}
                                                </h2>
                                                <p className="text-sm text-muted-foreground">
                                                    {getVisibleBody(
                                                        currentLesson,
                                                    )}
                                                </p>
                                                <Button
                                                    onClick={goToNextStep}
                                                    className="w-full"
                                                >
                                                    Start lesson
                                                </Button>
                                            </div>
                                        ) : (
                                            renderCurrentBlock()
                                        )}

                                        {currentLesson && (
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <button
                                                    type="button"
                                                    onClick={goBack}
                                                    className="inline-flex items-center gap-1 font-medium text-foreground"
                                                >
                                                    <ArrowLeft className="size-3.5" />
                                                    Back
                                                </button>
                                                <div>
                                                    Lesson {lessonIndex + 1} of{' '}
                                                    {lessons.length}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <Card className="hidden h-full overflow-hidden xl:flex">
                        <CardHeader>
                            <CardTitle>Run notes</CardTitle>
                            <CardDescription>
                                Keep the test mode lightweight and truthful.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <div className="rounded-2xl border border-dashed p-4">
                                This mode is designed for authors to rehearse
                                the learner experience without writing progress
                                or affecting assignments.
                            </div>
                            <div className="rounded-2xl border border-dashed p-4">
                                Interactive blocks are intentionally simple
                                here. The real mobile app can take over richer
                                behaviors later.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
