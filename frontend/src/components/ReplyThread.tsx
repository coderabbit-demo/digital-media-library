import { useMemo, useState, type FormEvent } from 'react';
import { REPLY_MAX_LENGTH, type ReplyDTO } from '@dml/shared';
import { ApiError } from '../services/api';
import { useReplies, useCreateReply, useDeleteReply } from '../services/replies';
import { relativeTime } from '../utils/time';

/** Max visual indent depth; deeper replies render at the cap to stay readable. */
const MAX_INDENT = 4;

interface TreeNode extends ReplyDTO {
  children: TreeNode[];
}

/** Build a parent→children tree from the flat, creation-ordered reply list. */
function buildTree(replies: ReplyDTO[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  replies.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Inline composer for a top-level reply (parentId null) or a nested reply. */
function ReplyComposer({
  activityId,
  parentId,
  onDone,
  autoFocus,
}: {
  activityId: string;
  parentId: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const create = useCreateReply(activityId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (body.trim() === '') {
      setError('Reply can’t be empty.');
      return;
    }
    create.mutate(
      { body, parentId },
      {
        onSuccess: () => {
          setBody('');
          onDone?.();
        },
        onError: (err) => {
          setError(
            err instanceof ApiError && err.isRateLimited
              ? 'You’re replying a little too fast — try again in a moment.'
              : err instanceof Error
                ? err.message
                : 'Could not post your reply.',
          );
        },
      },
    );
  };

  return (
    <form className="reply-composer" onSubmit={submit}>
      <textarea
        className="reply-composer__input"
        value={body}
        maxLength={REPLY_MAX_LENGTH}
        rows={2}
        placeholder="Write a reply…"
        aria-label="Reply"
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? (
        <p className="post-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="reply-composer__actions">
        <button type="submit" className="btn btn-primary reply-composer__submit" disabled={create.isPending}>
          {create.isPending ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  );
}

function ReplyNode({ activityId, node, depth }: { activityId: string; node: TreeNode; depth: number }) {
  const del = useDeleteReply(activityId);
  const [replying, setReplying] = useState(false);
  const indent = Math.min(depth, MAX_INDENT) * 16;

  return (
    <div className="reply" style={{ marginLeft: indent }}>
      <div className="reply__avatar" aria-hidden="true">
        {node.author.avatarUrl ? (
          <img src={node.author.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-placeholder">{node.author.displayName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="reply__body">
        <div className="reply__head">
          <span className="reply__author">{node.author.displayName}</span>
          <time className="home-muted" dateTime={node.createdAt}>
            {relativeTime(node.createdAt)}
          </time>
        </div>
        {node.deleted ? (
          <p className="reply__text reply__text--deleted">[deleted]</p>
        ) : (
          <p className="reply__text">{node.body}</p>
        )}
        {!node.deleted ? (
          <div className="reply__actions">
            <button type="button" className="btn btn-ghost reply__action" onClick={() => setReplying((v) => !v)}>
              Reply
            </button>
            {node.canDelete ? (
              <button
                type="button"
                className="btn btn-ghost reply__action"
                disabled={del.isPending}
                onClick={() => del.mutate(node.id)}
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
        {replying ? (
          <ReplyComposer activityId={activityId} parentId={node.id} autoFocus onDone={() => setReplying(false)} />
        ) : null}
        {node.children.map((child) => (
          <ReplyNode key={child.id} activityId={activityId} node={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

/** The full conversation for an activity: a top-level composer + nested replies. */
export function ReplyThread({ activityId }: { activityId: string }) {
  const { data, isLoading, isError } = useReplies(activityId, true);
  const tree = useMemo(() => buildTree(data?.replies ?? []), [data?.replies]);

  return (
    <div className="reply-thread">
      <ReplyComposer activityId={activityId} parentId={null} />
      {isLoading ? (
        <p className="home-muted">Loading conversation…</p>
      ) : isError ? (
        <p className="post-form__error" role="alert">
          Couldn’t load the conversation.
        </p>
      ) : tree.length === 0 ? (
        <p className="home-muted reply-thread__empty">No replies yet — start the conversation.</p>
      ) : (
        tree.map((node) => <ReplyNode key={node.id} activityId={activityId} node={node} depth={0} />)
      )}
    </div>
  );
}
