const allowedTags = new Set([
    'B',
    'BR',
    'DIV',
    'EM',
    'H1',
    'H2',
    'I',
    'LI',
    'OL',
    'P',
    'STRONG',
    'UL',
]);

const discardedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);

export function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function plainTextToRichTextHtml(value: string): string {
    return escapeHtml(value).replaceAll('\n', '<br>');
}

export function sanitizeRichTextHtml(value: string): string {
    if (typeof DOMParser === 'undefined') {
        return plainTextToRichTextHtml(richTextToPlainText(value));
    }

    const document = new DOMParser().parseFromString(value, 'text/html');

    const cleanNode = (node: Node): void => {
        Array.from(node.childNodes).forEach((child) => {
            if (!(child instanceof Element)) {
                return;
            }

            if (discardedTags.has(child.tagName)) {
                child.remove();

                return;
            }

            cleanNode(child);

            if (!allowedTags.has(child.tagName)) {
                child.replaceWith(...Array.from(child.childNodes));

                return;
            }

            Array.from(child.attributes).forEach((attribute) =>
                child.removeAttribute(attribute.name),
            );
        });
    };

    cleanNode(document.body);

    return document.body.innerHTML;
}

export function richTextToPlainText(value: string): string {
    if (typeof DOMParser === 'undefined') {
        return value
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/\s*(div|h1|h2|li|ol|p|ul)\s*>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    const document = new DOMParser().parseFromString(value, 'text/html');
    const blockTags = new Set(['DIV', 'H1', 'H2', 'LI', 'OL', 'P', 'UL']);
    const textFromNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent ?? '';
        }

        if (!(node instanceof Element)) {
            return '';
        }

        if (node.tagName === 'BR') {
            return '\n';
        }

        const text = Array.from(node.childNodes).map(textFromNode).join('');

        return blockTags.has(node.tagName) ? `${text}\n` : text;
    };

    return Array.from(document.body.childNodes)
        .map(textFromNode)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
