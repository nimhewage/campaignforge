/**
 * Strips all Markdown syntax from a string, returning clean plain text.
 * Use this for every component that displays LLM-generated text outside
 * of a ReactMarkdown renderer (e.g. cards, badges, snippets, tooltips).
 */
export function stripMd(text: string): string {
  if (!text) return "";
  return text
    // Headings: ## Title → Title
    .replace(/^#{1,6}\s+/gm, "")
    // Bold/italic: **text**, *text*, __text__, _text_
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1")
    // Inline code: `code`
    .replace(/`([^`\n]+)`/g, "$1")
    // Fenced code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Blockquotes: > text → text
    .replace(/^>\s*/gm, "")
    // Unordered list markers: - item or * item
    .replace(/^[-*+]\s+/gm, "")
    // Ordered list markers: 1. item
    .replace(/^\d+\.\s+/gm, "")
    // Table pipes and dashes
    .replace(/\|[-: ]+\|[-| :]*\n/g, "")
    .replace(/\|/g, " ")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
