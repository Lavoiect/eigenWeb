import {
    Bold,
    Heading1,
    Heading2,
    Italic,
    List,
    ListOrdered,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
    plainTextToRichTextHtml,
    richTextToPlainText,
    sanitizeRichTextHtml,
} from '@/lib/rich-text';
import { cn } from '@/lib/utils';

type Props = {
    value: string;
    isRichText?: boolean;
    onChange: (html: string, plainText: string) => void;
    placeholder?: string;
    className?: string;
};

const toolbarItems = [
    { label: 'Bold', command: 'bold', icon: Bold },
    { label: 'Italic', command: 'italic', icon: Italic },
    { label: 'Bulleted list', command: 'insertUnorderedList', icon: List },
    { label: 'Numbered list', command: 'insertOrderedList', icon: ListOrdered },
    { label: 'Heading 1', command: 'formatBlock', value: 'h1', icon: Heading1 },
    { label: 'Heading 2', command: 'formatBlock', value: 'h2', icon: Heading2 },
] as const;

export default function RichTextEditor({
    value,
    isRichText = false,
    onChange,
    placeholder = 'Write lesson content…',
    className,
}: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const html = isRichText
        ? sanitizeRichTextHtml(value)
        : plainTextToRichTextHtml(value);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== html) {
            editorRef.current.innerHTML = html;
        }
    }, [html]);

    const commitChange = () => {
        const nextHtml = sanitizeRichTextHtml(
            editorRef.current?.innerHTML ?? '',
        );

        onChange(nextHtml, richTextToPlainText(nextHtml));
    };

    const runCommand = (command: string, commandValue?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        commitChange();
    };

    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20',
                className,
            )}
        >
            <div
                className="flex flex-wrap gap-1 border-b bg-muted/40 p-2"
                role="toolbar"
                aria-label="Text formatting"
            >
                {toolbarItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Button
                            key={item.label}
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title={item.label}
                            aria-label={item.label}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                runCommand(
                                    item.command,
                                    'value' in item ? item.value : undefined,
                                )
                            }
                        >
                            <Icon className="size-4" />
                        </Button>
                    );
                })}
            </div>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Text block content"
                data-placeholder={placeholder}
                onInput={commitChange}
                onBlur={commitChange}
                onPaste={(event) => {
                    event.preventDefault();
                    document.execCommand(
                        'insertText',
                        false,
                        event.clipboardData.getData('text/plain'),
                    );
                    commitChange();
                }}
                className="min-h-40 px-4 py-3 text-sm leading-7 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
            />
        </div>
    );
}
