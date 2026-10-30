import { useEffect, useRef, useState } from 'react';
import { useDoc } from '../state/docStore';
import {
  deleteProject,
  duplicateProject,
  exportCurrent,
  importProject,
  openGallery,
  openProject,
  renameProject,
  useProjects,
} from '../state/projects';
import { Icon } from './icons';

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export function ProjectMenu() {
  const doc = useDoc();
  const list = useProjects((s) => s.list);
  const currentId = useProjects((s) => s.currentId);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(doc.meta.name);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(doc.meta.name), [doc.meta.name]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const commitRename = async () => {
    setRenaming(false);
    if (currentId && name.trim() && name.trim() !== doc.meta.name) await renameProject(currentId, name);
  };

  return (
    <div className="menu-anchor" ref={ref}>
      {renaming ? (
        <input
          className="input"
          autoFocus
          style={{ width: 240 }}
          value={name}
          data-testid="rename-input"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setName(doc.meta.name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <button className="btn project-btn" data-testid="project-switcher" onClick={() => setOpen((o) => !o)} onDoubleClick={() => setRenaming(true)} title="Projects (double-click to rename)">
          <span className="name" data-testid="project-name">{doc.meta.name}</span>
          <Icon name="chevron" size={14} />
        </button>
      )}
      {open && (
        <div className="menu" role="menu" data-testid="project-menu">
          <div className="section-title" style={{ padding: '4px 6px 0' }}>
            Projects <span className="count">{list.length}</span>
          </div>
          <div className="menu-list">
            {list.map((p) => (
              <button
                key={p.id}
                className="menu-item"
                role="menuitem"
                aria-current={p.id === currentId}
                data-testid="project-item"
                data-name={p.name}
                onClick={async () => {
                  setOpen(false);
                  if (p.id !== currentId) await openProject(p.id);
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="meta">{ago(p.updatedAt)}</span>
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <div className="menu-actions">
            <button className="btn sm" data-testid="new-project" onClick={() => (setOpen(false), openGallery(true))}>
              <Icon name="plus" size={15} /> New
            </button>
            <button className="btn sm" onClick={() => (setOpen(false), setRenaming(true))}>
              <Icon name="edit" size={15} /> Rename
            </button>
            <button className="btn sm" onClick={() => currentId && (setOpen(false), duplicateProject(currentId))}>
              <Icon name="copy" size={15} /> Duplicate
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (currentId && confirm(`Delete “${doc.meta.name}”? This cannot be undone.`)) {
                  setOpen(false);
                  void deleteProject(currentId);
                }
              }}
            >
              <Icon name="trash" size={15} /> Delete
            </button>
            <button className="btn sm" onClick={() => (setOpen(false), exportCurrent())}>
              <Icon name="download" size={15} /> Export JSON
            </button>
            <button className="btn sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> Import JSON
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                await importProject(await file.text());
                setOpen(false);
              } catch (err) {
                alert(`Could not import: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
