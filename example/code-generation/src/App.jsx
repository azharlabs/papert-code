import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Code,
  Play,
  Settings,
  Layout,
  MessageSquare,
  Download,
  FileCode,
  FileJson,
  FileType,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  Terminal,
  Loader,
  Send,
  Save,
  EyeOff,
  Folder,
  ChevronRight,

  ChevronDown,
  Sun,
  Moon,
  Wrench,
  Plus,
  History,
  ArrowRight,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { WebContainer } from '@webcontainer/api';

// --- API Configuration ---
// No client-side API key needed, using backend proxy.

// --- Helper: Load JSZip Dynamically ---
const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// --- Helper: Get File Icon ---
const getFileIcon = (filename) => {
  if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.ts')) return <FileCode size={14} className="text-yellow-400" />;
  if (filename.endsWith('.html')) return <Layout size={14} className="text-orange-400" />;
  if (filename.endsWith('.css')) return <FileType size={14} className="text-blue-400" />;
  if (filename.endsWith('.json')) return <FileJson size={14} className="text-green-400" />;
  if (filename.endsWith('.py')) return <FileCode size={14} className="text-blue-300" />;
  return <FileText size={14} className="text-slate-400" />;
};

// --- Main App Component ---
export default function AutoMVP() {
  const [view, setView] = useState('input'); // input | generating | result | projects
  const [provider, setProvider] = useState('Papert Code');
  const [prdText, setPrdText] = useState('');
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('code'); // preview | code
  const [theme, setTheme] = useState('dark');
  const [showConsole, setShowConsole] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Project State
  const [files, setFiles] = useState([]); // Array of { path, content }
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPreviewable, setIsPreviewable] = useState(true);
  const [error, setError] = useState(null);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [basePrompt, setBasePrompt] = useState('');

  // WebContainer State
  const [previewUrl, setPreviewUrl] = useState('');
  const [isBundling, setIsBundling] = useState(false);
  const webcontainerRef = useRef(null);
  const webcontainerProcessRef = useRef(null);
  const webcontainerInstallRef = useRef(false);
  const webcontainerProjectRef = useRef(null);

  // Refinement & Controls
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState('chat'); // chat | logs

  const intervalRef = useRef(null);
  const chatEndRef = useRef(null);

  // Projects State
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Keep the selected file in sync with the latest file contents
  useEffect(() => {
    if (!files.length) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(prev => {
      if (!prev) return files[0];
      const updated = files.find(f => f.path === prev.path);
      return updated || files[0];
    });
  }, [files]);

  // Load Projects from Backend
  useEffect(() => {
    fetch('/api/projects')
      .then(async (res) => {
        if (res.status === 204) return [];
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) {
          setProjects(data);
        }
      })
      .catch(err => console.error('Failed to load projects:', err));
  }, []);

  // Helper to save project to backend
  const saveProject = async (project) => {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      // Update local list to reflect changes (timestamp etc)
      setProjects(prev => {
        const exists = prev.find(p => p.id === project.id);
        if (exists) {
          return prev.map(p => p.id === project.id ? { ...p, name: project.name, timestamp: project.timestamp } : p);
        }
        return [project, ...prev];
      });
    } catch (e) {
      console.error('Failed to save project:', e);
    }
  };

  // Sync active project changes & Auto-save
  useEffect(() => {
    if (activeProjectId) {
      const currentProject = {
        id: activeProjectId,
        name: projects.find(p => p.id === activeProjectId)?.name || 'Untitled',
        files,
        logs,
        chatHistory,
        prdText,
        timestamp: Date.now()
      };

      // Debounce save? For now, let's save on significant changes or just rely on manual triggers?
      // Actually, let's save when this effect runs, but maybe debounce it.
      // For simplicity in this step, we'll define the saver but call it explicitly in handlers.
      // Or better, use a ref to debounce.
    }
  }, [files, logs, chatHistory, prdText, activeProjectId]);

  // Auto-save effect with debounce
  useEffect(() => {
    if (!activeProjectId) return;

    const timer = setTimeout(() => {
      const projectToSave = {
        id: activeProjectId,
        name: projects.find(p => p.id === activeProjectId)?.name || 'Untitled',
        files,
        logs,
        chatHistory,
        prdText,
        timestamp: Date.now()
      };
      saveProject(projectToSave);
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [files, logs, chatHistory, prdText, activeProjectId]);

  // Theme Effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);



  // Load JSZip on mount
  useEffect(() => {
    loadJSZip().catch(e => console.error("Failed to load JSZip", e));
  }, []);

  useEffect(() => {
    if (activeProjectId && webcontainerProjectRef.current !== activeProjectId) {
      webcontainerInstallRef.current = false;
      webcontainerProjectRef.current = activeProjectId;
      if (webcontainerProcessRef.current?.kill) {
        webcontainerProcessRef.current.kill();
      }
      webcontainerProcessRef.current = null;
    }
  }, [activeProjectId]);

  // Cleanup interval
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isRefining]);

  // --- Helper: Fetch Stream ---
  const fetchStream = async (url, body, onLog, onResult, onError, onPermission) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${text}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep incomplete chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'log') onLog(data.data);
              if (data.type === 'model_output') {
                if (typeof data.data === 'string') {
                  onLog(data.data, '[model] ');
                } else if (data.data && typeof data.data === 'object') {
                  const kind = data.data.kind;
                  const text = data.data.text;
                  // Ignore partial deltas, but keep streaming the rest of the events.
                  if (kind === 'delta') continue;
                  const prefix =
                    kind === 'thinking'
                      ? '[thinking] '
                      : kind === 'delta'
                        ? '[model:partial] '
                        : '[model] ';
                    // kind === 'thinking' ? '[thinking] ' : '[model] ';
                  onLog(text, prefix);
                }
              }
              if (data.type === 'result') onResult(data.data);
              if (data.type === 'error') onError(data.data);
              if (data.type === 'permission_request' && onPermission) onPermission(data.data);
            } catch (e) {
              console.error('Failed to parse stream data', e);
            }
          }
        }
      }
    } catch (e) {
      onError(e.message);
    }
  };

  // Logs Ref to avoid staleness in closures
  const logsRef = useRef([]);
  const appendLogLines = (raw, prefix = '') => {
    const text = String(raw ?? '').replace(/\r/g, '');
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) return;
    setLogs((prev) => {
      const next = [
        ...prev,
        ...lines.map((line) => `> ${prefix}${line}`),
      ];
      logsRef.current = next;
      return next;
    });
  };

  // --- CORE: Generate Code ---
  const attemptGeneration = async (promptText, projectId, attempt = 1) => {
    if (attempt > 1) {
      appendLogLines(`Attempt ${attempt}: Retrying generation...`);
    }

    const runId = `gen-${projectId}-${attempt}`;
    const modelOutputs = [];
    await fetchStream(
      '/api/generate',
      { prompt: promptText, autoApprove, runId },
      (log, prefix) => {
        appendLogLines(log, prefix);
        if (prefix && prefix.includes('[model]')) {
          const text = String(log ?? '').replace(/\r/g, '').trim();
          if (!text) return;
          text.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (trimmed) modelOutputs.push(trimmed);
          });
        }
      },
      (data) => {
        const preparedFiles = processFiles(data.files);

        if (preparedFiles.length === 0) {
          const followUpText =
            modelOutputs.length > 0
              ? modelOutputs.join('\n')
              : 'The model requested more details to proceed.';
          setFollowUpPrompt(followUpText);
          setPrdText('');
          setView('input');
          return;
        }

        setFiles(preparedFiles);
        setIsPreviewable(data.previewable !== false);
        setFollowUpPrompt('');
        setBasePrompt('');

        // Create/Update Project
        const newProject = {
          id: projectId,
          name: promptText.slice(0, 30) + (promptText.length > 30 ? '...' : ''),
          files: preparedFiles,
          logs: logsRef.current,
          chatHistory: [{ role: 'system', text: "Project generated. You can now edit the code directly or ask me to refine it." }],
          prdText: promptText,
          timestamp: Date.now()
        };

        saveProject(newProject);
        setActiveProjectId(newProject.id);

        if (preparedFiles.length > 0) {
          const indexFile = preparedFiles.find(f => f.path.includes('index.html') || f.path.endsWith('.jsx')) || preparedFiles[0];
          setSelectedFile(indexFile);
          setActiveTab(data.previewable !== false ? 'preview' : 'code');
        }
        setTimeout(() => setView('result'), 800);
      },
      (err) => setError(err),
      (permissionRequest) => {
        setPendingApprovals(prev => [...prev, permissionRequest]);
      }
    );
  };

  const generateCode = async () => {
    if (!prdText.trim()) return;

    setView('generating');
    setLogs([]);
    logsRef.current = [];
    setError(null);
    setFiles([]);
    setChatHistory([{ role: 'system', text: "Project generated. You can now edit the code directly or ask me to refine it." }]);
    setPendingApprovals([]);

    if (intervalRef.current) clearInterval(intervalRef.current);

    appendLogLines('Initializing agent...');

    const projectId = Date.now().toString();
    if (!followUpPrompt) setBasePrompt(prdText);
    const promptText = followUpPrompt
      ? `${basePrompt || prdText}\n\nFollow-up questions:\n${followUpPrompt}\n\nUser answers:\n${prdText}`
      : prdText;
    await attemptGeneration(promptText, projectId);
  };

  const handleNewProject = () => {
    setActiveProjectId(null);
    setFiles([]);
    setLogs([]);
    setChatHistory([]);
    setPrdText('');
    setFollowUpPrompt('');
    setBasePrompt('');
    setView('input');
    setPreviewUrl('');
    setPendingApprovals([]);
  };

  const handleLoadProject = async (projectSummary) => {
    // If we are editing, do not load the project
    if (editingProjectId) return;



    try {
      const res = await fetch(`/api/projects/${projectSummary.id}`);
      const project = await res.json();

      setActiveProjectId(project.id);
      setFiles(project.files || []);
      setLogs(project.logs || []);
      setChatHistory(project.chatHistory || []);
      setPrdText(project.prdText || '');
      setFollowUpPrompt('');
      setBasePrompt('');
      setView('result');
      setView('result');
      setPreviewUrl('');

      if (project.files && project.files.length > 0) {
        const indexFile = project.files.find(f => f.path.includes('index.html') || f.path.endsWith('.jsx')) || project.files[0];
        setSelectedFile(indexFile);
      }
    } catch (e) {
      console.error("Failed to load project details", e);
      alert("Failed to load project. See console.");
    }
  };

  const handleStartEditing = (e, project) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const handleSaveRename = async (e) => {
    if (e) e.stopPropagation();
    if (!editingProjectId) return;

    const projectToUpdate = projects.find(p => p.id === editingProjectId);
    if (projectToUpdate && editingName.trim() !== '' && editingName !== projectToUpdate.name) {
      try {
        await fetch(`/api/projects/${editingProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingName.trim() })
        });

        // Update local state
        setProjects(prev => prev.map(p =>
          p.id === editingProjectId ? { ...p, name: editingName.trim() } : p
        ));
      } catch (error) {
        console.error('Failed to rename project:', error);
        alert('Failed to rename project');
      }
    }
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleKeyDownRename = (e) => {
    if (e.key === 'Enter') {
      handleSaveRename(e);
    } else if (e.key === 'Escape') {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) {
          handleNewProject();
        }
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  // --- CORE: Refine Code ---
  const handleRefine = async () => {
    if (!chatInput.trim() || isRefining) return;

    const userRequest = chatInput;
    setChatInput('');
    setIsRefining(true);
    setPendingApprovals([]);
    setChatHistory(prev => [...prev, { role: 'user', text: userRequest }]);

    // Show logs in chat or a separate view? User asked for "like view page"
    // We'll append logs to chat history as system messages for now, or maybe a special log block
    // Let's use a temporary log state for refinement if we want to show a terminal
    // But user said "same for the ai refinement also show that" -> implies terminal view
    // Let's toggle a "Refining..." terminal overlay

    setLogs([]); // Clear logs for new run
    const startLogIndex = chatHistory.length + 1;
    setChatHistory(prev => [...prev, { role: 'system', text: 'Refining...' }]);

    const runId = `refine-${Date.now()}`;
    await fetchStream(
      '/api/refine',
      { prompt: userRequest, files: files, autoApprove, runId },
      (log, prefix) => {
        // Option A: Stream into chat
        // setChatHistory(prev => [...prev, { role: 'log', text: log }]);
        // Option B: Update the main logs state and maybe show a mini terminal
        appendLogLines(log, prefix);
      },
      (data) => {
        const preparedFiles = processFiles(data.files);
        setFiles(preparedFiles);
        setRefreshKey(k => k + 1);
        setChatHistory(prev => [...prev, { role: 'system', text: `Updated project files.` }]);
      },
      (err) => {
        setChatHistory(prev => [...prev, { role: 'system', text: `Error refining: ${err}` }]);
      },
      (permissionRequest) => {
        setPendingApprovals(prev => [...prev, permissionRequest]);
      }
    );

    setIsRefining(false);
  };

  // --- Manual Edit Handler ---
  const handleCodeChange = (newContent) => {
    if (!selectedFile) return;

    // Update local state immediately for UI responsiveness
    const updatedFile = { ...selectedFile, content: newContent };
    setSelectedFile(updatedFile);

    // Update global file list
    setFiles(prev => prev.map(f => f.path === selectedFile.path ? updatedFile : f));
  };

  const handleSaveAndRefresh = () => {
    setRefreshKey(k => k + 1);
    if (activeTab !== 'preview' && isPreviewable) setActiveTab('preview');
    runPreview();
  };

  const handleFixError = (errorText) => {
    const prompt = `I encountered this error: ${errorText}. Please fix it.`;
    setChatInput(prompt);
    setActiveSidebarTab('chat');
    // We need to wait a bit for state to update if we want to auto-submit, 
    // but for now pre-filling is safer/better UX so user can review.
    // To auto-submit we'd need a useEffect or a ref to trigger handleRefine.
    // Let's just pre-fill and focus.
  };

  // --- Helper: Prepare Files for WebContainer ---
  const sanitizePublicUrlPlaceholders = (content) => {
    if (typeof content !== 'string') return content;
    return content
      .replace(/%PUBLIC_URL%/g, '')
      .replace(/\{\{\s*PUBLIC_URL\s*\}\}/g, '')
      .replace(/process\.env\.PUBLIC_URL/g, '');
  };

  const sanitizeFiles = (incomingFiles = []) =>
    incomingFiles.map(file => ({
      ...file,
      content: sanitizePublicUrlPlaceholders(file.content)
    }));

  const normalizeProjectStructure = (incomingFiles = []) => {
    if (incomingFiles.some(f => f.path === 'package.json')) {
      return incomingFiles;
    }

    const pkgWithPrefix = incomingFiles.find(f => f.path.endsWith('/package.json'));
    if (!pkgWithPrefix) return incomingFiles;

    const prefix = pkgWithPrefix.path.slice(0, -'package.json'.length).replace(/\/$/, '');
    if (!prefix) return incomingFiles;

    const prefixWithSlash = `${prefix}/`;
    const shouldStrip = incomingFiles.every(f => f.path === prefix || f.path.startsWith(prefixWithSlash));
    if (!shouldStrip) return incomingFiles;

    return incomingFiles
      .map(f => {
        if (f.path === prefix) {
          return null;
        }
        if (!f.path.startsWith(prefixWithSlash)) {
          return f;
        }
        return {
          ...f,
          path: f.path.slice(prefixWithSlash.length)
        };
      })
      .filter(Boolean);
  };

  const processFiles = (incomingFiles = []) =>
    normalizeProjectStructure(sanitizeFiles(incomingFiles));


  const detectNextProject = (projectFiles = []) => {
    const pkg = projectFiles.find(f => f.path === 'package.json');
    if (pkg) {
      try {
        const parsed = JSON.parse(pkg.content);
        if (parsed?.dependencies?.next || parsed?.devDependencies?.next) return true;
      } catch {
        // ignore JSON parse errors
      }
    }

    return projectFiles.some(f =>
      f.path.startsWith('pages/') ||
      f.path.startsWith('app/') ||
      f.path === 'next.config.js' ||
      f.path === 'next.config.mjs'
    );
  };


  const buildWebContainerTree = (projectFiles = []) => {
    const root = {};

    projectFiles.forEach(({ path, content }) => {
      const parts = path.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        if (isFile) {
          current[part] = { file: { contents: content ?? '' } };
        } else {
          current[part] = current[part] || { directory: {} };
          current = current[part].directory;
        }
      });
    });

    return root;
  };

  const getPackageJson = (projectFiles = []) => {
    const pkg = projectFiles.find(f => f.path === 'package.json');
    if (!pkg) return null;
    try {
      return JSON.parse(pkg.content);
    } catch {
      return null;
    }
  };

  const runPreview = async () => {
    if (detectNextProject(files)) {
      setLogs(prev => [...prev, '> Detected Next.js project. Preview bundling is disabled for Next.js apps.']);
      setIsPreviewable(false);
      return;
    }

    setIsBundling(true);
    setPreviewUrl('');
    setActiveTab('preview');
    setLogs(prev => [...prev, '> Starting WebContainer preview...']);

    try {
      const pkg = getPackageJson(files);
      if (!pkg) {
        setLogs(prev => [...prev, '> No package.json found. Showing inline preview instead.']);
        return;
      }

      const scripts = pkg.scripts || {};
      const devScript = scripts.dev ? 'dev' : scripts.start ? 'start' : null;

      if (!devScript) {
        setLogs(prev => [...prev, '> No dev or start script found. Showing inline preview instead.']);
        return;
      }

      if (!webcontainerRef.current) {
        setLogs(prev => [...prev, '> Booting WebContainer...']);
        webcontainerRef.current = await WebContainer.boot();
        webcontainerRef.current.on('server-ready', (_port, url) => {
          setPreviewUrl(url);
          setLogs(prev => [...prev, `> Preview ready at ${url}`]);
        });
      }

      await webcontainerRef.current.mount(buildWebContainerTree(files));

      if (!webcontainerInstallRef.current) {
        setLogs(prev => [...prev, '> Installing dependencies...']);
        const installProcess = await webcontainerRef.current.spawn('npm', ['install']);
        installProcess.output.pipeTo(new WritableStream({
          write(data) {
            setLogs(prev => [...prev, `> ${data}`]);
          }
        }));
        const installExit = await installProcess.exit;
        if (installExit !== 0) {
          throw new Error('npm install failed.');
        }
        webcontainerInstallRef.current = true;
      }

      if (!webcontainerProcessRef.current) {
        setLogs(prev => [...prev, '> Starting dev server...']);
        webcontainerProcessRef.current = await webcontainerRef.current.spawn('npm', [
          'run',
          devScript,
          '--',
          '--host',
          '0.0.0.0',
          '--port',
          '5173'
        ]);
        webcontainerProcessRef.current.output.pipeTo(new WritableStream({
          write(data) {
            setLogs(prev => [...prev, `> ${data}`]);
          }
        }));
      }
    } catch (e) {
      console.error('Preview error', e);
      setLogs(prev => [...prev, `> Preview error: ${e.message}`]);
    } finally {
      setIsBundling(false);
    }
  };

  // --- Render Preview (Smart) ---
  const sanitizeHtmlForInlinePreview = (html, projectFiles) => {
    if (typeof html !== 'string') return html;

    const normalizePath = (value = '') =>
      value
        .replace(/^https?:\/\/localhost:\d+\//i, '')
        .replace(/^%PUBLIC_URL%/g, '')
        .replace(/^\//, '');

    const inlineFileContent = (filePath, wrapperStart, wrapperEnd) => {
      const match = projectFiles.find(f => f.path === filePath || f.path.endsWith(`/${filePath}`));
      if (!match) return null;
      return `${wrapperStart}${match.content}${wrapperEnd}`;
    };

    let sanitized = html
      // Manifest links point to localhost in CRA builds and break inside srcDoc due to opaque origin.
      .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, '');

    // Inline CSS references
    sanitized = sanitized.replace(
      /<link([^>]+rel=["']stylesheet["'][^>]*href=["'])([^"']+)(["'][^>]*)>/gi,
      (match, pre, href, post) => {
        const normalized = normalizePath(href);
        const inlined = inlineFileContent(normalized, '<style>', '</style>');
        return inlined || match;
      }
    );

    // Inline JS references
    sanitized = sanitized.replace(
      /<script([^>]*src=["'])([^"']+)(["'][^>]*)><\/script>/gi,
      (match, pre, src, post) => {
        const normalized = normalizePath(src);
        const inlined = inlineFileContent(normalized, '<script>', '</script>');
        return inlined || match;
      }
    );

    // Rewrite any other localhost URLs to relative paths (images etc.)
    sanitized = sanitized.replace(/(href|src)=["']https?:\/\/localhost:\d+\/?([^"']*)["']/gi, (_, attr, path) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${attr}="${normalizedPath}"`;
    });

    return sanitized;
  };

  const renderPreview = () => {
    if (!isPreviewable) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center dark:bg-slate-950 bg-slate-50">
          <div className="dark:bg-slate-900 bg-slate-200 p-6 rounded-full mb-4">
            <EyeOff size={48} className="dark:text-slate-400 text-slate-500" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-2">Preview Unavailable</h3>
          <p className="max-w-md">
            The AI determined this is a backend, CLI, or non-web project (e.g., Python/Node/Data).
            Please check the "Source Code" tab to view the implementation.
          </p>
        </div>
      );
    }

    if (previewUrl) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-800 border-slate-200">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <input
              type="text"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setRefreshKey(k => k + 1);
                }
              }}
              className="flex-1 bg-white dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-3 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            />
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Open in new tab"
            >
              <ArrowRight size={14} className="-rotate-45" />
            </a>
          </div>
          <iframe
            key={refreshKey}
            src={previewUrl}
            title="Preview"
            className="w-full flex-1 bg-white border-0"
            allow="cross-origin-isolated; clipboard-read; clipboard-write"
          />
        </div>
      );
    }

    if (isBundling) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Loader size={32} className="animate-spin mb-4" />
          <p>Starting preview...</p>
        </div>
      );
    }

    // Try to find index.html
    let contentToRender = '';
    const htmlFile = files.find(f => f.path === 'index.html' || f.path.endsWith('.html'));
    const jsxFile = files.find(f => f.path.endsWith('.jsx') || f.path.endsWith('.tsx'));

    if (htmlFile) {
      contentToRender = sanitizeHtmlForInlinePreview(htmlFile.content, files);
      // Basic Injection for CSS/JS if they are separate and not linked properly by the AI
      const cssFile = files.find(f => f.path.endsWith('styles.css') || f.path.endsWith('style.css'));
      const jsFile = files.find(f => f.path.endsWith('script.js') || f.path.endsWith('app.js'));

      // Simple heuristic injection if missing tags
      if (cssFile && !contentToRender.includes(cssFile.path)) {
        contentToRender = contentToRender.replace('</head>', `<style>${cssFile.content}</style></head>`);
      }
      if (jsFile && !contentToRender.includes(jsFile.path)) {
        contentToRender = contentToRender.replace('</body>', `<script>${jsFile.content}</script></body>`);
      }
    } else if (jsxFile) {
      // Create a React Wrapper
      contentToRender = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            ${jsxFile.content}
            
            // Attempt to mount if the user code didn't
            if (typeof App !== 'undefined' && !document.getElementById('root').hasChildNodes()) {
              const root = ReactDOM.createRoot(document.getElementById('root'));
              root.render(<App />);
            }
          </script>
        </body>
        </html>
      `;
    } else {
      return <div className="p-10 text-center text-slate-500">No index.html or entry point found.</div>;
    }

    return (
      <iframe
        key={refreshKey}
        srcDoc={contentToRender}
        title="MVP Preview"
        className="w-full h-full bg-white border-0"
        sandbox="allow-scripts allow-modals allow-popups allow-forms"
      />
    );
  };

  // --- Helper: Zip Download ---
  const handleDownloadZip = async () => {
    if (!files.length) return;
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      files.forEach(f => zip.file(f.path, f.content));
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "mvp_project.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Failed to create ZIP.");
    }
  };

  const handleApprovalDecision = async (approval, decision) => {
    try {
      await fetch('/api/approve-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: approval.requestId,
          runId: approval.runId,
          decision
        })
      });
      setPendingApprovals(prev => prev.filter(item => item.requestId !== approval.requestId));
      appendLogLines(`${decision === 'allow' ? 'Approved' : 'Denied'} ${approval.toolName}`);
    } catch (e) {
      console.error('Failed to submit approval decision', e);
      appendLogLines(`Failed to submit approval for ${approval.toolName}`);
    }
  };

  const renderApprovalRequests = () => {
    if (autoApprove || pendingApprovals.length === 0) return null;

    return (
      <div className="mt-4 border-t dark:border-slate-800 border-slate-200 pt-4 space-y-4">
        {pendingApprovals.map((approval) => (
          <div key={approval.requestId} className="rounded-lg border dark:border-slate-800 border-slate-200 bg-slate-950/30 p-3">
            <div className="text-xs font-bold text-amber-400 mb-2">
              Approval required: {approval.toolName}
            </div>
            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap break-words max-h-40 overflow-auto mb-3">
              {JSON.stringify(approval.input ?? {}, null, 2)}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprovalDecision(approval, 'allow')}
                className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/40"
              >
                Approve
              </button>
              <button
                onClick={() => handleApprovalDecision(approval, 'deny')}
                className="px-2 py-1 rounded bg-red-600/20 text-red-300 text-[11px] font-bold hover:bg-red-500/40"
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen dark:bg-slate-900 dark:text-slate-100 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <nav className="border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('input')}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Cpu size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight dark:text-white text-slate-900">AutoMVP</span>
          </div>
          <div className="flex gap-4 text-sm text-slate-400 items-center">
            <button
              onClick={() => setView('projects')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-bold"
            >
              <Folder size={14} /> Projects
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-800 hover:bg-slate-200 transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
            <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono">
              Provider: Papert Code SDK
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 min-h-[calc(100vh-64px)]">

        {/* INPUT VIEW */}
        {view === 'input' && (
          <div className="max-w-3xl mx-auto mt-12 animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Architecture to Code
              </h1>
              <p className="text-slate-400 text-lg">
                Describe your full-stack app. We'll generate the structure, boilerplate, and code.
              </p>
            </div>

            <div className="dark:bg-slate-800/50 bg-white border dark:border-slate-700 border-slate-200 rounded-2xl p-1 shadow-2xl">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {['Papert Code'].map(p => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      disabled={p !== 'Papert Code'}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all 
                        ${provider === p ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500' : 'dark:bg-slate-800 bg-slate-100 dark:border-slate-700 border-slate-200 opacity-60'}
                        ${p !== 'Papert Code' && 'cursor-not-allowed opacity-40'}
                      `}
                    >
                      <div className="p-2 rounded-lg bg-slate-700">
                        <Cpu size={24} className="text-white" />
                      </div>
                      <span className="font-medium text-sm dark:text-slate-200 text-slate-700">{p}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900/60 bg-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Auto-approve tools</div>
                    <div className="text-xs text-slate-500">Allow all tool permissions during generation.</div>
                  </div>
                  <button
                    onClick={() => setAutoApprove(!autoApprove)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      autoApprove ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                    aria-pressed={autoApprove}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        autoApprove ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {followUpPrompt && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-200">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                      More Details Needed
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-amber-100">
                      {followUpPrompt}
                    </pre>
                    <div className="mt-2 text-xs text-amber-200/80">
                      Answer the questions below and click Generate to continue.
                    </div>
                  </div>
                )}

                <textarea
                  value={prdText}
                  onChange={(e) => setPrdText(e.target.value)}
                  placeholder="E.g. Create a React Todo app with local storage. Use nice Tailwind colors."
                  className="w-full h-64 dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none dark:text-slate-100 text-slate-900"
                />
                <button
                  onClick={generateCode}
                  disabled={!prdText.trim()}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Cpu /> Generate Codebase
                </button>
              </div>
            </div>

            {/* Recent Projects */}
            {projects.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Recent Projects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.slice(0, 6).map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleLoadProject(p)}
                      className="group cursor-pointer p-4 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white hover:border-indigo-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                          <Folder size={16} />
                        </div>
                        <span className="text-xs text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold dark:text-slate-200 text-slate-700 truncate mb-1">{p.name}</h4>
                      <p className="text-xs text-slate-500 truncate">ID: {p.id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GENERATING VIEW */}
        {view === 'generating' && (
          <div className="max-w-3xl mx-auto mt-20">
            <div className="dark:bg-slate-950 bg-slate-100 rounded-lg border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden font-mono text-sm">
              <div className="dark:bg-slate-900 bg-slate-200 px-4 py-2 border-b dark:border-slate-800 border-slate-300 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                <span className="ml-2 text-slate-500 text-xs">automvp-builder --v2.1.0</span>
              </div>
              <div className="p-6 h-96 overflow-y-auto space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 animate-fade-in-up">
                    <span className="text-indigo-500">➜</span>
                    <span className="dark:text-slate-300 text-slate-700">{log}</span>
                  </div>
                ))}
                {renderApprovalRequests()}
                {error && (
                  <button onClick={() => setView('input')} className="mt-4 text-red-400 hover:underline">
                    Error: {error}. Click to retry.
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS VIEW */}
        {view === 'projects' && (
          <div className="max-w-5xl mx-auto mt-12 animate-fade-in">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  Your Projects
                </h1>
                <p className="text-slate-400 mt-1">Manage and resume your work.</p>
              </div>
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-bold shadow-lg shadow-indigo-500/20"
              >
                <Plus size={18} /> New Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-500 border-2 border-dashed dark:border-slate-800 border-slate-200 rounded-2xl">
                  <Folder size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No projects yet</p>
                  <p className="text-sm">Create a new project to get started.</p>
                </div>
              )}
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleLoadProject(p)}
                  className="group cursor-pointer p-6 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={20} className="text-indigo-400 -rotate-45 group-hover:rotate-0 transition-transform" />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                      <Folder size={24} />
                    </div>
                    <div>
                      {editingProjectId === p.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={handleSaveRename}
                          onKeyDown={handleKeyDownRename}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-lg dark:text-slate-200 text-slate-700 bg-transparent border-b border-indigo-500 focus:outline-none w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2 group/title">
                          <h4
                            className="font-bold text-lg dark:text-slate-200 text-slate-700 truncate max-w-[150px]"
                            title={p.name}
                          >
                            {p.name}
                          </h4>
                          <button
                            onClick={(e) => handleStartEditing(e, p)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all text-slate-400 hover:text-indigo-500"
                            title="Rename project"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(e, p.id)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all text-slate-400 hover:text-red-500"
                            title="Delete project"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <span className="text-xs text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-950/50 p-2 rounded-lg truncate">
                    ID: {p.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULT VIEW */}
        {view === 'result' && (
          <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 animate-fade-in">

            {/* Sidebar: Chat & Files */}
            <div className="w-full lg:w-80 flex flex-col gap-4 h-[40%] lg:h-full">

              {/* Refine Chat & Logs */}
              <div className="dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-xl flex-1 flex flex-col overflow-hidden shadow-lg min-h-0">
                <div className="p-3 border-b dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 flex justify-between items-center">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveSidebarTab('chat')}
                      className={`font-bold text-sm flex items-center gap-2 ${activeSidebarTab === 'chat' ? 'text-indigo-400' : 'text-slate-400'}`}
                    >
                      <MessageSquare size={14} /> Chat
                    </button>
                    {logs.length > 0 && (
                      <button
                        onClick={() => setActiveSidebarTab('logs')}
                        className={`font-bold text-sm flex items-center gap-2 ${activeSidebarTab === 'logs' ? 'text-indigo-400' : 'text-slate-400'}`}
                      >
                        <Terminal size={14} /> Logs
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 dark:bg-slate-900/30 bg-slate-50 relative">
                  {activeSidebarTab === 'chat' && (
                    <>
                      {/* Chat History */}
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] rounded-lg p-3 text-xs ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : msg.role === 'system' ? 'dark:bg-slate-800 bg-white dark:text-slate-300 text-slate-700 border dark:border-slate-700 border-slate-200' : 'dark:bg-slate-900 bg-slate-100 dark:text-green-400 text-green-600 font-mono border dark:border-slate-800 border-slate-200'
                            }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}

                      {/* Live Logs Overlay for Refinement */}
                      {isRefining && logs.length > 0 && (
                        <div className="mt-4 border-t border-slate-700 pt-4">
                          <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                            <Loader size={12} className="animate-spin" /> Agent Working...
                          </div>
                          <div className="font-mono text-xs text-slate-400 space-y-1">
                            {logs.slice(-5).map((log, i) => (
                              <div key={i} className="truncate">{log}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeSidebarTab === 'logs' && (
                    <div className="font-mono text-xs text-slate-400 space-y-1">
                      {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                      {renderApprovalRequests()}
                    </div>
                  )}



                  <div ref={chatEndRef} />
                </div>

                <div className="p-2 dark:bg-slate-900 bg-slate-100 border-t dark:border-slate-700 border-slate-200 shrink-0">
                  <div className="relative flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleRefine()}
                      placeholder="E.g., Change title to..."
                      className="flex-1 dark:bg-slate-800 bg-white border dark:border-slate-600 border-slate-300 rounded px-3 py-2 text-xs dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                      disabled={isRefining || activeSidebarTab === 'logs'}
                    />
                    <button
                      onClick={handleRefine}
                      disabled={!chatInput.trim() || isRefining || activeSidebarTab === 'logs'}
                      className="text-indigo-400 hover:text-white disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* File Explorer (Removed from here) */}

            </div>

            {/* Main Area: Editor / Preview */}
            <div className={`
              flex flex-col dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-xl overflow-hidden shadow-2xl transition-all duration-300
              ${isMaximized ? 'fixed inset-4 z-50' : 'flex-1'}
            `}>
              {/* Toolbar */}
              <div className="h-12 dark:bg-slate-900 bg-slate-100 border-b dark:border-slate-700 border-slate-200 flex items-center justify-between px-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'code' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Code size={16} /> Source Code
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    disabled={!isPreviewable}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'preview' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'} ${!isPreviewable && 'opacity-50 cursor-not-allowed'}`}
                  >
                    <Layout size={16} /> Preview
                    {!isPreviewable && <EyeOff size={12} />}
                  </button>
                </div>
                <div className="flex gap-3 text-slate-500 items-center">
                  <button
                    onClick={() => setShowConsole(!showConsole)}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${showConsole ? 'bg-slate-200 dark:bg-slate-800 text-indigo-500' : 'hover:text-slate-700 dark:hover:text-slate-300'}`}
                    title="Toggle Console"
                  >
                    <Terminal size={14} />
                  </button>
                  {activeTab === 'code' && (
                    <button
                      onClick={handleSaveAndRefresh}
                      className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-700/50 text-emerald-200 hover:bg-emerald-600 hover:text-white transition text-xs font-bold"
                    >
                      <Save size={12} /> Save & Run
                    </button>
                  )}
                  <button
                    onClick={handleDownloadZip}
                    className="flex items-center gap-2 px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition text-xs font-bold"
                  >
                    <Download size={12} /> ZIP
                  </button>
                  <div className="w-px h-4 bg-slate-700 mx-1"></div>
                  <button onClick={handleSaveAndRefresh} className="hover:text-white transition"><RefreshCw size={14} /></button>
                  <button onClick={() => setIsMaximized(!isMaximized)} className="hover:text-white transition">
                    {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 relative overflow-hidden dark:bg-slate-950 bg-slate-50 flex flex-col">

                {/* Code Editor with Split View */}
                {activeTab === 'code' && (
                  <div className="flex-1 flex flex-row min-h-0">
                    {/* Left: Explorer */}
                    <div className="w-64 dark:bg-slate-900 bg-slate-50 border-r dark:border-slate-800 border-slate-200 flex flex-col">
                      <div className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b dark:border-slate-800 border-slate-200">
                        Explorer
                      </div>
                      <div className="flex-1 overflow-y-auto p-2">
                        {files.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedFile(file)}
                            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs rounded-sm transition-colors mb-0.5
                                ${selectedFile?.path === file.path ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 border-l-2 border-transparent'}
                              `}
                          >
                            {getFileIcon(file.path)}
                            <span className="truncate">{file.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Monaco Editor */}
                    <div className="flex-1 flex flex-col min-w-0 dark:bg-[#1e1e1e] bg-white">
                      {selectedFile ? (
                        <>
                          <div className="h-9 dark:bg-[#1e1e1e] bg-white flex items-center px-4 border-b dark:border-[#2b2b2b] border-slate-200">
                            <span className="text-xs text-slate-400 flex items-center gap-2">
                              {getFileIcon(selectedFile.path)}
                              {selectedFile.path}
                            </span>
                          </div>
                          <Editor
                            height="100%"
                            theme={theme === 'dark' ? 'vs-dark' : 'light'}
                            path={selectedFile.path}
                            defaultLanguage={selectedFile.path.endsWith('.html') ? 'html' : selectedFile.path.endsWith('.css') ? 'css' : selectedFile.path.endsWith('.json') ? 'json' : 'javascript'}
                            defaultValue={selectedFile.content}
                            value={selectedFile.content}
                            onChange={handleCodeChange}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 14,
                              wordWrap: 'on',
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              padding: { top: 16 }
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                          <Code size={48} className="mb-4 opacity-20" />
                          <p>Select a file to start editing</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Console Panel */}
                {showConsole && (
                  <div className="h-48 border-t dark:border-slate-800 border-slate-200 dark:bg-[#1e1e1e] bg-slate-50 flex flex-col transition-all duration-300">
                    <div className="flex items-center justify-between px-4 py-2 border-b dark:border-slate-800 border-slate-200 bg-slate-100 dark:bg-slate-900">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Terminal size={12} /> Console
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setLogs([])} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Clear</button>
                        <button onClick={() => setShowConsole(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Minimize2 size={12} /></button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                      {logs.length === 0 && <div className="text-slate-400 italic">No logs yet...</div>}
                      {logs.map((log, i) => {
                        const isError = typeof log === 'string' && (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') || log.toLowerCase().includes('exception'));
                        return (
                          <div key={i} className={`flex gap-2 ${isError ? 'text-red-400' : 'dark:text-slate-300 text-slate-600'}`}>
                            <span className="opacity-50 select-none">{'>'}</span>
                            <span className="break-all whitespace-pre-wrap">{log}</span>
                            {isError && (
                              <button
                                onClick={() => handleFixError(log)}
                                className="ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-[10px] font-bold uppercase tracking-wide border border-red-500/20"
                              >
                                <Wrench size={10} /> Fix with AI
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                )}

                {/* Preview */}
                {activeTab === 'preview' && renderPreview()}


              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
