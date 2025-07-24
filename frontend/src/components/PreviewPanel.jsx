import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { 
  DocumentTextIcon,
  PencilIcon,
  EyeIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  PrinterIcon,
  ClipboardDocumentIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  BookOpenIcon,
  KeyboardIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/useTheme';
import { useDebounce } from '../hooks/useDebounce';
import ErrorBoundary from './ErrorBoundary';

const EXPORT_FORMATS = {
  MARKDOWN: 'markdown',
  PDF: 'pdf',
  DOCX: 'docx'
};

const VIEW_MODES = {
  PREVIEW: 'preview',
  EDIT: 'edit',
  SPLIT: 'split'
};

const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl+E', action: 'Toggle edit mode' },
  { key: 'Ctrl+P', action: 'Preview mode' },
  { key: 'Ctrl+S', action: 'Save changes' },
  { key: 'Ctrl+F', action: 'Find in document' },
  { key: 'Ctrl+H', action: 'Find and replace' },
  { key: 'Ctrl+Z', action: 'Undo' },
  { key: 'Ctrl+Y', action: 'Redo' },
  { key: 'Ctrl+Enter', action: 'Full screen toggle' },
  { key: 'Escape', action: 'Exit full screen' }
];

const MARKDOWN_SHORTCUTS = [
  { syntax: '**text**', description: 'Bold text' },
  { syntax: '_text_', description: 'Italic text' },
  { syntax: '# Heading', description: 'Header (H1-H6)' },
  { syntax: '- Item', description: 'Bullet point' },
  { syntax: '1. Item', description: 'Numbered list' },
  { syntax: '[text](url)', description: 'Link' },
  { syntax: '```code```', description: 'Code block' },
  { syntax: '`code`', description: 'Inline code' },
  { syntax: '> Quote', description: 'Blockquote' },
  { syntax: '---', description: 'Horizontal rule' }
];

