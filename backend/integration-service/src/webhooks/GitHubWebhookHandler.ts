// GitHub Webhook Handler
import crypto from 'crypto';
import { Request } from 'express';

export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    name: string;
    full_name: string;
    owner: {
      name: string;
      email: string;
    };
  };
  pusher: {
    name: string;
    email: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
}

export interface GitHubPullRequestEvent {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize';
  number: number;
  pull_request: {
    id: number;
    title: string;
    state: string;
    merged: boolean;
    base: {
      ref: string;
    };
    head: {
      ref: string;
    };
    user: {
      login: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
  };
}

export interface WebhookTrigger {
  type: 'push' | 'pull_request' | 'release';
  repository: string;
  branch?: string;
  author: string;
  commitMessage?: string;
  triggeredAt: string;
  metadata: any;
}

export class GitHubWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify GitHub webhook signature
   */
  verifySignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  /**
   * Handle push event
   */
  handlePush(event: GitHubPushEvent): WebhookTrigger {
    const branch = event.ref.replace('refs/heads/', '');

    console.log(`[GitHub Webhook] 📦 Push event received`);
    console.log(`  Repository: ${event.repository.full_name}`);
    console.log(`  Branch: ${branch}`);
    console.log(`  Pusher: ${event.pusher.name}`);
    console.log(`  Commits: ${event.commits.length}`);

    // Check for schema migrations
    const hasSchemaChanges = event.commits.some(commit =>
      commit.added.some(f => f.includes('migrations/')) ||
      commit.modified.some(f => f.includes('migrations/'))
    );

    return {
      type: 'push',
      repository: event.repository.full_name,
      branch,
      author: event.pusher.name,
      commitMessage: event.commits[0]?.message,
      triggeredAt: new Date().toISOString(),
      metadata: {
        commits: event.commits.length,
        hasSchemaChanges,
        files: {
          added: event.commits.flatMap(c => c.added),
          modified: event.commits.flatMap(c => c.modified),
          removed: event.commits.flatMap(c => c.removed),
        },
      },
    };
  }

  /**
   * Handle pull request event
   */
  handlePullRequest(event: GitHubPullRequestEvent): WebhookTrigger | null {
    console.log(`[GitHub Webhook] 🔀 Pull Request event received`);
    console.log(`  Repository: ${event.repository.full_name}`);
    console.log(`  Action: ${event.action}`);
    console.log(`  PR #${event.number}: ${event.pull_request.title}`);

    // Only trigger on merge to main/master
    if (event.action === 'closed' && event.pull_request.merged) {
      return {
        type: 'pull_request',
        repository: event.repository.full_name,
        branch: event.pull_request.base.ref,
        author: event.pull_request.user.login,
        triggeredAt: new Date().toISOString(),
        metadata: {
          prNumber: event.number,
          prTitle: event.pull_request.title,
          merged: true,
          sourceBranch: event.pull_request.head.ref,
          targetBranch: event.pull_request.base.ref,
        },
      };
    }

    return null;
  }

  /**
   * Determine which pipelines to trigger
   */
  determinePipelinesToTrigger(trigger: WebhookTrigger): string[] {
    const pipelines: string[] = [];

    // Trigger data quality checks on schema changes
    if (trigger.metadata.hasSchemaChanges) {
      pipelines.push('data-quality-full-scan');
      pipelines.push('lineage-discovery');
    }

    // Trigger ETL pipelines on main branch updates
    if (trigger.branch === 'main' || trigger.branch === 'master') {
      pipelines.push('daily-etl-pipeline');
    }

    // Trigger specific pipelines based on file changes
    const modifiedFiles = trigger.metadata.files?.modified || [];
    if (modifiedFiles.some((f: string) => f.includes('dbt/'))) {
      pipelines.push('dbt-run');
    }

    console.log(`[GitHub Webhook] 🎯 Pipelines to trigger: ${pipelines.join(', ')}`);
    return pipelines;
  }
}
