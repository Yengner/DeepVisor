'use client';

import { useCallback, useState } from 'react';
import { ActionIcon, Button, Checkbox, Menu, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconBookmark, IconBookmarkPlus, IconCheck, IconChevronDown, IconLink, IconTrash } from '@tabler/icons-react';
import { MAX_VIEW_NAME, savedViewRangeLabel } from '@/lib/shared/reports/savedViews';
import classes from '../Workspace.module.css';

interface SavedView { id: string; name: string; query: string; createdAt: string; isMine: boolean }
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Saved views are shared with everyone in the business. A view stores the report's filters and
 * period (a rolling preset stays rolling); the link it opens is still checked against the
 * viewer's own access when the report loads.
 */
export function SavedViewsMenu({ rollingPreset, isDemo }: { rollingPreset: 7 | 30 | 90 | null; isDemo: boolean }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [keepRolling, setKeepRolling] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch('/api/reports/views', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error);
      setViews(body.views);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  const flash = (message: string) => { setStatus(message); window.setTimeout(() => setStatus(null), 2400); };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('Link copied — teammates with access see this exact view');
    } catch {
      flash('Copy failed — copy the address bar instead');
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/reports/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, query: window.location.search, preset: keepRolling ? rollingPreset : null }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? 'The view could not be saved.');
      setViews(current => [body.view, ...current]);
      setModalOpen(false);
      setName('');
      flash(`Saved “${body.view.name}”`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The view could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    const response = await fetch(`/api/reports/views/${id}`, { method: 'DELETE' }).catch(() => null);
    if (response?.ok) setViews(current => current.filter(view => view.id !== id));
    else flash('That view could not be deleted');
  };

  return (
    <>
      <Menu position="bottom-end" shadow="md" width={300} closeOnItemClick onOpen={() => { setConfirmDelete(null); if (state !== 'ready' && !isDemo) void load(); }}>
        <Menu.Target>
          <Button leftSection={status ? <IconCheck size={16} /> : <IconBookmark size={16} />} rightSection={<IconChevronDown size={14} />} radius="xl" variant="default">
            Views
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconLink size={16} />} onClick={copyLink}>Copy link to this view</Menu.Item>
          <Menu.Item leftSection={<IconBookmarkPlus size={16} />} disabled={isDemo} onClick={() => { setError(null); setModalOpen(true); }}>
            Save current view…
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Saved for your team</Menu.Label>
          {isDemo ? <Text size="xs" c="dimmed" px="sm" pb="xs">Saved views are unavailable on demo data.</Text>
            : state === 'loading' || state === 'idle' ? <Text size="xs" c="dimmed" px="sm" pb="xs">Loading…</Text>
            : state === 'error' ? <Text size="xs" c="dimmed" px="sm" pb="xs">Saved views could not be loaded.</Text>
            : !views.length ? <Text size="xs" c="dimmed" px="sm" pb="xs">No saved views yet. Save the filters and period you use often.</Text>
            : views.map(view => (
              <div key={view.id} className={classes.savedView}>
                <Menu.Item component="a" href={`/reports?${view.query}`} className={classes.savedViewLink}>
                  <span className={classes.savedViewName}>{view.name}</span>
                  <span className={classes.savedViewMeta}>{savedViewRangeLabel(view.query)}{view.isMine ? '' : ' · shared by a teammate'}</span>
                </Menu.Item>
                {view.isMine ? (
                  <ActionIcon
                    variant={confirmDelete === view.id ? 'filled' : 'subtle'}
                    color={confirmDelete === view.id ? 'red' : 'gray'}
                    aria-label={confirmDelete === view.id ? `Confirm delete ${view.name}` : `Delete ${view.name}`}
                    title={confirmDelete === view.id ? 'Click again to delete' : 'Delete'}
                    onClick={event => { event.stopPropagation(); void remove(view.id); }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                ) : null}
              </div>
            ))}
        </Menu.Dropdown>
      </Menu>
      <span className={classes.srOnly} role="status" aria-live="polite">{status ?? ''}</span>
      {status ? <span className={classes.viewsToast} aria-hidden="true">{status}</span> : null}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Save this view" radius="lg" centered>
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <Stack gap="md">
            <TextInput
              label="Name"
              placeholder="e.g. Monthly client report"
              value={name}
              maxLength={MAX_VIEW_NAME}
              onChange={event => setName(event.currentTarget.value)}
              data-autofocus
              required
            />
            {rollingPreset ? (
              <Checkbox
                checked={keepRolling}
                onChange={event => setKeepRolling(event.currentTarget.checked)}
                label={`Keep it rolling (always the last ${rollingPreset} completed days)`}
                description="Off saves the exact dates shown now."
              />
            ) : null}
            <Text size="xs" c="dimmed">Everyone in this business can open saved views. Only you can delete yours.</Text>
            {error ? <Text size="sm" c="red" role="alert">{error}</Text> : null}
            <Button type="submit" loading={saving} disabled={!name.trim()} radius="xl">Save view</Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