const PreviewPanel = ({ content, onEdit, sessionId, className = '' }) => {
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = useState(VIEW_MODES.PREVIEW);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showToc, setShowToc] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceText, setReplaceText] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [tocItems, setTocItems] = useState([]);
  const [foldedSections, setFoldedSections] = useState(new Set());

  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debounced edit content for auto-save
  const debouncedEditContent = useDebounce(editContent, 500);

  // Auto-save effect
  useEffect(() => {
    if (debouncedEditContent !== content && hasUnsavedChanges) {
      handleSave();
    }
  }, [debouncedEditContent]);

  // Initialize edit content when prop changes
  useEffect(() => {
    if (content !== editContent && !hasUnsavedChanges) {
      setEditContent(content);
    }
  }, [content]);

  // Generate table of contents
  useEffect(() => {
    const generateToc = () => {
      const lines = editContent.split('\n');
      const toc = [];
      let currentId = 0;

      lines.forEach((line, index) => {
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2].trim();
          const id = `heading-${currentId++}`;
          
          toc.push({
            id,
            text,
            level,
            lineNumber: index,
            href: `#${id}`
          });
        }
      });

      setTocItems(toc);
    };

    generateToc();
  }, [editContent]);

  // Search functionality
  useEffect(() => {
    if (searchQuery) {
      const results = [];
      const lines = editContent.split('\n');
      
      lines.forEach((line, lineIndex) => {
        const regex = new RegExp(searchQuery, 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            lineIndex,
            charIndex: match.index,
            text: line,
            match: match[0]
          });
        }
      });
      
      setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    } else {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
    }
  }, [searchQuery, editContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'e':
            e.preventDefault();
            setViewMode(viewMode === VIEW_MODES.EDIT ? VIEW_MODES.PREVIEW : VIEW_MODES.EDIT);
            break;
          case 'p':
            e.preventDefault();
            setViewMode(VIEW_MODES.PREVIEW);
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'f':
            e.preventDefault();
            setShowSearch(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
            break;
          case 'h':
            e.preventDefault();
            setShowReplace(true);
            setShowSearch(true);
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 'enter':
            e.preventDefault();
            setIsFullScreen(!isFullScreen);
            break;
        }
      } else if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else if (showSearch) {
          setShowSearch(false);
          setShowReplace(false);
        } else if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFullScreen, showSearch, showKeyboardHelp]);

  // Save handler
  const handleSave = useCallback(() => {
    if (hasUnsavedChanges && onEdit) {
      onEdit(editContent, sessionId);
      setHasUnsavedChanges(false);
    }
  }, [editContent, hasUnsavedChanges, onEdit, sessionId]);

  // Content change handler
  const handleContentChange = useCallback((value) => {
    // Add to undo stack
    setUndoStack(prev => [...prev.slice(-19), editContent]);
    setRedoStack([]);
    
    setEditContent(value);
    setHasUnsavedChanges(true);
  }, [editContent]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1];
      setRedoStack(prev => [editContent, ...prev]);
      setUndoStack(prev => prev.slice(0, -1));
      setEditContent(previousContent);
      setHasUnsavedChanges(true);
    }
  }, [undoStack, editContent]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[0];
      setUndoStack(prev => [...prev, editContent]);
      setRedoStack(prev => prev.slice(1));
      setEditContent(nextContent);
      setHasUnsavedChanges(true);
    }
  }, [redoStack, editContent]);

  // Search navigation
  const navigateSearch = useCallback((direction) => {
    if (searchResults.length === 0) return;
    
    const newIndex = direction === 'next' 
      ? (currentSearchIndex + 1) % searchResults.length
      : currentSearchIndex === 0 
        ? searchResults.length - 1 
        : currentSearchIndex - 1;
    
    setCurrentSearchIndex(newIndex);
    
    // Scroll to result in editor
    if (editorRef.current && searchResults[newIndex]) {
      const result = searchResults[newIndex];
      const lines = editContent.split('\n');
      const position = lines.slice(0, result.lineIndex).join('\n').length + result.charIndex;
      
      editorRef.current.setSelectionRange(position, position + result.match.length);
      editorRef.current.focus();
    }
  }, [searchResults, currentSearchIndex, editContent]);

  // Replace functionality
  const handleReplace = useCallback((replaceAll = false) => {
    if (!searchQuery || !replaceText) return;
    
    let newContent = editContent;
    
    if (replaceAll) {
      const regex = new RegExp(searchQuery, 'gi');
      newContent = editContent.replace(regex, replaceText);
    } else if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      const result = searchResults[currentSearchIndex];
      const lines = newContent.split('\n');
      const line = lines[result.lineIndex];
      const newLine = line.substring(0, result.charIndex) + 
                     replaceText + 
                     line.substring(result.charIndex + result.match.length);
      lines[result.lineIndex] = newLine;
      newContent = lines.join('\n');
    }
    
    handleContentChange(newContent);
  }, [searchQuery, replaceText, currentSearchIndex, searchResults, editContent, handleContentChange]);

  // Export handlers
  const handleExport = useCallback(async (format) => {
    setExportStatus('exporting');
    setShowExportMenu(false);
    
    try {
      let exportedContent;
      let filename;
      let mimeType;
      
      switch (format) {
        case EXPORT_FORMATS.MARKDOWN:
          exportedContent = editContent;
          filename = `prd-${sessionId}.md`;
          mimeType = 'text/markdown';
          break;
          
        case EXPORT_FORMATS.PDF:
          // PDF export would require a library like jsPDF or puppeteer
          // For now, we'll create a print-friendly version
          const printWindow = window.open('', '_blank');
          printWindow.document.write(`
            <html>
              <head>
                <title>PRD Export</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
                  h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 30px; }
                  code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
                  pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
                  blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; }
                  @media print { body { margin: 0; } }
                </style>
              </head>
              <body>${convertMarkdownToHtml(editContent)}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          setExportStatus('success');
          setTimeout(() => setExportStatus(null), 2000);
          return;
          
        case EXPORT_FORMATS.DOCX:
          // DOCX export would require a library like docx or mammoth
          // For demo purposes, we'll export as RTF
          exportedContent = convertMarkdownToRtf(editContent);
          filename = `prd-${sessionId}.rtf`;
          mimeType = 'application/rtf';
          break;
          
        default:
          throw new Error('Unsupported export format');
      }
      
      // Create and download file
      const blob = new Blob([exportedContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportStatus('success');
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
    }
    
    setTimeout(() => setExportStatus(null), 3000);
  }, [editContent, sessionId]);

  // Copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editContent);
      setCopyStatus('success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopyStatus('error');
    }
    
    setTimeout(() => setCopyStatus(null), 2000);
  }, [editContent]);

  // Utility functions
  const convertMarkdownToHtml = (markdown) => {
    // Simple markdown to HTML conversion - in production, use a proper library
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
      .replace(/`([^`]*)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br />');
  };

  const convertMarkdownToRtf = (markdown) => {
    // Simple markdown to RTF conversion
    const rtfHeader = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    const rtfFooter = '}';
    
    let rtfContent = markdown
      .replace(/^# (.*$)/gim, '\\fs32\\b $1\\b0\\fs24\\par')
      .replace(/^## (.*$)/gim, '\\fs28\\b $1\\b0\\fs24\\par')
      .replace(/^### (.*$)/gim, '\\fs26\\b $1\\b0\\fs24\\par')
      .replace(/\*\*(.*)\*\*/gim, '\\b $1\\b0')
      .replace(/\*(.*)\*/gim, '\\i $1\\i0')
      .replace(/\n/gim, '\\par ');
    
    return `${rtfHeader}\\f0\\fs24 ${rtfContent}${rtfFooter}`;
  };

  // TOC click handler
  const handleTocClick = useCallback((item) => {
    if (viewMode === VIEW_MODES.EDIT && editorRef.current) {
      const lines = editContent.split('\n');
      const position = lines.slice(0, item.lineNumber).join('\n').length;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(position, position);
    } else if (previewRef.current) {
      const element = previewRef.current.querySelector(`#${item.id}`);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [viewMode, editContent]);

  // Custom markdown components with TOC support
  const markdownComponents = useMemo(() => ({
    h1: ({ children, ...props }) => <h1 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h1>,
    h2: ({ children, ...props }) => <h2 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h3>,
    h4: ({ children, ...props }) => <h4 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h4>,
    h5: ({ children, ...props }) => <h5 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h5>,
    h6: ({ children, ...props }) => <h6 id={`heading-${tocItems.findIndex(item => item.text === children)}`} {...props}>{children}</h6>,
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={isDarkMode ? vscDarkPlus : prism}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  }), [isDarkMode, tocItems]);

  // Render toolbar
  const renderToolbar = () => (
    <div className={`flex items-center justify-between p-3 border-b ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center space-x-2">
        {/* View mode buttons */}
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setViewMode(VIEW_MODES.PREVIEW)}
            className={`px-3 py-1 text-sm rounded-l-lg ${
              viewMode === VIEW_MODES.PREVIEW
                ? 'bg-blue-500 text-white'
                : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Preview mode (Ctrl+P)"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.EDIT)}
            className={`px-3 py-1 text-sm ${
              viewMode === VIEW_MODES.EDIT
                ? 'bg-blue-500 text-white'
                : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Edit mode (Ctrl+E)"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.SPLIT)}
            className={`px-3 py-1 text-sm rounded-r-lg ${
              viewMode === VIEW_MODES.SPLIT
                ? 'bg-blue-500 text-white'
                : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Split view"
          >
            <Bars3Icon className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            showSearch ? 'bg-blue-500 text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title="Search (Ctrl+F)"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowToc(!showToc)}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            showToc ? 'bg-blue-500 text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title="Table of Contents"
        >
          <BookOpenIcon className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
            title="Export document"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
          </button>
          
          {showExportMenu && (
            <div className={`absolute top-full left-0 mt-1 py-2 w-48 rounded-lg shadow-lg z-50 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <button
                onClick={() => handleExport(EXPORT_FORMATS.MARKDOWN)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4 inline mr-2" />
                Export as Markdown
              </button>
              <button
                onClick={() => handleExport(EXPORT_FORMATS.PDF)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <DocumentArrowDownIcon className="w-4 h-4 inline mr-2" />
                Export as PDF
              </button>
              <button
                onClick={() => handleExport(EXPORT_FORMATS.DOCX)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <DocumentDuplicateIcon className="w-4 h-4 inline mr-2" />
                Export as DOCX
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* Export/Save status */}
        {exportStatus && (
          <div className={`flex items-center px-2 py-1 rounded text-sm ${
            exportStatus === 'success' ? 'bg-green-100 text-green-800' :
            exportStatus === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {exportStatus === 'success' ? <CheckIcon className="w-4 h-4 mr-1" /> :
             exportStatus === 'error' ? <ExclamationTriangleIcon className="w-4 h-4 mr-1" /> :
             <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {exportStatus === 'exporting' ? 'Exporting...' :
             exportStatus === 'success' ? 'Exported!' : 'Export failed'}
          </div>
        )}

        {/* Copy status */}
        {copyStatus && (
          <div className={`flex items-center px-2 py-1 rounded text-sm ${
            copyStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {copyStatus === 'success' ? <CheckIcon className="w-4 h-4 mr-1" /> : <ExclamationTriangleIcon className="w-4 h-4 mr-1" />}
            {copyStatus === 'success' ? 'Copied!' : 'Copy failed'}
          </div>
        )}

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <div className="flex items-center px-2 py-1 rounded text-sm bg-yellow-100 text-yellow-800">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Unsaved changes
          </div>
        )}

        {/* Action buttons */}
        <button
          onClick={handleCopyToClipboard}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title="Copy to clipboard"
        >
          <ClipboardDocumentIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title="Keyboard shortcuts"
        >
          <KeyboardIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title="Full screen (Ctrl+Enter)"
        >
          {isFullScreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  // Render search bar
  const renderSearchBar = () => (
    showSearch && (
      <div className={`p-3 border-b ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in document..."
              className={`w-full px-3 py-2 rounded border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => navigateSearch('prev')}
              disabled={searchResults.length === 0}
              className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <ChevronUpIcon className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => navigateSearch('next')}
              disabled={searchResults.length === 0}
              className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
            
            <span className={`text-sm px-2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
            </span>
          </div>
          
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
              showReplace ? 'bg-blue-500 text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
            title="Replace (Ctrl+H)"
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => {
              setShowSearch(false);
              setShowReplace(false);
              setSearchQuery('');
            }}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        
        {showReplace && (
          <div className="flex items-center space-x-2 mt-2">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className={`flex-1 px-3 py-2 rounded border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            
            <button
              onClick={() => handleReplace(false)}
              disabled={!searchQuery || currentSearchIndex < 0}
              className={`px-3 py-2 text-sm rounded border disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'
                  : 'bg-blue-500 border-blue-400 text-white hover:bg-blue-600'
              }`}
            >
              Replace
            </button>
            
            <button
              onClick={() => handleReplace(true)}
              disabled={!searchQuery}
              className={`px-3 py-2 text-sm rounded border disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-red-600 border-red-500 text-white hover:bg-red-700'
                  : 'bg-red-500 border-red-400 text-white hover:bg-red-600'
              }`}
            >
              Replace All
            </button>
          </div>
        )}
      </div>
    )
  );

  // Render Table of Contents
  const renderToc = () => (
    showToc && tocItems.length > 0 && (
      <div className={`w-64 border-r overflow-y-auto ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            Table of Contents
          </h3>
          <nav>
            {tocItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleTocClick(item)}
                className={`block w-full text-left py-1 px-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
                style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                title={item.text}
              >
                <span className="truncate block">{item.text}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    )
  );

  // Render keyboard shortcuts help
  const renderKeyboardHelp = () => (
    showKeyboardHelp && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`max-w-2xl w-full mx-4 rounded-lg shadow-xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Keyboard Shortcuts
            </h2>
            <button
              onClick={() => setShowKeyboardHelp(false)}
              className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className={`font-medium mb-3 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  General Shortcuts
                </h3>
                <div className="space-y-2">
                  {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                    <div key={index} className="flex justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {shortcut.action}
                      </span>
                      <kbd className={`px-2 py-1 text-xs rounded ${
                        isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className={`font-medium mb-3 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Markdown Syntax
                </h3>
                <div className="space-y-2">
                  {MARKDOWN_SHORTCUTS.map((shortcut, index) => (
                    <div key={index} className="flex justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {shortcut.description}
                      </span>
                      <code className={`px-2 py-1 text-xs rounded ${
                        isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {shortcut.syntax}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  );

  // Main content area
  const renderContent = () => {
    if (isCollapsed) {
      return (
        <div className={`flex items-center justify-center h-20 ${
          isDarkMode ? 'bg-gray-900 text-gray-400' : 'bg-gray-50 text-gray-500'
        }`}>
          Panel collapsed
        </div>
      );
    }

    return (
      <div className="flex flex-1 overflow-hidden">
        {renderToc()}
        
        <div className="flex-1 flex">
          {/* Edit view */}
          {(viewMode === VIEW_MODES.EDIT || viewMode === VIEW_MODES.SPLIT) && (
            <div className={`${viewMode === VIEW_MODES.SPLIT ? 'w-1/2 border-r' : 'w-full'} flex flex-col ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`p-2 border-b text-xs font-medium ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                Edit Mode
              </div>
              <textarea
                ref={editorRef}
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className={`flex-1 p-4 font-mono text-sm resize-none border-none outline-none ${
                  isDarkMode 
                    ? 'bg-gray-900 text-gray-100' 
                    : 'bg-white text-gray-900'
                }`}
                style={{ fontSize: `${zoomLevel}%` }}
                spellCheck={false}
              />
            </div>
          )}
          
          {/* Preview view */}
          {(viewMode === VIEW_MODES.PREVIEW || viewMode === VIEW_MODES.SPLIT) && (
            <div className={`${viewMode === VIEW_MODES.SPLIT ? 'w-1/2' : 'w-full'} flex flex-col`}>
              <div className={`p-2 border-b text-xs font-medium ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                Preview Mode
              </div>
              <div 
                ref={previewRef}
                className={`flex-1 p-4 overflow-y-auto prose max-w-none ${
                  isDarkMode ? 'prose-invert bg-gray-900' : 'bg-white'
                }`}
                style={{ fontSize: `${zoomLevel}%` }}
              >
                <ReactMarkdown 
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {editContent || '*No content to preview*'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isFullScreen) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        {renderToolbar()}
        {renderSearchBar()}
        {renderContent()}
        {renderKeyboardHelp()}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`h-full flex flex-col ${className} ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`} ref={containerRef}>
        {renderToolbar()}
        {renderSearchBar()}
        {renderContent()}
        {renderKeyboardHelp()}
      </div>
    </ErrorBoundary>
  );
};

PreviewPanel.propTypes = {
  content: PropTypes.string.isRequired,
  onEdit: PropTypes.func,
  sessionId: PropTypes.string.isRequired,
  className: PropTypes.string
};

PreviewPanel.defaultProps = {
  onEdit: null,
  className: ''
};

export default PreviewPanel;